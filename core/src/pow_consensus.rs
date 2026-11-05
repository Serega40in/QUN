//! First-step consensus validation for QUN PoW headers.
//!
//! This module validates a header against locally supplied consensus history and a fixed
//! target. It is intentionally not a complete chain-selection engine: difficulty retargeting,
//! block-body/state integration, issuance, persistence, and P2P remain separate gates.

use crate::pow::{PowError, PowHeaderV1};
use crate::pow_work::{work_from_target, Work256, WorkError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PowConsensusParamsV1 {
    pub network_id: [u8; 32],
    /// Fixed target for the prototype. Production must derive this from validated history.
    pub target: [u8; 32],
    pub median_time_window: usize,
    pub max_future_drift_secs: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConsensusError {
    InvalidParameters,
    WrongNetwork,
    WrongHeight,
    WrongParent,
    TimestampNotAfterMedian,
    TimestampTooFarInFuture,
    InvalidProofOfWork(PowError),
    InvalidWorkTarget(WorkError),
}

impl PowConsensusParamsV1 {
    pub fn validate(&self) -> Result<(), ConsensusError> {
        if self.target == [0; 32]
            || self.target[0] & 0x80 != 0
            || self.median_time_window == 0
        {
            return Err(ConsensusError::InvalidParameters);
        }
        Ok(())
    }

    /// Validate a non-genesis header. past_timestamps must contain only timestamps from
    /// the already validated ancestor chain, in any order; only the newest window is needed
    /// by the caller. now_secs is the node's current Unix time.
    ///
    /// Returns the independently derived work contribution. The target is never read from
    /// the peer's header, preventing peers from lowering their own work requirement.
    pub fn validate_header(
        &self,
        header: &PowHeaderV1,
        expected_height: u64,
        expected_parent: &[u8; 32],
        past_timestamps: &[u64],
        now_secs: u64,
    ) -> Result<Work256, ConsensusError> {
        self.validate()?;
        if header.network_id != self.network_id {
            return Err(ConsensusError::WrongNetwork);
        }
        if header.height != expected_height || expected_height == 0 {
            return Err(ConsensusError::WrongHeight);
        }
        if &header.parent_hash != expected_parent {
            return Err(ConsensusError::WrongParent);
        }

        let start = past_timestamps.len().saturating_sub(self.median_time_window);
        let mut recent = past_timestamps[start..].to_vec();
        recent.sort_unstable();
        if !recent.is_empty() && header.timestamp <= recent[recent.len() / 2] {
            return Err(ConsensusError::TimestampNotAfterMedian);
        }

        let latest_allowed = now_secs.checked_add(self.max_future_drift_secs)
            .unwrap_or(u64::MAX);
        if header.timestamp > latest_allowed {
            return Err(ConsensusError::TimestampTooFarInFuture);
        }

        header.validate_work(&self.target)
            .map_err(ConsensusError::InvalidProofOfWork)?;
        work_from_target(&self.target).map_err(ConsensusError::InvalidWorkTarget)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> PowConsensusParamsV1 {
        PowConsensusParamsV1 {
            network_id: [1; 32],
            target: { let mut t = [0xff; 32]; t[0] = 0x7f; t },
            median_time_window: 3,
            max_future_drift_secs: 60,
        }
    }

    fn header() -> PowHeaderV1 {
        PowHeaderV1 {
            network_id: [1; 32],
            height: 4,
            timestamp: 104,
            parent_hash: [2; 32],
            body_hash: [3; 32],
            nonce: 0,
        }
    }

    #[test]
    fn accepts_header_and_derives_work_from_local_target() {
        let p = params();
        let mut h = header();
        assert!(h.mine(&p.target, 100).unwrap());
        let work = p.validate_header(&h, 4, &[2; 32], &[100, 101, 102], 104).unwrap();
        assert_eq!(work, work_from_target(&p.target).unwrap());
    }

    #[test]
    fn rejects_wrong_network_parent_height_and_time() {
        let p = params();
        let mut h = header();
        h.network_id = [9; 32];
        assert_eq!(p.validate_header(&h, 4, &[2; 32], &[], 104), Err(ConsensusError::WrongNetwork));

        h = header();
        assert_eq!(p.validate_header(&h, 4, &[8; 32], &[], 104), Err(ConsensusError::WrongParent));
        assert_eq!(p.validate_header(&h, 5, &[2; 32], &[], 104), Err(ConsensusError::WrongHeight));

        h = header();
        h.timestamp = 101;
        assert_eq!(p.validate_header(&h, 4, &[2; 32], &[100, 101, 102], 104), Err(ConsensusError::TimestampNotAfterMedian));

        h = header();
        h.timestamp = 200;
        assert_eq!(p.validate_header(&h, 4, &[2; 32], &[], 104), Err(ConsensusError::TimestampTooFarInFuture));
    }

    #[test]
    fn rejects_invalid_fixed_target_parameters() {
        let mut p = params();
        p.target = [0; 32];
        assert_eq!(p.validate(), Err(ConsensusError::InvalidParameters));
        p = params();
        p.median_time_window = 0;
        assert_eq!(p.validate(), Err(ConsensusError::InvalidParameters));
    }
}
