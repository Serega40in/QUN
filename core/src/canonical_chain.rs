//! Canonical v1 chain container with deterministic genesis and atomic ledger replay.
//!
//! This is an in-memory validation primitive, not a consensus engine or disk-backed node.

use crate::{
    versioned_block::{CanonicalBlockV1, VersionedBlockError},
    AuthenticatedLedgerError, LedgerState,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CanonicalChainError {
    Empty,
    InvalidGenesis,
    InvalidBlock { at: usize, error: VersionedBlockError },
    InvalidLedgerTransition { at: usize, error: AuthenticatedLedgerError },
    HeightOverflow,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanonicalChainV1 {
    pub network_id: [u8; 32],
    pub blocks: Vec<CanonicalBlockV1>,
}

impl CanonicalChainV1 {
    /// Create a chain with a deterministic, empty v1 genesis block for this network.
    pub fn new(network_id: [u8; 32]) -> Self {
        let genesis = CanonicalBlockV1::build(network_id, 0, 0, [0; 32], Vec::new())
            .expect("empty canonical genesis block is always encodable");
        Self { network_id, blocks: vec![genesis] }
    }

    pub fn height(&self) -> Option<u64> {
        self.blocks.last().map(|block| block.height)
    }

    pub fn tip_hash(&self) -> Option<[u8; 32]> {
        self.blocks.last().map(|block| block.hash)
    }

    /// Validate chain links and every block's canonical signatures and hash.
    pub fn validate_structure(&self) -> Result<(), CanonicalChainError> {
        let Some(genesis) = self.blocks.first() else {
            return Err(CanonicalChainError::Empty);
        };
        let expected_genesis = CanonicalBlockV1::build(
            self.network_id, 0, 0, [0; 32], Vec::new(),
        ).expect("empty canonical genesis block is always encodable");
        if genesis != &expected_genesis {
            return Err(CanonicalChainError::InvalidGenesis);
        }

        for (at, block) in self.blocks.iter().enumerate().skip(1) {
            let parent = &self.blocks[at - 1];
            let expected_height = parent.height.checked_add(1)
                .ok_or(CanonicalChainError::HeightOverflow)?;
            block.validate(&self.network_id, expected_height, &parent.hash)
                .map_err(|error| CanonicalChainError::InvalidBlock { at, error })?;
        }
        Ok(())
    }

    /// Append a block only if its chain position and all signed transactions are valid.
    /// This validates block structure/signatures, but not balances or nonces.
    pub fn append(&mut self, block: CanonicalBlockV1) -> Result<(), CanonicalChainError> {
        let parent = self.blocks.last().ok_or(CanonicalChainError::Empty)?;
        let expected_height = parent.height.checked_add(1)
            .ok_or(CanonicalChainError::HeightOverflow)?;
        block.validate(&self.network_id, expected_height, &parent.hash)
            .map_err(|error| CanonicalChainError::InvalidBlock {
                at: self.blocks.len(), error,
            })?;
        self.blocks.push(block);
        Ok(())
    }

    /// Validate and replay the entire chain from a caller-supplied trusted initial ledger.
    /// Returns a new state; the supplied ledger is never mutated on failure.
    pub fn validate_and_replay(
        &self,
        initial_ledger: &LedgerState,
    ) -> Result<LedgerState, CanonicalChainError> {
        self.validate_structure()?;
        let mut replayed = initial_ledger.clone();
        for (at, block) in self.blocks.iter().enumerate().skip(1) {
            replayed.apply_block_canonical(&block.transactions, &self.network_id)
                .map_err(|error| CanonicalChainError::InvalidLedgerTransition { at, error })?;
        }
        Ok(replayed)
    }

    /// Atomically validate a candidate block against the current tip and ledger before
    /// committing either the block or the new ledger state.
    pub fn append_with_ledger(
        &mut self,
        ledger: &mut LedgerState,
        block: CanonicalBlockV1,
    ) -> Result<(), CanonicalChainError> {
        let parent = self.blocks.last().ok_or(CanonicalChainError::Empty)?;
        let expected_height = parent.height.checked_add(1)
            .ok_or(CanonicalChainError::HeightOverflow)?;
        block.validate(&self.network_id, expected_height, &parent.hash)
            .map_err(|error| CanonicalChainError::InvalidBlock {
                at: self.blocks.len(), error,
            })?;

        let mut staged_ledger = ledger.clone();
        staged_ledger.apply_block_canonical(&block.transactions, &self.network_id)
            .map_err(|error| CanonicalChainError::InvalidLedgerTransition {
                at: self.blocks.len(), error,
            })?;

        self.blocks.push(block);
        *ledger = staged_ledger;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{canonical, SignedTransaction, Transaction};
    use ed25519_dalek::{Signer, SigningKey};

    fn signed_transfer(
        seed: u8,
        network_id: &[u8; 32],
        recipient: &str,
        amount: u64,
        nonce: u64,
    ) -> SignedTransaction {
        let key = SigningKey::from_bytes(&[seed; 32]);
        let public_key_bytes = key.verifying_key().to_bytes();
        let public_key = hex::encode(public_key_bytes);
        let transaction = Transaction {
            from: public_key.clone(),
            to: recipient.to_owned(),
            amount,
            nonce,
        };
        let payload = canonical::encode_transaction_payload(
            network_id, &public_key_bytes, &transaction.to, amount, nonce,
        ).unwrap();
        SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(key.sign(&payload).to_bytes()),
        }
    }

    #[test]
    fn chain_appends_valid_blocks_and_replays_ledger() {
        let network = [51; 32];
        let mut chain = CanonicalChainV1::new(network);
        let key = SigningKey::from_bytes(&[52; 32]);
        let sender = hex::encode(key.verifying_key().as_bytes());
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance(sender.clone(), 100).unwrap();

        let tx = signed_transfer(52, &network, "receiver", 30, 1);
        let parent = chain.tip_hash().unwrap();
        let block = CanonicalBlockV1::build(network, 1, 1_800_000_010, parent, vec![tx]).unwrap();
        chain.append_with_ledger(&mut ledger, block).unwrap();

        assert_eq!(ledger.balances.get(&sender), Some(&70));
        assert_eq!(ledger.balances.get("receiver"), Some(&30));
        assert!(chain.validate_structure().is_ok());

        let mut initial = LedgerState::default();
        initial.set_genesis_balance(sender.clone(), 100).unwrap();
        let replayed = chain.validate_and_replay(&initial).unwrap();
        assert_eq!(replayed, ledger);
    }

    #[test]
    fn failed_ledger_transition_commits_neither_block_nor_state() {
        let network = [61; 32];
        let mut chain = CanonicalChainV1::new(network);
        let mut ledger = LedgerState::default();
        let before_ledger = ledger.clone();
        let before_len = chain.blocks.len();

        let tx = signed_transfer(62, &network, "receiver", 30, 1);
        let block = CanonicalBlockV1::build(
            network, 1, 1_800_000_011, chain.tip_hash().unwrap(), vec![tx],
        ).unwrap();

        assert!(matches!(
            chain.append_with_ledger(&mut ledger, block),
            Err(CanonicalChainError::InvalidLedgerTransition { .. })
        ));
        assert_eq!(ledger, before_ledger);
        assert_eq!(chain.blocks.len(), before_len);
    }

    #[test]
    fn chain_rejects_wrong_parent_and_mutated_history() {
        let network = [71; 32];
        let mut chain = CanonicalChainV1::new(network);
        let wrong_parent = [72; 32];
        let block = CanonicalBlockV1::build(
            network, 1, 1_800_000_012, wrong_parent, vec![],
        ).unwrap();
        assert!(matches!(
            chain.append(block),
            Err(CanonicalChainError::InvalidBlock { .. })
        ));

        chain.blocks[0].timestamp = 1;
        assert_eq!(chain.validate_structure(), Err(CanonicalChainError::InvalidGenesis));
    }
}
