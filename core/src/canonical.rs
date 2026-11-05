//! Versioned canonical byte encoding for QUN Core.
//!
//! This module is additive: existing JSON-based hashes/signatures are unchanged.
//! Do not use these v1 payloads for consensus until network/genesis parameters are pinned.

use crate::Transaction;
use sha2::{Digest, Sha256};

pub const PROTOCOL_VERSION: u16 = 1;
pub const MAX_RECIPIENT_BYTES: usize = 128;
pub const MAX_TRANSACTIONS_PER_BLOCK: usize = 1_024;
pub const MAX_ENCODED_BLOCK_BYTES: usize = 1_048_576;
const TX_DOMAIN: &[u8] = b"QUN-TX";
const BLOCK_DOMAIN: &[u8] = b"QUN-BLOCK";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EncodingError {
    RecipientTooLong,
    InvalidRecipientUtf8,
    InvalidPublicKey,
    InvalidHash,
    InvalidTransactionPayload,
    NetworkMismatch,
    TooManyTransactions,
    BlockTooLarge,
    Truncated,
    TrailingBytes,
    InvalidDomain,
    UnsupportedVersion,
    LengthOverflow,
}

fn put_bytes(out: &mut Vec<u8>, value: &[u8]) -> Result<(), EncodingError> {
    let len = u32::try_from(value.len()).map_err(|_| EncodingError::LengthOverflow)?;
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(value);
    Ok(())
}

fn read_exact<'a>(input: &mut &'a [u8], len: usize) -> Result<&'a [u8], EncodingError> {
    if input.len() < len {
        return Err(EncodingError::Truncated);
    }
    let (head, tail) = input.split_at(len);
    *input = tail;
    Ok(head)
}

fn read_u32(input: &mut &[u8]) -> Result<u32, EncodingError> {
    Ok(u32::from_be_bytes(read_exact(input, 4)?.try_into().expect("fixed length")))
}

fn read_bytes<'a>(input: &mut &'a [u8], max: usize) -> Result<&'a [u8], EncodingError> {
    let len = read_u32(input)? as usize;
    if len > max {
        return Err(EncodingError::RecipientTooLong);
    }
    read_exact(input, len)
}

/// Encode the transaction fields covered by the v1 Ed25519 signature.
/// The network identifier is exactly 32 bytes; sender is the raw 32-byte public key.
pub fn encode_transaction_payload(
    network_id: &[u8; 32],
    sender_public_key: &[u8],
    recipient: &str,
    amount: u64,
    nonce: u64,
) -> Result<Vec<u8>, EncodingError> {
    if sender_public_key.len() != 32 {
        return Err(EncodingError::InvalidPublicKey);
    }
    if recipient.len() > MAX_RECIPIENT_BYTES {
        return Err(EncodingError::RecipientTooLong);
    }
    let mut out = Vec::with_capacity(6 + 2 + 32 + 32 + 4 + recipient.len() + 16);
    out.extend_from_slice(TX_DOMAIN);
    out.extend_from_slice(&PROTOCOL_VERSION.to_be_bytes());
    out.extend_from_slice(network_id);
    out.extend_from_slice(sender_public_key);
    put_bytes(&mut out, recipient.as_bytes())?;
    out.extend_from_slice(&amount.to_be_bytes());
    out.extend_from_slice(&nonce.to_be_bytes());
    Ok(out)
}

/// Convenience conversion from the current JSON-facing transaction type.
/// It deliberately does not replace the legacy signing_payload/verify path yet.
pub fn encode_transaction(
    network_id: &[u8; 32],
    tx: &Transaction,
) -> Result<Vec<u8>, EncodingError> {
    let sender = hex::decode(&tx.from).map_err(|_| EncodingError::InvalidPublicKey)?;
    encode_transaction_payload(network_id, &sender, &tx.to, tx.amount, tx.nonce)
}

