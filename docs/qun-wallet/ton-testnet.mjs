export const TON_TESTNET_CHAIN = '-3';
export const TON_TESTNET_MAX_NANO = 100n * 1000000000n;

function crc16Xmodem(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function isValidTonTestnetFriendlyAddress(input) {
  const value = String(input || '').trim();
  if (!/^[A-Za-z0-9+/_-]{48}$/.test(value)) return false;

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = globalThis.atob(normalized);
    if (binary.length !== 36) return false;
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    // 0x91 = bounceable + test-only; 0xD1 = non-bounceable + test-only.
    if (bytes[0] !== 0x91 && bytes[0] !== 0xD1) return false;

    const expectedCrc = (bytes[34] << 8) | bytes[35];
    return crc16Xmodem(bytes.subarray(0, 34)) === expectedCrc;
  } catch {
    return false;
  }
}

export function normalizeTonTestnetAddress(input, toUserFriendlyAddress) {
  const value = String(input || '').trim();
  if (/^-?\d+:[a-fA-F0-9]{64}$/.test(value)) {
    if (typeof toUserFriendlyAddress !== 'function') {
      throw new Error('Не удалось преобразовать TON-адрес. Обнови страницу.');
    }
    const friendly = toUserFriendlyAddress(value, true);
    if (isValidTonTestnetFriendlyAddress(friendly)) return friendly;
    throw new Error('Не удалось преобразовать адрес в формат TON Testnet.');
  }
  if (isValidTonTestnetFriendlyAddress(value)) return value;
  if (/^(?:EQ|UQ)/.test(value)) {
    throw new Error('Похоже, это адрес TON Mainnet. Для этой операции нужен адрес TON Testnet (kQ… или 0Q…).');
  }
  throw new Error('Проверь адрес: нужен корректный тестовый адрес формата kQ… / 0Q… либо raw-адрес 0:<64 hex>.');
}

export function parseTonNanoAmount(input) {
  const value = String(input || '').trim().replace(',', '.');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/.test(value)) {
    throw new Error('Введи сумму от 0.000000001 до 100 TON и не более 9 знаков после запятой.');
  }
  const parts = value.split('.');
  const whole = BigInt(parts[0]);
  const fraction = BigInt(((parts[1] || '') + '000000000').slice(0, 9));
  const amount = whole * 1000000000n + fraction;
  if (amount <= 0n) throw new Error('Сумма должна быть больше нуля.');
  if (amount > TON_TESTNET_MAX_NANO) throw new Error('Лимит одного тестового перевода — 100 TON.');
  return amount;
}
