use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Transaction {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub nonce: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Block {
    pub index: u64,
    pub timestamp: u64,
    pub previous_hash: String,
    pub transactions: Vec<Transaction>,
    pub hash: String,
}

impl Block {
    pub fn calculate_hash(index: u64, timestamp: u64, previous_hash: &str, transactions: &[Transaction]) -> String {
        // Stable field order; JSON serialization is used only for this fixed struct schema.
        let payload = serde_json::to_vec(&(index, timestamp, previous_hash, transactions))
            .expect("serializing a fixed QUN block payload must succeed");
        let digest = Sha256::digest(payload);
        digest.iter().map(|b| format!("{b:02x}")).collect()
    }

    fn new(index: u64, timestamp: u64, previous_hash: String, transactions: Vec<Transaction>) -> Self {
        let hash = Self::calculate_hash(index, timestamp, &previous_hash, &transactions);
        Self { index, timestamp, previous_hash, transactions, hash }
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
}

impl Chain {
    pub fn new() -> Self {
        Self { blocks: vec![Block::new(0, 0, "QUN_GENESIS_V1".into(), vec![])] }
    }

    pub fn append(&mut self, timestamp: u64, transactions: Vec<Transaction>) -> &Block {
        let previous = self.blocks.last().expect("Chain::new always creates genesis");
        let block = Block::new(previous.index + 1, timestamp, previous.hash.clone(), transactions);
        self.blocks.push(block);
        self.blocks.last().expect("block was just appended")
    }

    pub fn validate(&self) -> Result<(), ChainError> {
        let Some(genesis) = self.blocks.first() else { return Err(ChainError::Empty) };
        if genesis.index != 0 || genesis.timestamp != 0 || genesis.previous_hash != "QUN_GENESIS_V1"
            || !genesis.transactions.is_empty()
            || genesis.hash != Block::calculate_hash(genesis.index, genesis.timestamp, &genesis.previous_hash, &genesis.transactions) {
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
            if current.hash != Block::calculate_hash(current.index, current.timestamp, &current.previous_hash, &current.transactions) {
                return Err(ChainError::InvalidHash { at: i });
            }
        }
        Ok(())
    }
}

impl Default for Chain {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_chain_is_valid() {
        assert!(Chain::new().validate().is_ok());
    }

    #[test]
    fn append_links_blocks() {
        let mut chain = Chain::new();
        chain.append(1, vec![Transaction { from: "alice".into(), to: "bob".into(), amount: 5, nonce: 1 }]);
        assert_eq!(chain.blocks.len(), 2);
        assert!(chain.validate().is_ok());
    }

    #[test]
    fn detects_modified_transaction() {
        let mut chain = Chain::new();
        chain.append(1, vec![Transaction { from: "alice".into(), to: "bob".into(), amount: 5, nonce: 1 }]);
        chain.blocks[1].transactions[0].amount = 500;
        assert_eq!(chain.validate(), Err(ChainError::InvalidHash { at: 1 }));
    }

    #[test]
    fn detects_broken_link() {
        let mut chain = Chain::new();
        chain.append(1, vec![]);
        chain.blocks[1].previous_hash = "broken".into();
        assert_eq!(chain.validate(), Err(ChainError::InvalidPreviousHash { at: 1 }));
    }
}
