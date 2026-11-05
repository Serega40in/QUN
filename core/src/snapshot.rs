//! Versioned, integrity-checked ledger snapshots for local persistence.
//!
//! The checksum detects accidental/casual corruption; it is not a signature and does
//! not prove that the snapshot follows a valid chain. Callers must validate chain
//! history and the snapshot's network/height/block hash before trusting restored state.

use crate::LedgerState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub const SNAPSHOT_VERSION: u16 = 1;
pub const MAX_ACCOUNTS: usize = 100_000;
pub const MAX_ADDRESS_BYTES: usize = 128;
const DOMAIN: &[u8] = b"QUN-STATE-SNAPSHOT";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LedgerSnapshotV1 {
    pub version: u16,
    pub network_id: [u8; 32],
    pub height: u64,
    pub block_hash: [u8; 32],
    pub ledger: LedgerState,
    pub checksum: [u8; 32],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotError {
    UnsupportedVersion,
    TooManyAccounts,
    InvalidAddress,
    LengthOverflow,
    Truncated,
    TrailingBytes,
    InvalidJson,
    ChecksumMismatch,
}

impl LedgerSnapshotV1 {
    pub fn capture(
        network_id: [u8; 32],
        height: u64,
        block_hash: [u8; 32],
        ledger: &LedgerState,
    ) -> Result<Self, SnapshotError> {
        let mut snapshot = Self {
            version: SNAPSHOT_VERSION,
            network_id,
            height,
            block_hash,
            ledger: ledger.clone(),
            checksum: [0; 32],
        };
        snapshot.validate_fields()?;
        snapshot.checksum = Sha256::digest(snapshot.payload()?).into();
        Ok(snapshot)
    }

    pub fn validate(&self) -> Result<(), SnapshotError> {
        if self.version != SNAPSHOT_VERSION {
            return Err(SnapshotError::UnsupportedVersion);
        }
        self.validate_fields()?;
        let expected: [u8; 32] = Sha256::digest(self.payload()?).into();
        if expected != self.checksum {
            return Err(SnapshotError::ChecksumMismatch);
        }
        Ok(())
    }

    pub fn to_json(&self) -> Result<String, SnapshotError> {
        self.validate()?;
        serde_json::to_string(self).map_err(|_| SnapshotError::InvalidJson)
    }

    pub fn from_json(json: &str) -> Result<Self, SnapshotError> {
        let snapshot: Self =
            serde_json::from_str(json).map_err(|_| SnapshotError::InvalidJson)?;
        snapshot.validate()?;
        Ok(snapshot)
    }

    fn validate_fields(&self) -> Result<(), SnapshotError> {
        for map in [&self.ledger.balances, &self.ledger.nonces] {
            if map.len() > MAX_ACCOUNTS {
                return Err(SnapshotError::TooManyAccounts);
            }
            for address in map.keys() {
                if address.trim().is_empty() || address.len() > MAX_ADDRESS_BYTES {
                    return Err(SnapshotError::InvalidAddress);
                }
            }
        }
        Ok(())
    }

    fn payload(&self) -> Result<Vec<u8>, SnapshotError> {
        let mut out = Vec::new();
        out.extend_from_slice(DOMAIN);
        out.extend_from_slice(&self.version.to_be_bytes());
        out.extend_from_slice(&self.network_id);
        out.extend_from_slice(&self.height.to_be_bytes());
        out.extend_from_slice(&self.block_hash);
        encode_map(&mut out, &self.ledger.balances)?;
        encode_map(&mut out, &self.ledger.nonces)?;
        Ok(out)
    }
}

fn encode_map(out: &mut Vec<u8>, map: &BTreeMap<String, u64>) -> Result<(), SnapshotError> {
    let count = u32::try_from(map.len()).map_err(|_| SnapshotError::LengthOverflow)?;
    out.extend_from_slice(&count.to_be_bytes());
    for (address, value) in map {
        let len = u32::try_from(address.len()).map_err(|_| SnapshotError::LengthOverflow)?;
        out.extend_from_slice(&len.to_be_bytes());
        out.extend_from_slice(address.as_bytes());
        out.extend_from_slice(&value.to_be_bytes());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_round_trips_and_checks_integrity() {
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance("alice", 120).unwrap();
        ledger.nonces.insert("alice".into(), 3);
        let snapshot = LedgerSnapshotV1::capture([7; 32], 9, [8; 32], &ledger).unwrap();
        let json = snapshot.to_json().unwrap();
        let restored = LedgerSnapshotV1::from_json(&json).unwrap();
        assert_eq!(restored, snapshot);
        assert_eq!(restored.ledger, ledger);
    }

    #[test]
    fn snapshot_rejects_modified_ledger_data() {
        let mut ledger = LedgerState::default();
        ledger.set_genesis_balance("alice", 120).unwrap();
        let mut snapshot = LedgerSnapshotV1::capture([7; 32], 9, [8; 32], &ledger).unwrap();
        snapshot.ledger.balances.insert("alice".into(), 121);
        assert_eq!(snapshot.validate(), Err(SnapshotError::ChecksumMismatch));
    }

    #[test]
    fn snapshot_rejects_unsupported_version() {
        let ledger = LedgerState::default();
        let mut snapshot = LedgerSnapshotV1::capture([7; 32], 9, [8; 32], &ledger).unwrap();
        snapshot.version = 2;
        assert_eq!(snapshot.validate(), Err(SnapshotError::UnsupportedVersion));
    }

    #[test]
    fn snapshot_rejects_invalid_addresses() {
        let mut ledger = LedgerState::default();
        ledger.balances.insert(" ".into(), 1);
        assert_eq!(
            LedgerSnapshotV1::capture([7; 32], 9, [8; 32], &ledger),
            Err(SnapshotError::InvalidAddress)
        );
    }
}
