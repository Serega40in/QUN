//! Explicit versioned canonical block envelope for the QUN v1 protocol.
//!
//! This type is additive and does not replace the legacy `Chain` format. It verifies
//! canonical transaction signatures and the deterministic block hash, but deliberately
//! does not define consensus, persistence, or state-transition policy.

use crate::{canonical, SignatureError, SignedTransaction};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VersionedBlockError {
    WrongNetwork,
    WrongHeight,
    WrongParent,
    TooManyTransactions,
    InvalidSignature { at: usize, error: SignatureError },
    InvalidSignatureEncoding { at: usize },
    InvalidCanonicalPayload,
    InvalidHash,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanonicalBlockV1 {
    pub network_id: [u8; 32],
    pub height: u64,
    pub timestamp: u64,
    pub parent_hash: [u8; 32],
    pub transactions: Vec<SignedTransaction>,
    pub hash: [u8; 32],
}

impl CanonicalBlockV1 {
    /// Build a v1 block only after authenticating each transaction for this network.
    pub fn build(
        network_id: [u8; 32],
        height: u64,
        timestamp: u64,
        parent_hash: [u8; 32],
        transactions: Vec<SignedTransaction>,
    ) -> Result<Self, VersionedBlockError> {
        if transactions.len() > canonical::MAX_TRANSACTIONS_PER_BLOCK {
            return Err(VersionedBlockError::TooManyTransactions);
        }

        let mut payloads = Vec::with_capacity(transactions.len());
        let mut signatures = Vec::with_capacity(transactions.len());
        for (at, signed) in transactions.iter().enumerate() {
            signed.verify_canonical(&network_id).map_err(|error| {
                VersionedBlockError::InvalidSignature { at, error }
            })?;
            payloads.push(
                canonical::encode_transaction(&network_id, &signed.transaction)
                    .map_err(|_| VersionedBlockError::InvalidCanonicalPayload)?,
            );
            let signature_bytes = hex::decode(&signed.signature)
                .map_err(|_| VersionedBlockError::InvalidSignatureEncoding { at })?;
            let signature: [u8; 64] = signature_bytes
                .try_into()
                .map_err(|_| VersionedBlockError::InvalidSignatureEncoding { at })?;
            signatures.push(signature);
        }

        let payload = canonical::encode_block_payload(
            &network_id,
            height,
            timestamp,
            &parent_hash,
            &payloads,
            &signatures,
        )
        .map_err(|_| VersionedBlockError::InvalidCanonicalPayload)?;
        let hash = canonical::hash_block_payload(&payload);
        Ok(Self {
            network_id,
            height,
            timestamp,
            parent_hash,
            transactions,
            hash,
        })
    }

    /// Validate network, expected chain position, transaction signatures and block hash.
    pub fn validate(
        &self,
        expected_network_id: &[u8; 32],
        expected_height: u64,
        expected_parent_hash: &[u8; 32],
    ) -> Result<(), VersionedBlockError> {
        if &self.network_id != expected_network_id {
            return Err(VersionedBlockError::WrongNetwork);
        }
        if self.height != expected_height {
            return Err(VersionedBlockError::WrongHeight);
        }
        if &self.parent_hash != expected_parent_hash {
            return Err(VersionedBlockError::WrongParent);
        }
        let rebuilt = Self::build(
            self.network_id,
            self.height,
            self.timestamp,
            self.parent_hash,
            self.transactions.clone(),
        )?;
        if rebuilt.hash != self.hash {
            return Err(VersionedBlockError::InvalidHash);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{canonical, Transaction};
    use ed25519_dalek::{Signer, SigningKey};

    fn signed_transfer(seed: u8, network_id: &[u8; 32]) -> SignedTransaction {
        let key = SigningKey::from_bytes(&[seed; 32]);
        let public_key_bytes = key.verifying_key().to_bytes();
        let public_key = hex::encode(public_key_bytes);
        let transaction = Transaction {
            from: public_key.clone(),
            to: "recipient".into(),
            amount: 7,
            nonce: 1,
        };
        let payload = canonical::encode_transaction_payload(
            network_id,
            &public_key_bytes,
            &transaction.to,
            transaction.amount,
            transaction.nonce,
        ).unwrap();
        SignedTransaction {
            transaction,
            public_key,
            signature: hex::encode(key.sign(&payload).to_bytes()),
        }
    }

    #[test]
    fn canonical_block_builds_and_validates_expected_parent() {
        let network = [7; 32];
        let parent = [8; 32];
        let block = CanonicalBlockV1::build(
            network, 1, 123, parent, vec![signed_transfer(9, &network)],
        ).unwrap();
        assert!(block.validate(&network, 1, &parent).is_ok());
        assert_eq!(
            block.validate(&network, 2, &parent),
            Err(VersionedBlockError::WrongHeight)
        );
        assert_eq!(
            block.validate(&network, 1, &[3; 32]),
            Err(VersionedBlockError::WrongParent)
        );
    }

    #[test]
    fn canonical_block_rejects_wrong_network_and_transaction_tampering() {
        let network = [10; 32];
        let parent = [11; 32];
        let block = CanonicalBlockV1::build(
            network, 1, 123, parent, vec![signed_transfer(12, &network)],
        ).unwrap();
        assert_eq!(
            block.validate(&[13; 32], 1, &parent),
            Err(VersionedBlockError::WrongNetwork)
        );

        let mut tampered = block;
        tampered.transactions[0].transaction.amount += 1;
        assert!(matches!(
            tampered.validate(&network, 1, &parent),
            Err(VersionedBlockError::InvalidSignature { at: 0, .. })
        ));
    }

    #[test]
    fn canonical_block_hash_commits_to_signature_envelope() {
        let network = [14; 32];
        let parent = [15; 32];
        let tx = signed_transfer(16, &network);
        let block_a = CanonicalBlockV1::build(network, 1, 123, parent, vec![tx.clone()]).unwrap();
        let mut other = tx;
        other.signature = hex::encode([0_u8; 64]);
        assert!(CanonicalBlockV1::build(network, 1, 123, parent, vec![other]).is_err());
        assert_ne!(block_a.hash, [0; 32]);
    }
}