/// Canonical block-hash payload for a future v1 block format.
/// Transactions are length-prefixed canonical transaction payloads; signatures are fixed 64 bytes.
pub fn encode_block_payload(
    network_id: &[u8; 32],
    height: u64,
    timestamp: u64,
    parent_hash: &[u8],
    transactions: &[Vec<u8>],
    signatures: &[[u8; 64]],
) -> Result<Vec<u8>, EncodingError> {
    if parent_hash.len() != 32 {
        return Err(EncodingError::InvalidHash);
    }
    if transactions.len() > MAX_TRANSACTIONS_PER_BLOCK || transactions.len() != signatures.len() {
        return Err(EncodingError::TooManyTransactions);
    }
    let mut out = Vec::new();
    out.extend_from_slice(BLOCK_DOMAIN);
    out.extend_from_slice(&PROTOCOL_VERSION.to_be_bytes());
    out.extend_from_slice(network_id);
    out.extend_from_slice(&height.to_be_bytes());
    out.extend_from_slice(&timestamp.to_be_bytes());
    out.extend_from_slice(parent_hash);
    out.extend_from_slice(&(transactions.len() as u32).to_be_bytes());
    for (tx, signature) in transactions.iter().zip(signatures) {
        let decoded = decode_transaction_payload(tx).map_err(|_| EncodingError::InvalidTransactionPayload)?;
        if decoded.network_id != *network_id {
            return Err(EncodingError::NetworkMismatch);
        }
        put_bytes(&mut out, tx)?;
        out.extend_from_slice(signature);
        if out.len() > MAX_ENCODED_BLOCK_BYTES {
            return Err(EncodingError::BlockTooLarge);
        }
    }
    if out.len() > MAX_ENCODED_BLOCK_BYTES {
        return Err(EncodingError::BlockTooLarge);
    }
    Ok(out)
}

pub fn hash_block_payload(payload: &[u8]) -> [u8; 32] {
    Sha256::digest(payload).into()
}

/// Decoded block payload. Each transaction is retained as its canonical signed payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedBlock {
    pub network_id: [u8; 32],
    pub height: u64,
    pub timestamp: u64,
    pub parent_hash: [u8; 32],
    pub transactions: Vec<Vec<u8>>,
    pub signatures: Vec<[u8; 64]>,
}

/// Decode a complete bounded block payload and validate every embedded transaction.
pub fn decode_block_payload(mut input: &[u8]) -> Result<DecodedBlock, EncodingError> {
    if input.len() > MAX_ENCODED_BLOCK_BYTES { return Err(EncodingError::BlockTooLarge); }
    if read_exact(&mut input, BLOCK_DOMAIN.len())? != BLOCK_DOMAIN {
        return Err(EncodingError::InvalidDomain);
    }
    let version = u16::from_be_bytes(read_exact(&mut input, 2)?.try_into().expect("fixed length"));
    if version != PROTOCOL_VERSION { return Err(EncodingError::UnsupportedVersion); }
    let network_id = read_exact(&mut input, 32)?.try_into().expect("fixed length");
    let height = u64::from_be_bytes(read_exact(&mut input, 8)?.try_into().expect("fixed length"));
    let timestamp = u64::from_be_bytes(read_exact(&mut input, 8)?.try_into().expect("fixed length"));
    let parent_hash = read_exact(&mut input, 32)?.try_into().expect("fixed length");
    let count = read_u32(&mut input)? as usize;
    if count > MAX_TRANSACTIONS_PER_BLOCK { return Err(EncodingError::TooManyTransactions); }
    let mut transactions = Vec::with_capacity(count);
    let mut signatures = Vec::with_capacity(count);
    for _ in 0..count {
        // A block transaction is not a recipient field: report the block-size
        // error rather than leaking the recipient-specific length error.
        let tx_len = read_u32(&mut input)? as usize;
        if tx_len > MAX_ENCODED_BLOCK_BYTES {
            return Err(EncodingError::BlockTooLarge);
        }
        let tx = read_exact(&mut input, tx_len)?.to_vec();
        let decoded = decode_transaction_payload(&tx)?;
        if decoded.network_id != network_id {
            return Err(EncodingError::NetworkMismatch);
        }
        let signature = read_exact(&mut input, 64)?.try_into().expect("fixed length");
        transactions.push(tx);
        signatures.push(signature);
    }
    if !input.is_empty() { return Err(EncodingError::TrailingBytes); }
    Ok(DecodedBlock { network_id, height, timestamp, parent_hash, transactions, signatures })
}

