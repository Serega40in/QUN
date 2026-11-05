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
    if recipient.as_bytes().len() > MAX_RECIPIENT_BYTES {
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

/// Small strict reader for transaction payloads, used by tests and future node decoding.
pub fn validate_transaction_payload(mut input: &[u8]) -> Result<(), EncodingError> {
    if read_exact(&mut input, TX_DOMAIN.len())? != TX_DOMAIN {
        return Err(EncodingError::InvalidDomain);
    }
    let version = u16::from_be_bytes(read_exact(&mut input, 2)?.try_into().expect("fixed length"));
    if version != PROTOCOL_VERSION {
        return Err(EncodingError::UnsupportedVersion);
    }
    read_exact(&mut input, 32)?; // network id
    read_exact(&mut input, 32)?; // sender key
    let recipient = read_bytes(&mut input, MAX_RECIPIENT_BYTES)?;
    std::str::from_utf8(recipient).map_err(|_| EncodingError::InvalidRecipientUtf8)?;
    read_exact(&mut input, 8)?; // amount
    read_exact(&mut input, 8)?; // nonce
    if !input.is_empty() {
        return Err(EncodingError::TrailingBytes);
    }
    Ok(())
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
        assert_eq!(validate_transaction_payload(&encoded), Ok(()));
    }

    #[test]
    fn transaction_decoder_rejects_truncation_trailing_bytes_and_wrong_domain() {
        let payload = encode_transaction_payload(&[0; 32], &[1; 32], "x", 1, 1).unwrap();
        assert_eq!(validate_transaction_payload(&payload[..payload.len()-1]), Err(EncodingError::Truncated));
        let mut trailing = payload.clone();
        trailing.push(0);
        assert_eq!(validate_transaction_payload(&trailing), Err(EncodingError::TrailingBytes));
        let mut wrong = payload;
        wrong[0] = b'X';
        assert_eq!(validate_transaction_payload(&wrong), Err(EncodingError::InvalidDomain));
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
        let a = encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[tx.clone()], &[[8; 64]]).unwrap();
        let b = encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[tx], &[[9; 64]]).unwrap();
        assert_ne!(hash_block_payload(&a), hash_block_payload(&b));
        assert_eq!(a, encode_block_payload(&[3; 32], 1, 7, &[0; 32], &[encode_transaction_payload(&[3; 32], &[4; 32], "recipient", 5, 6).unwrap()], &[[8; 64]]).unwrap());
    }
}
