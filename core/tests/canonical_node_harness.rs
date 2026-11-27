//! Deterministic multi-node acceptance tests for canonical QUN v1 blocks.
//!
//! These tests model independent validators receiving the same block and checking it
//! against their own local chain tip. They do not simulate peer-to-peer networking or consensus.

use ed25519_dalek::{Signer, SigningKey};
use qun_core::{canonical, versioned_block::CanonicalBlockV1, SignedTransaction, Transaction};

#[derive(Clone, Copy)]
struct ValidatorView {
    network_id: [u8; 32],
    next_height: u64,
    tip_hash: [u8; 32],
}

impl ValidatorView {
    fn accept(&self, block: &CanonicalBlockV1) -> bool {
        block.validate(&self.network_id, self.next_height, &self.tip_hash).is_ok()
    }
}

fn signed_transfer(seed: u8, network_id: &[u8; 32], recipient: &str, amount: u64) -> SignedTransaction {
    let key = SigningKey::from_bytes(&[seed; 32]);
    let public_key_bytes = key.verifying_key().to_bytes();
    let public_key = hex::encode(public_key_bytes);
    let transaction = Transaction {
        from: public_key.clone(),
        to: recipient.to_owned(),
        amount,
        nonce: 1,
    };
    let payload = canonical::encode_transaction_payload(
        network_id, &public_key_bytes, &transaction.to, transaction.amount, transaction.nonce,
    ).expect("fixture transaction must have a valid canonical encoding");

    SignedTransaction {
        transaction,
        public_key,
        signature: hex::encode(key.sign(&payload).to_bytes()),
    }
}

#[test]
fn independent_validators_agree_on_block_hash_and_acceptance() {
    let network_id = [21; 32];
    let tip_hash = [22; 32];
    let txs = vec![
        signed_transfer(23, &network_id, "alice", 5),
        signed_transfer(24, &network_id, "bob", 8),
    ];
    let block_a = CanonicalBlockV1::build(
        network_id, 1, 1_800_000_000, tip_hash, txs.clone(),
    ).expect("valid fixture block should build");
    // Independently reconstruct the same block, as a second node would.
    let block_b = CanonicalBlockV1::build(
        network_id, 1, 1_800_000_000, tip_hash, txs,
    ).expect("same inputs should produce the same block");

    let node_a = ValidatorView { network_id, next_height: 1, tip_hash };
    let node_b = ValidatorView { network_id, next_height: 1, tip_hash };
    assert_eq!(block_a.hash, block_b.hash);
    assert!(node_a.accept(&block_a));
    assert!(node_b.accept(&block_b));

    // A JSON transport round-trip must not change the block received by another node.
    let wire = serde_json::to_vec(&block_a).expect("block serializes");
    let received: CanonicalBlockV1 = serde_json::from_slice(&wire).expect("block deserializes");
    assert_eq!(received, block_a);
    assert!(node_b.accept(&received));
}

#[test]
fn validators_reject_block_when_their_local_chain_tip_diverges() {
    let network_id = [31; 32];
    let common_parent = [32; 32];
    let block = CanonicalBlockV1::build(
        network_id, 7, 1_800_000_001, common_parent,
        vec![signed_transfer(33, &network_id, "recipient", 3)],
    ).expect("valid fixture block should build");

    let matching_node = ValidatorView { network_id, next_height: 7, tip_hash: common_parent };
    let divergent_node = ValidatorView { network_id, next_height: 7, tip_hash: [34; 32] };
    assert!(matching_node.accept(&block));
    assert!(!divergent_node.accept(&block));
}

#[test]
fn validators_reject_wrong_network_height_and_tampered_transaction() {
    let network_id = [41; 32];
    let parent = [42; 32];
    let block = CanonicalBlockV1::build(
        network_id, 2, 1_800_000_002, parent,
        vec![signed_transfer(43, &network_id, "recipient", 9)],
    ).expect("valid fixture block should build");

    assert!(!ValidatorView { network_id: [44; 32], next_height: 2, tip_hash: parent }.accept(&block));
    assert!(!ValidatorView { network_id, next_height: 3, tip_hash: parent }.accept(&block));

    let mut tampered = block;
    tampered.transactions[0].transaction.amount += 1;
    assert!(!ValidatorView { network_id, next_height: 2, tip_hash: parent }.accept(&tampered));
}
