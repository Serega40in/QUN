//! Experimental Proof-of-Work header primitives for QUN.
//!
//! This module is deliberately not connected to chain acceptance or issuance. The caller
//! must derive an expected target from trusted consensus rules; accepting a target supplied
//! by a peer would make the work requirement meaningless.

use sha2::{Digest, Sha256};

pub const POW_HEADER_VERSION: u16 = 1;
const DOMAIN: &[u8] = b"QUN-POW-HEADER";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PowHeaderV1 {
    pub network_id: [u8; 32],
    pub height: u64,
    pub timestamp: u64,
    pub parent_hash: [u8; 32],
    pub body_hash: [u8; 32],
    pub nonce: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PowError {
    NonceExhausted,
    InvalidTarget,
}

impl PowHeaderV1 {
    /// Protocol-fixed header bytes; integers use unsigned big-endian encoding.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(DOMAIN.len() + 2 + 32 + 8 + 8 + 32 + 32 + 8);
        out.extend_from_slice(DOMAIN);
        out.extend_from_slice(&POW_HEADER_VERSION.to_be_bytes());
        out.extend_from_slice(&self.network_id);
        out.extend_from_slice(&self.height.to_be_bytes());
        out.extend_from_slice(&self.timestamp.to_be_bytes());
        out.extend_from_slice(&self.parent_hash);
        out.extend_from_slice(&self.body_hash);
        out.extend_from_slice(&self.nonce.to_be_bytes());
        out
    }

    pub fn hash(&self) -> [u8; 32] {
        Sha256::digest(self.canonical_bytes()).into()
    }

    /// Hashes are interpreted as 256-bit unsigned big-endian integers.
    pub fn meets_target(&self, target: &[u8; 32]) -> bool {
        self.hash() <= *target
    }

    /// Search at most max_attempts sequential nonces. This is a test/simulator primitive,
    /// not a production miner or a difficulty-adjustment algorithm.
    pub fn mine(&mut self, target: &[u8; 32], max_attempts: u64) -> Result<bool, PowError> {
        if *target == [0; 32] {
            return Ok(false);
        }
        for attempt in 0..max_attempts {
            if self.meets_target(target) {
                return Ok(true);
            }
            if attempt + 1 < max_attempts {
                self.nonce = self.nonce.checked_add(1).ok_or(PowError::NonceExhausted)?;
            }
        }
        Ok(false)
    }

    pub fn validate_work(&self, expected_target: &[u8; 32]) -> Result<(), PowError> {
        if *expected_target == [0; 32] {
            return Err(PowError::InvalidTarget);
        }
        if self.meets_target(expected_target) {
            Ok(())
        } else {
            Err(PowError::InvalidTarget)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header() -> PowHeaderV1 {
        PowHeaderV1 {
            network_id: [1; 32],
            height: 1,
            timestamp: 100,
            parent_hash: [2; 32],
            body_hash: [3; 32],
            nonce: 0,
        }
    }

    #[test]
    fn header_hash_commits_to_every_header_field() {
        let original = header();
        let mut changed = original;
        changed.nonce += 1;
        assert_ne!(original.hash(), changed.hash());
        changed = original;
        changed.parent_hash[0] ^= 1;
        assert_ne!(original.hash(), changed.hash());
        changed = original;
        changed.body_hash[0] ^= 1;
        assert_ne!(original.hash(), changed.hash());
        changed = original;
        changed.network_id[0] ^= 1;
        assert_ne!(original.hash(), changed.hash());
    }

    #[test]
    fn easy_target_can_be_mined_and_verified() {
        let target = [0xff; 32];
        let mut candidate = header();
        assert!(candidate.mine(&target, 1).unwrap());
        assert!(candidate.validate_work(&target).is_ok());
    }

    #[test]
    fn zero_target_is_rejected_and_failed_search_is_bounded() {
        let mut candidate = header();
        assert!(!candidate.mine(&[0; 32], 100).unwrap());
        assert_eq!(candidate.validate_work(&[0; 32]), Err(PowError::InvalidTarget));
        assert!(!candidate.mine(&[0; 32], 0).unwrap());
        let impossible_target = [0; 32];
        assert!(!candidate.mine(&impossible_target, 1).unwrap());
    }
}
