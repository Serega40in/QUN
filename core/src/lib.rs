use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Transaction {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub nonce: u64,
}


/// A transaction paired with its Ed25519 public key and detached signature.
/// The node must verify this signature before applying the transaction.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SignedTransaction {
    pub transaction: Transaction,
    /// Lowercase hexadecimal Ed25519 public key; also the sender address.
    pub public_key: String,
    /// Lowercase hexadecimal Ed25519 signature.
    pub signature: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignatureError {
    InvalidPublicKeyEncoding,
    InvalidPublicKey,
    SenderDoesNotMatchPublicKey,
    InvalidSignatureEncoding,
    InvalidSignature,
}

impl SignedTransaction {
    /// Canonical, domain-separated payload. Field order and domain are protocol constants.
    pub fn signing_payload(tx: &Transaction) -> Vec<u8> {
        serde_json::to_vec(&("QUN_TX_V1", &tx.from, &tx.to, tx.amount, tx.nonce))
            .expect("serializing a fixed QUN transaction payload must succeed")
    }

    /// Verify sender ownership and the Ed25519 signature over the transaction fields.
    pub fn verify(&self) -> Result<(), SignatureError> {
        use ed25519_dalek::{Signature, Verifier, VerifyingKey};

        let public_key_bytes = hex::decode(&self.public_key)
            .map_err(|_| SignatureError::InvalidPublicKeyEncoding)?;
        let public_key_array: [u8; 32] = public_key_bytes
            .try_into()
            .map_err(|_| SignatureError::InvalidPublicKeyEncoding)?;
        let verifying_key = VerifyingKey::from_bytes(&public_key_array)
            .map_err(|_| SignatureError::InvalidPublicKey)?;
        if self.transaction.from != self.public_key {
            return Err(SignatureError::SenderDoesNotMatchPublicKey);
        }
        let signature_bytes = hex::decode(&self.signature)
            .map_err(|_| SignatureError::InvalidSignatureEncoding)?;
        let signature = Signature::from_slice(&signature_bytes)
            .map_err(|_| SignatureError::InvalidSignatureEncoding)?;
        verifying_key
            .verify(&Self::signing_payload(&self.transaction), &signature)
            .map_err(|_| SignatureError::InvalidSignature)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Block {
    pub index: u64,
    pub timestamp: u64,
    pub previous_hash: String,
    pub transactions: Vec<Transaction>,
    /// Cryptographically authenticated transactions. Empty for legacy local-demo blocks.
    #[serde(default)]
    pub signed_transactions: Vec<SignedTransaction>,
    pub hash: String,
}

impl Block {
    pub fn calculate_hash(
        index: u64,
        timestamp: u64,
        previous_hash: &str,
        transactions: &[Transaction],
    ) -> String {
        // Stable field order; JSON serialization is used only for this fixed struct schema.
        let payload = serde_json::to_vec(&(index, timestamp, previous_hash, transactions))
            .expect("serializing a fixed QUN block payload must succeed");
        let digest = Sha256::digest(payload);
        digest.iter().map(|b| format!("{b:02x}")).collect()
    }

    pub fn calculate_signed_hash(
        index: u64,
        timestamp: u64,
        previous_hash: &str,
        transactions: &[Transaction],
        signed_transactions: &[SignedTransaction],
    ) -> String {
        let payload = serde_json::to_vec(&(
            "QUN_BLOCK_V2",
            index,
            timestamp,
            previous_hash,
            transactions,
            signed_transactions,
        )).expect("serializing a fixed QUN signed block payload must succeed");
        let digest = Sha256::digest(payload);
        digest.iter().map(|b| format!("{b:02x}")).collect()
    }

    fn new(
        index: u64,
        timestamp: u64,
        previous_hash: String,
        transactions: Vec<Transaction>,
    ) -> Self {
        let hash = Self::calculate_hash(index, timestamp, &previous_hash, &transactions);
        Self {
            index,
            timestamp,
            previous_hash,
            transactions,
            signed_transactions: vec![],
            hash,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Chain {
    pub blocks: Vec<Block>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChainError {
    Empty,
    InvalidGenesis,
    InvalidIndex { at: usize },
    InvalidPreviousHash { at: usize },
    InvalidHash { at: usize },
    InvalidSignedTransaction { at: usize },
}

impl Chain {
    pub fn new() -> Self {
        Self {
            blocks: vec![Block::new(0, 0, "QUN_GENESIS_V1".into(), vec![])],
        }
    }

    pub fn append(&mut self, timestamp: u64, transactions: Vec<Transaction>) -> &Block {
        let previous = self
            .blocks
            .last()
            .expect("Chain::new always creates genesis");
        let block = Block::new(
            previous.index + 1,
            timestamp,
            previous.hash.clone(),
            transactions,
        );
        self.blocks.push(block);
        self.blocks.last().expect("block was just appended")
    }

    /// Append a block containing signed transactions after verifying every signature.
    pub fn append_signed(
        &mut self,
        timestamp: u64,
        signed_transactions: Vec<SignedTransaction>,
    ) -> Result<&Block, ChainError> {
        for (position, signed) in signed_transactions.iter().enumerate() {
            signed.verify().map_err(|_| ChainError::InvalidSignedTransaction { at: position })?;
        }
        let previous = self.blocks.last().expect("Chain::new always creates genesis");
        let transactions: Vec<Transaction> = signed_transactions
            .iter().map(|signed| signed.transaction.clone()).collect();
        let index = previous.index + 1;
        let previous_hash = previous.hash.clone();
        let hash = Block::calculate_signed_hash(
            index, timestamp, &previous_hash, &transactions, &signed_transactions,
        );
        self.blocks.push(Block {
            index, timestamp, previous_hash, transactions, signed_transactions, hash,
        });
        Ok(self.blocks.last().expect("block was just appended"))
    }

    pub fn validate(&self) -> Result<(), ChainError> {
        let Some(genesis) = self.blocks.first() else {
            return Err(ChainError::Empty);
        };
        if genesis.index != 0
            || genesis.timestamp != 0
            || genesis.previous_hash != "QUN_GENESIS_V1"
            || !genesis.transactions.is_empty()
            || !genesis.signed_transactions.is_empty()
            || genesis.hash
                != Block::calculate_hash(
                    genesis.index,
                    genesis.timestamp,
                    &genesis.previous_hash,
                    &genesis.transactions,
                )
        {
            return Err(ChainError::InvalidGenesis);
        }

        for i in 1..self.blocks.len() {
            let current = &self.blocks[i];
            let previous = &self.blocks[i - 1];
            if current.index != previous.index + 1 {
                return Err(ChainError::InvalidIndex { at: i });
            }
            if current.previous_hash != previous.hash {
                return Err(ChainError::InvalidPreviousHash { at: i });
            }
            let expected_hash = if current.signed_transactions.is_empty() {
                Block::calculate_hash(
                    current.index, current.timestamp, &current.previous_hash, &current.transactions,
                )
            } else {
                if current.signed_transactions.len() != current.transactions.len()
                    || current.signed_transactions.iter().zip(&current.transactions)
                        .any(|(signed, tx)| signed.transaction != *tx || signed.verify().is_err())
                {
                    return Err(ChainError::InvalidSignedTransaction { at: i });
                }
                Block::calculate_signed_hash(
                    current.index, current.timestamp, &current.previous_hash,
                    &current.transactions, &current.signed_transactions,
                )
            };
            if current.hash != expected_hash {
                return Err(ChainError::InvalidHash { at: i });
            }
        }
        Ok(())
    }
}

impl Default for Chain {
    fn default() -> Self {
        Self::new()
    }
}


/// Deterministic account state for development and unit tests.
/// This does not authenticate `Transaction::from`; never use it for real assets
/// until transaction signatures are verified by the node.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct LedgerState {
    pub balances: std::collections::BTreeMap<String, u64>,
    pub nonces: std::collections::BTreeMap<String, u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LedgerError {
    EmptyAddress,
    ZeroAmount,
    SelfTransfer,
    InvalidNonce { expected: u64, actual: u64 },
    InsufficientFunds { available: u64, required: u64 },
    BalanceOverflow,
}

impl LedgerState {
    /// Explicitly fund an account for local development/test fixtures only.
    /// This is not a blockchain transaction and must never be exposed as a public API.
    pub fn set_genesis_balance(
        &mut self,
        address: impl Into<String>,
        amount: u64,
    ) -> Result<(), LedgerError> {
        let address = address.into();
        if address.trim().is_empty() {
            return Err(LedgerError::EmptyAddress);
        }
        self.balances.insert(address, amount);
        Ok(())
    }

    /// Apply a transaction to in-memory state. The caller must authenticate its sender first.
    pub fn apply(&mut self, tx: &Transaction) -> Result<(), LedgerError> {
        if tx.from.trim().is_empty() || tx.to.trim().is_empty() {
            return Err(LedgerError::EmptyAddress);
        }
        if tx.amount == 0 {
            return Err(LedgerError::ZeroAmount);
        }
        if tx.from == tx.to {
            return Err(LedgerError::SelfTransfer);
        }

        let previous_nonce = self.nonces.get(&tx.from).copied().unwrap_or(0);
        let expected_nonce = previous_nonce
            .checked_add(1)
            .ok_or(LedgerError::BalanceOverflow)?;
        if tx.nonce != expected_nonce {
            return Err(LedgerError::InvalidNonce {
                expected: expected_nonce,
                actual: tx.nonce,
            });
        }

        let available = self.balances.get(&tx.from).copied().unwrap_or(0);
        if available < tx.amount {
            return Err(LedgerError::InsufficientFunds {
                available,
                required: tx.amount,
            });
        }
        let recipient_balance = self.balances.get(&tx.to).copied().unwrap_or(0);
        let new_recipient_balance = recipient_balance
            .checked_add(tx.amount)
            .ok_or(LedgerError::BalanceOverflow)?;

        self.balances.insert(tx.from.clone(), available - tx.amount);
        self.balances.insert(tx.to.clone(), new_recipient_balance);
        self.nonces.insert(tx.from.clone(), tx.nonce);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signed_transaction_verifies_and_rejects_tampering() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
        let public_key = hex::encode(signing_key.verifying_key().as_bytes());
        let transaction = Transaction {
            from: public_key.clone(),
            to: "recipient-demo".into(),
            amount: 42,
            nonce: 1,
        };
        let signature = signing_key.sign(&SignedTransaction::signing_payload(&transaction));
        let signed = SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signature.to_bytes()),
        };
        assert_eq!(signed.verify(), Ok(()));

        let mut tampered = signed;
        tampered.transaction.amount += 1;
        assert_eq!(tampered.verify(), Err(SignatureError::InvalidSignature));
    }

    #[test]
    fn signed_transaction_rejects_sender_key_mismatch() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing_key = SigningKey::from_bytes(&[9_u8; 32]);
        let public_key = hex::encode(signing_key.verifying_key().as_bytes());
        let transaction = Transaction {
            from: "not-the-public-key".into(),
            to: "recipient-demo".into(),
            amount: 1,
            nonce: 1,
        };
        let signature = signing_key.sign(&SignedTransaction::signing_payload(&transaction));
        let signed = SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signature.to_bytes()),
        };
        assert_eq!(signed.verify(), Err(SignatureError::SenderDoesNotMatchPublicKey));
    }

    #[test]
    fn signed_block_persists_and_revalidates_signatures() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing_key = SigningKey::from_bytes(&[11_u8; 32]);
        let public_key = hex::encode(signing_key.verifying_key().as_bytes());
        let transaction = Transaction {
            from: public_key.clone(),
            to: "recipient-demo".into(),
            amount: 7,
            nonce: 1,
        };
        let signature = signing_key.sign(&SignedTransaction::signing_payload(&transaction));
        let signed = SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signature.to_bytes()),
        };

        let mut chain = Chain::new();
        chain.append_signed(1, vec![signed]).unwrap();
        assert!(chain.validate().is_ok());

        chain.blocks[1].signed_transactions[0].signature = "00".repeat(64);
        assert_eq!(
            chain.validate(),
            Err(ChainError::InvalidSignedTransaction { at: 1 })
        );
    }

    #[test]
    fn genesis_chain_is_valid() {
        assert!(Chain::new().validate().is_ok());
    }

    #[test]
    fn append_links_blocks() {
        let mut chain = Chain::new();
        chain.append(
            1,
            vec![Transaction {
                from: "alice".into(),
                to: "bob".into(),
                amount: 5,
                nonce: 1,
            }],
        );
        assert_eq!(chain.blocks.len(), 2);
        assert!(chain.validate().is_ok());
    }

    #[test]
    fn detects_modified_transaction() {
        let mut chain = Chain::new();
        chain.append(
            1,
            vec![Transaction {
                from: "alice".into(),
                to: "bob".into(),
                amount: 5,
                nonce: 1,
            }],
        );
        chain.blocks[1].transactions[0].amount = 500;
        assert_eq!(chain.validate(), Err(ChainError::InvalidHash { at: 1 }));
    }

    #[test]
    fn detects_broken_link() {
        let mut chain = Chain::new();
        chain.append(1, vec![]);
        chain.blocks[1].previous_hash = "broken".into();
        assert_eq!(
            chain.validate(),
            Err(ChainError::InvalidPreviousHash { at: 1 })
        );
    }

    fn funded_ledger() -> LedgerState {
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance("alice", 100).unwrap();
        ledger
    }

    #[test]
    fn ledger_applies_transfer_and_advances_nonce() {
        let mut ledger = funded_ledger();
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 30,
            nonce: 1,
        };
        assert_eq!(ledger.apply(&tx), Ok(()));
        assert_eq!(ledger.balances.get("alice"), Some(&70));
        assert_eq!(ledger.balances.get("bob"), Some(&30));
        assert_eq!(ledger.nonces.get("alice"), Some(&1));
    }

    #[test]
    fn ledger_rejects_insufficient_funds_without_mutation() {
        let mut ledger = funded_ledger();
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 101,
            nonce: 1,
        };
        let before = ledger.clone();
        assert_eq!(
            ledger.apply(&tx),
            Err(LedgerError::InsufficientFunds {
                available: 100,
                required: 101
            })
        );
        assert_eq!(ledger, before);
    }

    #[test]
    fn ledger_rejects_replayed_or_skipped_nonce() {
        let mut ledger = funded_ledger();
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 1,
            nonce: 2,
        };
        assert_eq!(
            ledger.apply(&tx),
            Err(LedgerError::InvalidNonce {
                expected: 1,
                actual: 2
            })
        );
    }

    #[test]
    fn ledger_rejects_zero_amount_and_empty_addresses() {
        let mut ledger = funded_ledger();
        let zero = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 0,
            nonce: 1,
        };
        assert_eq!(ledger.apply(&zero), Err(LedgerError::ZeroAmount));
        let empty = Transaction {
            from: "".into(),
            to: "bob".into(),
            amount: 1,
            nonce: 1,
        };
        assert_eq!(ledger.apply(&empty), Err(LedgerError::EmptyAddress));
    }

    #[test]
    fn ledger_rejects_recipient_balance_overflow_without_mutation() {
        let mut ledger = funded_ledger();
        ledger.set_genesis_balance("bob", u64::MAX).unwrap();
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 1,
            nonce: 1,
        };
        let before = ledger.clone();
        assert_eq!(ledger.apply(&tx), Err(LedgerError::BalanceOverflow));
        assert_eq!(ledger, before);
    }

}

