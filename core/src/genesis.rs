use crate::{LedgerError, LedgerState};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Explicit, deterministically hashed initial state for a QUN network.
///
/// This config is not yet committed into the block header/genesis block. That
/// protocol migration must happen before nodes can safely agree on network identity.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GenesisConfig {
    pub chain_id: String,
    pub protocol_version: u32,
    /// Ordered by key during serialization because BTreeMap is used.
    pub allocations: BTreeMap<String, u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GenesisConfigError {
    EmptyChainId,
    InvalidProtocolVersion,
    EmptyAddress,
    ZeroAllocation { address: String },
    TotalSupplyOverflow,
    InvalidAllocation(LedgerError),
}

impl GenesisConfig {
    pub fn new(
        chain_id: impl Into<String>,
        protocol_version: u32,
        allocations: BTreeMap<String, u64>,
    ) -> Result<Self, GenesisConfigError> {
        let config = Self {
            chain_id: chain_id.into(),
            protocol_version,
            allocations,
        };
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<(), GenesisConfigError> {
        if self.chain_id.trim().is_empty() {
            return Err(GenesisConfigError::EmptyChainId);
        }
        if self.protocol_version == 0 {
            return Err(GenesisConfigError::InvalidProtocolVersion);
        }
        for (address, amount) in &self.allocations {
            if address.trim().is_empty() {
                return Err(GenesisConfigError::EmptyAddress);
            }
            if *amount == 0 {
                return Err(GenesisConfigError::ZeroAllocation {
                    address: address.clone(),
                });
            }
        }
        self.total_supply()?;
        Ok(())
    }

    pub fn total_supply(&self) -> Result<u64, GenesisConfigError> {
        self.allocations.values().try_fold(0_u64, |total, amount| {
            total.checked_add(*amount).ok_or(GenesisConfigError::TotalSupplyOverflow)
        })
    }

    /// SHA-256 over a version-tagged JSON tuple with sorted allocation keys.
    /// Changing this encoding is a protocol change and requires new golden vectors.
    pub fn hash(&self) -> String {
        let payload = serde_json::to_vec(&(
            "QUN_GENESIS_CONFIG_V1",
            &self.chain_id,
            self.protocol_version,
            &self.allocations,
        ))
        .expect("serializing a fixed genesis config schema must succeed");
        let digest = Sha256::digest(payload);
        digest.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    pub fn initial_state(&self) -> Result<LedgerState, GenesisConfigError> {
        self.validate()?;
        let mut state = LedgerState::default();
        for (address, amount) in &self.allocations {
            state
                .set_genesis_balance(address.clone(), *amount)
                .map_err(GenesisConfigError::InvalidAllocation)?;
        }
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_hash_is_deterministic_and_commits_to_network_and_allocations() {
        let first = GenesisConfig::new(
            "qun-testnet",
            1,
            BTreeMap::from([("alice".to_owned(), 100), ("bob".to_owned(), 25)]),
        ).unwrap();
        let second = GenesisConfig::new(
            "qun-testnet",
            1,
            BTreeMap::from([("bob".to_owned(), 25), ("alice".to_owned(), 100)]),
        ).unwrap();
        let other_network = GenesisConfig::new(
            "qun-mainnet",
            1,
            BTreeMap::from([("alice".to_owned(), 100), ("bob".to_owned(), 25)]),
        ).unwrap();

        assert_eq!(first.hash(), second.hash());
        assert_ne!(first.hash(), other_network.hash());
        assert_eq!(first.total_supply(), Ok(125));
    }

    #[test]
    fn genesis_rejects_invalid_or_overflowing_allocations() {
        assert_eq!(
            GenesisConfig::new("", 1, BTreeMap::new()).unwrap_err(),
            GenesisConfigError::EmptyChainId
        );
        assert_eq!(
            GenesisConfig::new("qun-testnet", 0, BTreeMap::new()).unwrap_err(),
            GenesisConfigError::InvalidProtocolVersion
        );
        assert!(matches!(
            GenesisConfig::new(
                "qun-testnet",
                1,
                BTreeMap::from([("alice".to_owned(), u64::MAX), ("bob".to_owned(), 1)])
            ),
            Err(GenesisConfigError::TotalSupplyOverflow)
        ));
    }

    #[test]
    fn initial_state_matches_declared_allocations() {
        let config = GenesisConfig::new(
            "qun-testnet",
            1,
            BTreeMap::from([("alice".to_owned(), 42)]),
        ).unwrap();
        let state = config.initial_state().unwrap();
        assert_eq!(state.balances.get("alice"), Some(&42));
        assert!(state.nonces.is_empty());
    }
}
