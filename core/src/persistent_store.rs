//! Crash-conscious local persistence for the canonical QUN chain.
//!
//! This is a single-process disk store, not a distributed database. Loads verify the
//! chain from a caller-supplied trusted initial ledger and compare replayed state with
//! the integrity-checked snapshot before returning anything trusted.

use crate::{
    canonical_chain::{CanonicalChainError, CanonicalChainV1},
    snapshot::{LedgerSnapshotV1, SnapshotError, SNAPSHOT_VERSION},
    LedgerState,
};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub const STORE_VERSION: u16 = 1;
pub const MAX_STORE_BYTES: u64 = 64 * 1024 * 1024;
const STORE_DOMAIN: &str = "QUN_CANONICAL_NODE_STORE_V1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct StoreEnvelopeV1 {
    domain: String,
    version: u16,
    chain: CanonicalChainV1,
    snapshot: LedgerSnapshotV1,
}

#[derive(Debug, PartialEq, Eq)]
pub enum StoreError {
    Io(String),
    TooLarge,
    InvalidJson,
    UnsupportedVersion,
    InvalidChain(CanonicalChainError),
    InvalidSnapshot(SnapshotError),
    SnapshotDoesNotMatchChain,
    InitialLedgerMismatch,
}

pub struct CanonicalNodeStore;

impl CanonicalNodeStore {
    /// Atomically replace a local store after validating the chain and replayed ledger.
    /// initial_ledger is trusted configuration (e.g. a pinned testnet genesis state).
    pub fn save(
        path: impl AsRef<Path>,
        chain: &CanonicalChainV1,
        initial_ledger: &LedgerState,
        ledger: &LedgerState,
    ) -> Result<(), StoreError> {
        let replayed = chain
            .validate_and_replay(initial_ledger)
            .map_err(StoreError::InvalidChain)?;
        if &replayed != ledger {
            return Err(StoreError::InitialLedgerMismatch);
        }
        let height = chain.height().ok_or(StoreError::InvalidChain(CanonicalChainError::Empty))?;
        let hash = chain.tip_hash().ok_or(StoreError::InvalidChain(CanonicalChainError::Empty))?;
        let snapshot = LedgerSnapshotV1::capture(chain.network_id, height, hash, ledger)
            .map_err(StoreError::InvalidSnapshot)?;
        let envelope = StoreEnvelopeV1 {
            domain: STORE_DOMAIN.to_owned(),
            version: STORE_VERSION,
            chain: chain.clone(),
            snapshot,
        };
        let bytes = serde_json::to_vec(&envelope).map_err(|_| StoreError::InvalidJson)?;
        if bytes.len() as u64 > MAX_STORE_BYTES {
            return Err(StoreError::TooLarge);
        }
        atomic_replace(path.as_ref(), &bytes)
    }

    /// Load only if chain structure, every transaction, replayed state, and snapshot agree.
    pub fn load(
        path: impl AsRef<Path>,
        expected_network_id: &[u8; 32],
        initial_ledger: &LedgerState,
    ) -> Result<(CanonicalChainV1, LedgerState), StoreError> {
        let path = path.as_ref();
        let metadata = fs::metadata(path).map_err(io_error)?;
        if metadata.len() > MAX_STORE_BYTES {
            return Err(StoreError::TooLarge);
        }
        let file = File::open(path).map_err(io_error)?;
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        file.take(MAX_STORE_BYTES + 1).read_to_end(&mut bytes).map_err(io_error)?;
        if bytes.len() as u64 > MAX_STORE_BYTES {
            return Err(StoreError::TooLarge);
        }
        let envelope: StoreEnvelopeV1 =
            serde_json::from_slice(&bytes).map_err(|_| StoreError::InvalidJson)?;
        if envelope.domain != STORE_DOMAIN || envelope.version != STORE_VERSION {
            return Err(StoreError::UnsupportedVersion);
        }
        if &envelope.chain.network_id != expected_network_id {
            return Err(StoreError::SnapshotDoesNotMatchChain);
        }
        envelope.chain.validate_structure().map_err(StoreError::InvalidChain)?;
        envelope.snapshot.validate().map_err(StoreError::InvalidSnapshot)?;

        let height = envelope.chain.height().ok_or(StoreError::InvalidChain(CanonicalChainError::Empty))?;
        let hash = envelope.chain.tip_hash().ok_or(StoreError::InvalidChain(CanonicalChainError::Empty))?;
        if envelope.snapshot.version != SNAPSHOT_VERSION
            || envelope.snapshot.network_id != *expected_network_id
            || envelope.snapshot.height != height
            || envelope.snapshot.block_hash != hash
        {
            return Err(StoreError::SnapshotDoesNotMatchChain);
        }
        let replayed = envelope.chain
            .validate_and_replay(initial_ledger)
            .map_err(StoreError::InvalidChain)?;
        if replayed != envelope.snapshot.ledger {
            return Err(StoreError::SnapshotDoesNotMatchChain);
        }
        Ok((envelope.chain, replayed))
    }
}

fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), StoreError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(io_error)?;
        }
    }
    let temp = temporary_path(path);
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temp)
        .map_err(io_error)?;
    file.write_all(bytes).map_err(io_error)?;
    file.sync_all().map_err(io_error)?;
    drop(file);
    fs::rename(&temp, path).map_err(io_error)?;
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            if let Ok(directory) = File::open(parent) {
                let _ = directory.sync_all();
            }
        }
    }
    Ok(())
}

fn temporary_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".tmp");
    PathBuf::from(name)
}

fn io_error(error: std::io::Error) -> StoreError {
    StoreError::Io(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{canonical, versioned_block::CanonicalBlockV1, SignedTransaction, Transaction};
    use ed25519_dalek::{Signer, SigningKey};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file(label: &str) -> PathBuf {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("qun-{label}-{}-{stamp}.json", std::process::id()))
    }

    fn transfer(seed: u8, network: &[u8; 32]) -> SignedTransaction {
        let key = SigningKey::from_bytes(&[seed; 32]);
        let public = key.verifying_key().to_bytes();
        let address = hex::encode(public);
        let tx = Transaction { from: address.clone(), to: "receiver".into(), amount: 9, nonce: 1 };
        let payload = canonical::encode_transaction_payload(network, &public, &tx.to, tx.amount, tx.nonce).unwrap();
        SignedTransaction { transaction: tx, public_key: address, signature: hex::encode(key.sign(&payload).to_bytes()) }
    }

    #[test]
    fn store_round_trips_and_replays_after_restart() {
        let network = [91; 32];
        let mut chain = CanonicalChainV1::new(network);
        let key = SigningKey::from_bytes(&[92; 32]);
        let sender = hex::encode(key.verifying_key().as_bytes());
        let mut initial = LedgerState::default();
        initial.set_genesis_balance(sender, 50).unwrap();
        let block = CanonicalBlockV1::build(network, 1, 100, chain.tip_hash().unwrap(), vec![transfer(92, &network)]).unwrap();
        let mut ledger = initial.clone();
        chain.append_with_ledger(&mut ledger, block).unwrap();

        let path = temp_file("roundtrip");
        CanonicalNodeStore::save(&path, &chain, &initial, &ledger).unwrap();
        let (restored_chain, restored_ledger) = CanonicalNodeStore::load(&path, &network, &initial).unwrap();
        assert_eq!(restored_chain, chain);
        assert_eq!(restored_ledger, ledger);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn store_rejects_truncation_and_wrong_network() {
        let network = [93; 32];
        let chain = CanonicalChainV1::new(network);
        let initial = LedgerState::default();
        let path = temp_file("corrupt");
        CanonicalNodeStore::save(&path, &chain, &initial, &initial).unwrap();
        fs::write(&path, b"{").unwrap();
        assert_eq!(CanonicalNodeStore::load(&path, &network, &initial), Err(StoreError::InvalidJson));

        CanonicalNodeStore::save(&path, &chain, &initial, &initial).unwrap();
        assert_eq!(CanonicalNodeStore::load(&path, &[94; 32], &initial), Err(StoreError::SnapshotDoesNotMatchChain));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn store_rejects_ledger_not_matching_chain_replay() {
        let network = [95; 32];
        let chain = CanonicalChainV1::new(network);
        let initial = LedgerState::default();
        let mut wrong_ledger = initial.clone();
        wrong_ledger.set_genesis_balance("unverified", 5).unwrap();
        assert_eq!(CanonicalNodeStore::save(temp_file("wrong-ledger"), &chain, &initial, &wrong_ledger), Err(StoreError::InitialLedgerMismatch));
    }
}
