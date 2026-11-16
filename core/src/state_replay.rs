use crate::{Chain, ChainError, LedgerError, LedgerState};
use std::collections::BTreeMap;

/// Why deterministic replay could not reconstruct account state.
///
/// Genesis allocations are supplied explicitly by the caller. Until the allocation
/// set is committed into a versioned genesis block, every node must be configured
/// with the exact same allocation map.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StateReplayError {
    InvalidChain(ChainError),
    InvalidGenesisAllocation(LedgerError),
    UnsignedTransactions { block_index: u64 },
    Ledger {
        block_index: u64,
        transaction_index: usize,
        source: LedgerError,
    },
}

impl LedgerState {
    /// Reconstruct account balances and nonces from a validated chain.
    ///
    /// Only signed transactions are applied. Legacy blocks containing unsigned
    /// transactions are rejected because their sender identity is not authenticated.
    /// Empty legacy blocks are harmless and are accepted for backward compatibility.
    ///
    /// This is a deterministic replay primitive, not yet a complete consensus rule:
    /// callers must supply the same genesis allocations and the protocol must later
    /// commit those allocations into the canonical genesis definition.
    pub fn replay_signed_chain(
        chain: &Chain,
        genesis_balances: &BTreeMap<String, u64>,
    ) -> Result<Self, StateReplayError> {
        chain.validate().map_err(StateReplayError::InvalidChain)?;

        let mut state = Self::default();
        for (address, amount) in genesis_balances {
            state
                .set_genesis_balance(address.clone(), *amount)
                .map_err(StateReplayError::InvalidGenesisAllocation)?;
        }

        for block in chain.blocks.iter().skip(1) {
            if block.transactions.is_empty() && block.signed_transactions.is_empty() {
                continue;
            }
            if block.signed_transactions.len() != block.transactions.len()
                || block
                    .signed_transactions
                    .iter()
                    .zip(&block.transactions)
                    .any(|(signed, tx)| signed.transaction != *tx)
            {
                return Err(StateReplayError::UnsignedTransactions {
                    block_index: block.index,
                });
            }

            for (transaction_index, signed) in block.signed_transactions.iter().enumerate() {
                state.apply(&signed.transaction).map_err(|source| {
                    StateReplayError::Ledger {
                        block_index: block.index,
                        transaction_index,
                        source,
                    }
                })?;
            }
        }

        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{SignedTransaction, Transaction};
    use ed25519_dalek::{Signer, SigningKey};

    fn signed_transfer(amount: u64, nonce: u64) -> SignedTransaction {
        let key = SigningKey::from_bytes(&[31_u8; 32]);
        let public_key = hex::encode(key.verifying_key().as_bytes());
        let transaction = Transaction {
            from: public_key.clone(),
            to: "recipient".to_owned(),
            amount,
            nonce,
        };
        let signature = key.sign(&SignedTransaction::signing_payload(&transaction));
        SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signature.to_bytes()),
        }
    }

    #[test]
    fn replay_rebuilds_identical_balances_and_nonces() {
        let first = signed_transfer(12, 1);
        let second = signed_transfer(8, 2);
        let sender = first.transaction.from.clone();
        let mut chain = Chain::new();
        chain.append_signed(1, vec![first]).unwrap();
        chain.append_signed(2, vec![second]).unwrap();

        let allocations = BTreeMap::from([(sender.clone(), 50)]);
        let state_a = LedgerState::replay_signed_chain(&chain, &allocations).unwrap();
        let state_b = LedgerState::replay_signed_chain(&chain, &allocations).unwrap();

        assert_eq!(state_a, state_b);
        assert_eq!(state_a.balances.get(&sender), Some(&30));
        assert_eq!(state_a.balances.get("recipient"), Some(&20));
        assert_eq!(state_a.nonces.get(&sender), Some(&2));
    }

    #[test]
    fn replay_rejects_legacy_unsigned_transactions() {
        let mut chain = Chain::new();
        chain.append(1, vec![Transaction {
            from: "alice".to_owned(),
            to: "bob".to_owned(),
            amount: 1,
            nonce: 1,
        }]);

        let error = LedgerState::replay_signed_chain(
            &chain,
            &BTreeMap::from([("alice".to_owned(), 10)]),
        ).unwrap_err();

        assert_eq!(error, StateReplayError::UnsignedTransactions { block_index: 1 });
    }

    #[test]
    fn replay_rejects_transactions_that_exceed_genesis_balance() {
        let signed = signed_transfer(51, 1);
        let sender = signed.transaction.from.clone();
        let mut chain = Chain::new();
        chain.append_signed(1, vec![signed]).unwrap();

        let error = LedgerState::replay_signed_chain(
            &chain,
            &BTreeMap::from([(sender, 50)]),
        ).unwrap_err();

        assert!(matches!(
            error,
            StateReplayError::Ledger {
                block_index: 1,
                transaction_index: 0,
                source: LedgerError::InsufficientFunds { .. },
            }
        ));
    }
}
