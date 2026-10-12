# Future concept: QUN Stone Archive

Status: idea backlog only — do not implement as part of the current QUN Node work.

## Concept
Create a large engraved stone artifact whose compact, ancient-looking symbolic inscription represents the QUN project: architecture, source code, data model, and a method for reconstructing the system. The visual language may use dots, strokes, curls, nested/fractal patterns, and a short decoding legend beneath the main inscription.

The artifact should combine:
- an artistic, mysterious appearance inspired by ancient inscriptions;
- a precise, documented encoding scheme;
- a reproducible decoder and integrity checks;
- a clear distinction between the visual symbolic layer and the actual encoded data.

## Technical reality to validate later
A short inscription cannot contain an arbitrarily large codebase and database merely by assigning it a symbolic appearance. The total information capacity is limited by the number of reliably distinguishable marks and the physical inscription area. To make the artifact genuinely recoverable, later choose one of these approaches:
1. encode a compact bootstrap specification, hashes, version identifiers, and reconstruction instructions on the stone, while preserving the full archive elsewhere;
2. encode a carefully compressed, bounded snapshot if it fits the measured physical capacity;
3. use the stone as one durable part of a multi-medium archive, with redundant copies and a documented decoding standard.

The decoder, alphabet, bit/byte mapping, compression format, error-correction method, versioning, and test vectors must be public and reproducible. The full archive must be tested by decoding a photographed/scanned inscription and verifying cryptographic hashes.

## Later deliverables
- symbolic visual design and engraving mockups;
- measurable information-capacity estimate for the chosen stone dimensions;
- formal encoding/decoding specification;
- encoder/decoder implementation with round-trip tests;
- sample archive and recovery drill;
- final inscription legend.

No development requested yet. Revisit after core QUN infrastructure is stable.