/// Golden vectors freeze the current v0 JSON byte representation. If these
/// change, the transaction/block encoding is protocol-breaking and must be
/// versioned deliberately rather than changed as an incidental refactor.
#[cfg(test)]
mod protocol_golden_vectors {
    use super::*;

    #[test]
    fn transaction_signing_payload_matches_golden_bytes() {
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 7,
            nonce: 1,
        };
        assert_eq!(
            SignedTransaction::signing_payload(&tx),
            br#"["QUN_TX_V1","alice","bob",7,1]"#.to_vec()
        );
    }

    #[test]
    fn legacy_block_hash_matches_golden_vector() {
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 7,
            nonce: 1,
        };
        assert_eq!(
            Block::calculate_hash(1, 123, "prev", &[tx]),
            "d1a28b094516acbd71cd1adea9a0c1bca5b0792a4dc466788675da8f956c8e2d"
        );
    }

    #[test]
    fn signed_block_hash_matches_golden_vector() {
        let tx = Transaction {
            from: "alice".into(),
            to: "bob".into(),
            amount: 7,
            nonce: 1,
        };
        let signed = SignedTransaction {
            transaction: tx.clone(),
            public_key: "aa".into(),
            signature: "bb".into(),
        };
        assert_eq!(
            Block::calculate_signed_hash(1, 123, "prev", &[tx], &[signed]),
            "8f334016050a2e6d8edf20ff830040f1cba4f5fc54f086c0a11b60e0e3e17ce3"
        );
    }
}