/// Decoded, structurally valid v1 transaction payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedTransaction {
    pub network_id: [u8; 32],
    pub sender_public_key: [u8; 32],
    pub recipient: String,
    pub amount: u64,
    pub nonce: u64,
}

/// Decode a complete transaction payload, rejecting malformed or non-canonical input.
pub fn decode_transaction_payload(mut input: &[u8]) -> Result<DecodedTransaction, EncodingError> {
    if read_exact(&mut input, TX_DOMAIN.len())? != TX_DOMAIN {
        return Err(EncodingError::InvalidDomain);
    }
    let version = u16::from_be_bytes(read_exact(&mut input, 2)?.try_into().expect("fixed length"));
    if version != PROTOCOL_VERSION {
        return Err(EncodingError::UnsupportedVersion);
    }
    let network_id: [u8; 32] = read_exact(&mut input, 32)?.try_into().expect("fixed length");
    let sender_public_key: [u8; 32] = read_exact(&mut input, 32)?.try_into().expect("fixed length");
    let recipient_bytes = read_bytes(&mut input, MAX_RECIPIENT_BYTES)?;
    let recipient = std::str::from_utf8(recipient_bytes).map_err(|_| EncodingError::InvalidRecipientUtf8)?.to_owned();
    let amount = u64::from_be_bytes(read_exact(&mut input, 8)?.try_into().expect("fixed length"));
    let nonce = u64::from_be_bytes(read_exact(&mut input, 8)?.try_into().expect("fixed length"));
    if !input.is_empty() { return Err(EncodingError::TrailingBytes); }
    Ok(DecodedTransaction { network_id, sender_public_key, recipient, amount, nonce })
}

