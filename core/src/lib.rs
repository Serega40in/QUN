pub mod canonical;

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
    InvalidCanonicalPayload,
}

impl SignedTransaction {
    /// Canonical, domain-separated payload. Field order and domain are protocol constants.
    pub fn signing_payload(tx: &Transaction) -> Vec<u8> {
        serde_json::to_vec(&("QUN_TX_V1", &tx.from, &tx.to, tx.amount, tx.nonce))
            .expect("serializing a fixed QUN transaction payload must succeed")
    }

    /// Verify an Ed25519 signature over canonical v1 bytes bound to a network ID.
    ///
    /// This is opt-in during migration: the legacy verify() and persisted block hashes
    /// remain unchanged until the v1 protocol is explicitly activated.
    pub fn verify_canonical(&self, network_id: &[u8; 32]) -> Result<(), SignatureError> {
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
        let payload = canonical::encode_transaction_payload(
            network_id,
            &public_key_array,
            &self.transaction.to,
            self.transaction.amount,
            self.transaction.nonce,
        ).map_err(|_| SignatureError::InvalidCanonicalPayload)?;
        let signature_bytes = hex::decode(&self.signature)
            .map_err(|_| SignatureError::InvalidSignatureEncoding)?;
        let signature = Signature::from_slice(&signature_bytes)
            .map_err(|_| SignatureError::InvalidSignatureEncoding)?;
        verifying_key.verify(&payload, &signature)
            .map_err(|_| SignatureError::InvalidSignature)
    }

    /// Verify sender ownership and the Ed25519 signature over the legacy payload.
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

/// Failure while authenticating and applying a network-bound transaction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthenticatedLedgerError {
    InvalidSignature(SignatureError),
    InvalidTransition(LedgerError),
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

    /// Verify a network-bound canonical signature and atomically apply its transfer.
    ///
    /// The sender address must be the transaction's Ed25519 public-key hex. State is
    /// mutated only after authentication and transition validation both succeed.
    pub fn apply_signed_canonical(
        &mut self,
        signed: &SignedTransaction,
        network_id: &[u8; 32],
    ) -> Result<(), AuthenticatedLedgerError> {
        signed
            .verify_canonical(network_id)
            .map_err(AuthenticatedLedgerError::InvalidSignature)?;

        let mut staged = self.clone();
        staged
            .apply(&signed.transaction)
            .map_err(AuthenticatedLedgerError::InvalidTransition)?;
        *self = staged;
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
    fn canonical_signature_is_bound_to_network_and_transaction_fields() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing_key = SigningKey::from_bytes(&[17_u8; 32]);
        let public_key_bytes = signing_key.verifying_key().to_bytes();
        let public_key = hex::encode(public_key_bytes);
        let network = [1_u8; 32];
        let transaction = Transaction {
            from: public_key.clone(),
            to: "recipient-demo".into(),
            amount: 42,
            nonce: 1,
        };
        let payload = canonical::encode_transaction_payload(
            &network, &public_key_bytes, &transaction.to, transaction.amount, transaction.nonce,
        ).unwrap();
        let signature = signing_key.sign(&payload);
        let signed = SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signature.to_bytes()),
        };

        assert_eq!(signed.verify_canonical(&network), Ok(()));
        assert_eq!(signed.verify_canonical(&[2_u8; 32]), Err(SignatureError::InvalidSignature));

        let mut tampered = signed.clone();
        tampered.transaction.amount += 1;
        assert_eq!(tampered.verify_canonical(&network), Err(SignatureError::InvalidSignature));
    }

    #[test]
    fn canonical_signature_rejects_oversized_recipient() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing_key = SigningKey::from_bytes(&[18_u8; 32]);
        let public_key = hex::encode(signing_key.verifying_key().as_bytes());
        let transaction = Transaction {
            from: public_key.clone(),
            to: "x".repeat(canonical::MAX_RECIPIENT_BYTES + 1),
            amount: 1,
            nonce: 1,
        };
        let signed = SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signing_key.sign(b"placeholder").to_bytes()),
        };
        assert_eq!(
            signed.verify_canonical(&[1_u8; 32]),
            Err(SignatureError::InvalidCanonicalPayload)
        );
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

    fn canonical_signed_transfer(seed: u8, to: &str, amount: u64, nonce: u64, network: &[u8; 32]) -> SignedTransaction {
        use ed25519_dalek::{Signer, SigningKey};

        let signing_key = SigningKey::from_bytes(&[seed; 32]);
        let public_key_bytes = signing_key.verifying_key().to_bytes();
        let public_key = hex::encode(public_key_bytes);
        let transaction = Transaction {
            from: public_key.clone(),
            to: to.into(),
            amount,
            nonce,
        };
        let payload = canonical::encode_transaction_payload(
            network, &public_key_bytes, &transaction.to, transaction.amount, transaction.nonce,
        ).unwrap();
        SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(signing_key.sign(&payload).to_bytes()),
        }
    }

    #[test]
    fn authenticated_ledger_applies_only_valid_network_bound_transfers() {
        let network = [42_u8; 32];
        let signed = canonical_signed_transfer(31, "recipient", 25, 1, &network);
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance(&signed.transaction.from, 100).unwrap();

        assert_eq!(ledger.apply_signed_canonical(&signed, &network), Ok(()));
        assert_eq!(ledger.balances.get(&signed.transaction.from), Some(&75));
        assert_eq!(ledger.balances.get("recipient"), Some(&25));
        assert_eq!(ledger.nonces.get(&signed.transaction.from), Some(&1));
    }

    #[test]
    fn authenticated_ledger_rejects_wrong_network_without_mutation() {
        let signed = canonical_signed_transfer(32, "recipient", 25, 1, &[1_u8; 32]);
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance(&signed.transaction.from, 100).unwrap();
        let before = ledger.clone();

        assert_eq!(
            ledger.apply_signed_canonical(&signed, &[2_u8; 32]),
            Err(AuthenticatedLedgerError::InvalidSignature(SignatureError::InvalidSignature))
        );
        assert_eq!(ledger, before);
    }

    #[test]
    fn authenticated_ledger_rejects_insufficient_funds_without_mutation() {
        let network = [43_u8; 32];
        let signed = canonical_signed_transfer(33, "recipient", 101, 1, &network);
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance(&signed.transaction.from, 100).unwrap();
        let before = ledger.clone();

        assert_eq!(
            ledger.apply_signed_canonical(&signed, &network),
            Err(AuthenticatedLedgerError::InvalidTransition(LedgerError::InsufficientFunds {
                available: 100,
                required: 101,
            }))
        );
        assert_eq!(ledger, before);
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
