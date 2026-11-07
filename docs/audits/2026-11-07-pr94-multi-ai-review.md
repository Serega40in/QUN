# Multi-AI review of PR #94 (QUN Core Gate 1)

**Date:** 2026-11-07 · **Reviewed commit:** `c183112` · **PR:** #94

Process (per `core/ENGINEERING_GATES.md`, "AI-assisted audit policy"): every model got the same prompt and the same diff of `core/src` and `core/tests`, in separate chats. Each finding was treated as a hypothesis and then confirmed or refuted by a test or a reproduction. This is not an independent human security audit.

Models: DeepSeek (DeepThink), Alice / Яндекс (Эксперт), ChatGPT (free), Grok (Быстрый), GigaChat.

## Confirmed and fixed in this PR

| Finding | Reported by | Evidence | Fix |
|---|---|---|---|
| One signature can be written several ways (uppercase / `0x` hex): it still verifies but changes the block hash | DeepSeek, ChatGPT, Alice, Grok | Reproduced: uppercase signature verified `Ok` and produced a different `calculate_signed_hash` | `verify` accepts only 64/128 lowercase hex chars; test `non_canonical_hex_key_or_signature_is_rejected` |
| Node could listen publicly with dev flags off, leaving the unauthenticated `/dev/mine-signed` open to anyone (block spam / disk growth) | DeepSeek, ChatGPT, Grok | Started on `0.0.0.0` with flags off before the fix | Non-loopback bind needs `QUN_ALLOW_NON_LOOPBACK=true`; dev flags are never allowed off loopback; IPv4, IPv6 and IPv4-mapped cases tested |
| Disabled `/dev/mine` parsed the JSON body before answering, so bad input got 400 instead of 403 | DeepSeek, Alice | Code reading | Flag checked before parsing; API test sends a malformed body and expects 403 |
| Tests depended on ambient `QUN_*` environment variables | DeepSeek | Code reading | Test node clears `QUN_ENABLE_UNSIGNED_DEV_MINE` and `QUN_ALLOW_NON_LOOPBACK` |
| No test vector for block hashes | DeepSeek, Alice | — | Genesis hash vector, computed independently in Python and asserted in Rust |
| IPv6 loopback not tested | DeepSeek, Alice, Grok | — | Covered in the bind test |

## Refuted (verified false)

| Claim | Reported by | Why it is false |
|---|---|---|
| JS `setBigUint64` writes little-endian, so browser and Rust payloads differ | Grok | Default is big-endian; checked in Node.js (`25` becomes `0000000000000019`), and the dashboard payload matches the Rust test vector byte for byte |
| JS length prefix counts characters, not UTF-8 bytes | GigaChat | `str()` prefixes `enc.encode(v).length`, the byte length (`"тест"` gives 8) |
| `usize as u64` can truncate on 32-bit | Grok | `usize` is at most 64 bits; widening to `u64` is lossless |
| Block hashes have no domain separation | GigaChat | Both hashes start with `QUN_BLOCK_V3` / `QUN_SIGNED_BLOCK_V3` plus the chain ID |
| Signed transactions can be stripped from a block without changing its hash | Alice | `validate` recomputes the signed-block hash whenever signed transactions are present and requires them to match `transactions` one to one; stripping them switches to a different domain and hash |
| A transaction can be duplicated across the two lists in one block | Alice | `validate` requires equal length and pairwise equality of the two lists |

## Accepted, not fixed yet (next steps)

- **Chain ID is a compile-time constant.** Two separately run devnets built from one binary share `qun-devnet-1`. Move the chain ID into the genesis config and snapshot (Gate 1/2). Reported by DeepSeek, Alice.
- **DNS rebinding against a local node.** Without a `Host`/`Origin` check, a malicious web page could reach a loopback node through a rebinding domain. Add a `Host` allow-list middleware. Reported by Alice.
- **JS uses `Number` for nonce and amount.** Values above 2^53 cannot be signed in the browser; amount is already capped by `Number.isSafeInteger`. Move to string/BigInt values in the API. Reported by DeepSeek, ChatGPT, Grok.
- **Old snapshots fail with a generic integrity error.** Add a distinct "retired payload version" error. Reported by DeepSeek, Alice.
- **Ledger is not rebuilt from blocks on load** (found in the earlier Claude review). This is Gate 2.
- **Flag parsing accepts only `true`/`1`**, so `TRUE` is silently off. Fail-closed but implicit. Reported by Alice.
