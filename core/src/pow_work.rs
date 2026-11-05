//! Fixed-width proof-of-work accounting primitives.
//!
//! These helpers do not validate consensus parameters or select a chain. Callers must
//! derive the target from validated protocol history before using this module.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkError {
    InvalidTarget,
    TargetAboveProtocolMaximum,
    Overflow,
}

/// Unsigned 256-bit work value stored in big-endian byte order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct Work256([u8; 32]);

impl Work256 {
    pub const ZERO: Self = Self([0; 32]);

    pub const fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub const fn to_bytes(self) -> [u8; 32] {
        self.0
    }

    /// Checked addition. Returns None instead of wrapping consensus work.
    pub fn checked_add(self, other: Self) -> Option<Self> {
        let mut out = [0u8; 32];
        let mut carry = 0u16;
        for index in (0..32).rev() {
            let sum = self.0[index] as u16 + other.0[index] as u16 + carry;
            out[index] = sum as u8;
            carry = sum >> 8;
        }
        if carry != 0 { None } else { Some(Self(out)) }
    }
}

/// Compute per-block work as ceil(2^256 / (target + 1)), matching the usual
/// integer PoW work formula. Target is a big-endian 256-bit unsigned integer.
///
/// For v1 safety, target must be nonzero and no greater than 2^255 - 1.
/// That bound keeps target + 1 representable and ensures per-block work fits
/// in 256 bits. The network's consensus rules must derive this target; never
/// trust a target supplied by an untrusted peer.
pub fn work_from_target(target: &[u8; 32]) -> Result<Work256, WorkError> {
    if *target == [0; 32] {
        return Err(WorkError::InvalidTarget);
    }
    if target[0] & 0x80 != 0 {
        return Err(WorkError::TargetAboveProtocolMaximum);
    }

    let mut divisor = *target;
    let mut carry = 1u16;
    for index in (0..32).rev() {
        let value = divisor[index] as u16 + carry;
        divisor[index] = value as u8;
        carry = value >> 8;
    }
    if carry != 0 {
        return Err(WorkError::TargetAboveProtocolMaximum);
    }

    // Binary long division of 2^256 by target + 1. The numerator's leading
    // bit is handled as the first input bit; subsequent 256 bits are zero.
    let mut remainder = [0u8; 32];
    let mut quotient = [0u8; 32];
    for bit_position in (0..=256).rev() {
        shift_left_one(&mut remainder);
        if bit_position == 256 {
            remainder[31] |= 1;
        }
        if compare_be(&remainder, &divisor) != core::cmp::Ordering::Less {
            subtract_be(&mut remainder, &divisor);
            if bit_position < 256 {
                quotient[31 - bit_position / 8] |= 1 << (7 - (bit_position % 8));
            }
        }
    }

    // ceil(n / d) = floor(n / d) + 1 when a remainder remains.
    if remainder != [0; 32] {
        increment_be(&mut quotient).ok_or(WorkError::Overflow)?;
    }
    Ok(Work256(quotient))
}

fn shift_left_one(value: &mut [u8; 32]) {
    let mut carry = 0u8;
    for byte in value.iter_mut().rev() {
        let next = *byte >> 7;
        *byte = (*byte << 1) | carry;
        carry = next;
    }
}

fn compare_be(left: &[u8; 32], right: &[u8; 32]) -> core::cmp::Ordering {
    left.iter().cmp(right.iter())
}

fn subtract_be(left: &mut [u8; 32], right: &[u8; 32]) {
    let mut borrow = 0i16;
    for index in (0..32).rev() {
        let value = left[index] as i16 - right[index] as i16 - borrow;
        if value < 0 {
            left[index] = (value + 256) as u8;
            borrow = 1;
        } else {
            left[index] = value as u8;
            borrow = 0;
        }
    }
}

fn increment_be(value: &mut [u8; 32]) -> Option<()> {
    for byte in value.iter_mut().rev() {
        let (next, overflow) = byte.overflowing_add(1);
        *byte = next;
        if !overflow {
            return Some(());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn work_formula_has_expected_boundary_vectors() {
        let mut target = [0u8; 32];
        target[31] = 1;
        let work = work_from_target(&target).unwrap().to_bytes();
        assert_eq!(work[0], 0x80);
        assert!(work[1..].iter().all(|byte| *byte == 0));

        let mut max_target = [0xff; 32];
        max_target[0] = 0x7f;
        let work = work_from_target(&max_target).unwrap().to_bytes();
        let mut expected = [0u8; 32];
        expected[31] = 2;
        assert_eq!(work, expected);
    }

    #[test]
    fn rejects_invalid_or_out_of_range_targets() {
        assert_eq!(work_from_target(&[0; 32]), Err(WorkError::InvalidTarget));
        assert_eq!(
            work_from_target(&[0xff; 32]),
            Err(WorkError::TargetAboveProtocolMaximum)
        );
    }

    #[test]
    fn cumulative_work_addition_is_checked() {
        let mut one = [0u8; 32];
        one[31] = 1;
        let one = Work256::from_bytes(one);
        let two = one.checked_add(one).unwrap().to_bytes();
        assert_eq!(two[31], 2);

        let max = Work256::from_bytes([0xff; 32]);
        assert_eq!(max.checked_add(one), None);
    }

    #[test]
    fn work_rounds_up_when_division_has_a_remainder() {
        // target = 2 => ceil(2^256 / 3), which is 0x55..56.
        let mut target = [0u8; 32];
        target[31] = 2;
        let work = work_from_target(&target).unwrap().to_bytes();
        assert_eq!(work[0], 0x55);
        assert!(work[1..31].iter().all(|byte| *byte == 0x55));
        assert_eq!(work[31], 0x56);
    }
}