/// Structural validation helper for callers that only need a pass/fail result.
pub fn validate_transaction_payload(input: &[u8]) -> Result<(), EncodingError> {
    decode_transaction_payload(input).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transaction_encoding_is_deterministic_and_big_endian() {
        let network = [0x11; 32];
        let key = [0x22; 32];
        let encoded = encode_transaction_payload(&network, &key, "bob", 0x0102, 3).unwrap();
        assert_eq!(&encoded[..6], b"QUN-TX");
        assert_eq!(&encoded[6..8], &[0, 1]);
        assert_eq!(&encoded[8..40], &network);
        assert_eq!(&encoded[40..72], &key);
        assert_eq!(&encoded[72..76], &[0, 0, 0, 3]);
        assert_eq!(&encoded[76..79], b"bob");
        assert_eq!(&encoded[79..87], &0x0102_u64.to_be_bytes());
        assert_eq!(&encoded[87..95], &3_u64.to_be_bytes());
        assert_eq!(encode_transaction_payload(&network, &key, "bob", 0x0102, 3).unwrap(), encoded);
        // Golden vector: keep this exact byte string stable across implementations.
        assert_eq!(
            hex::encode(&encoded),
            "51554e2d545800011111111111111111111111111111111111111111111111111111111111111111222222222222222222222222222222222222222222222222222222222222222200000003626f6200000000000001020000000000000003"
        );
        assert_eq!(
            hex::encode(Sha256::digest(&encoded)),
            "9d627b96e6486273ebcb3fdc489377b0f6453594b2b3c8ab4454e4a0e72bf8da"
        );
        let decoded = decode_transaction_payload(&encoded).unwrap();
        assert_eq!(decoded.network_id, network);
        assert_eq!(decoded.sender_public_key, key);
        assert_eq!(decoded.recipient, "bob");
        assert_eq!(decoded.amount, 0x0102);
        assert_eq!(decoded.nonce, 3);
        assert_eq!(validate_transaction_payload(&encoded), Ok(()));
    }

    #[test]
    fn transaction_decoder_rejects_truncation_trailing_bytes_and_wrong_domain() {
        let payload = encode_transaction_payload(&[0; 32], &[1; 32], "x", 1, 1).unwrap();
        assert_eq!(validate_transaction_payload(&payload[..payload.len()-1]), Err(EncodingError::Truncated));
        let mut trailing = payload.clone();
        trailing.push(0);
        assert_eq!(validate_transaction_payload(&trailing), Err(EncodingError::TrailingBytes));
        let mut wrong = payload.clone();
        wrong[0] = b'X';
        assert_eq!(validate_transaction_payload(&wrong), Err(EncodingError::InvalidDomain));
        let mut unsupported = payload.clone();
        unsupported[7] = 2;
        assert_eq!(decode_transaction_payload(&unsupported), Err(EncodingError::UnsupportedVersion));
        let mut invalid_utf8 = encode_transaction_payload(&[0; 32], &[1; 32], "x", 1, 1).unwrap();
        invalid_utf8[76] = 0xff;
        assert_eq!(decode_transaction_payload(&invalid_utf8), Err(EncodingError::InvalidRecipientUtf8));
    }

    #[test]
    fn block_rejects_transactions_from_another_network_and_malformed_payloads() {
        let tx_other_network = encode_transaction_payload(&[4; 32], &[4; 32], "recipient", 5, 6).unwrap();
        assert_eq!(
            encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[tx_other_network], &[[8; 64]]),
            Err(EncodingError::NetworkMismatch)
        );

        let malformed = vec![1, 2, 3];
        assert_eq!(
            encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[malformed], &[[8; 64]]),
            Err(EncodingError::InvalidTransactionPayload)
        );
    }

    #[test]
    fn block_decoder_rejects_embedded_transaction_network_mismatch() {
        let tx = encode_transaction_payload(&[3; 32], &[4; 32], "recipient", 5, 6).unwrap();
        let mut block = encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[tx], &[[8; 64]]).unwrap();
        // Header is 95 bytes, then a 4-byte transaction length; the tx network
        // identifier begins 8 bytes into the transaction payload.
        block[107] = 9;
        assert_eq!(decode_block_payload(&block), Err(EncodingError::NetworkMismatch));
    }

    #[test]
    fn transaction_encoding_rejects_oversized_fields() {
        assert_eq!(
            encode_transaction_payload(&[0; 32], &[0; 32], &"x".repeat(MAX_RECIPIENT_BYTES + 1), 1, 1),
            Err(EncodingError::RecipientTooLong)
        );
        assert_eq!(
            encode_transaction_payload(&[0; 32], &[0; 31], "x", 1, 1),
            Err(EncodingError::InvalidPublicKey)
        );
    }

    #[test]
    fn block_payload_hash_is_stable_and_commits_to_signature() {
        let tx = encode_transaction_payload(&[3; 32], &[4; 32], "recipient", 5, 6).unwrap();
        let a = encode_block_payload(&[3; 32], 1, 7, &[0; 32], std::slice::from_ref(&tx), &[[8; 64]]).unwrap();
        let b = encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[tx], &[[9; 64]]).unwrap();
        assert_ne!(hash_block_payload(&a), hash_block_payload(&b));
        let decoded = decode_block_payload(&a).unwrap();
        assert_eq!(decoded.network_id, [3; 32]);
        assert_eq!(decoded.height, 1);
        assert_eq!(decoded.timestamp, 7);
        assert_eq!(decoded.parent_hash, [0; 32]);
        assert_eq!(decoded.transactions.len(), 1);
        assert_eq!(decoded.signatures, vec![[8; 64]]);
        let mut trailing = a.clone();
        trailing.push(0);
        assert_eq!(decode_block_payload(&trailing), Err(EncodingError::TrailingBytes));
        assert_eq!(a, encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[encode_transaction_payload(&[3; 32], &[4; 32], "recipient", 5, 6).unwrap()], &[[8; 64]]).unwrap());
    }
}
