# QUN Core Explorer — browser prototype

This is the first interactive browser UI for QUN Core.

## Current capabilities
- Browse the demo chain and inspect block identifiers.
- View demo transactions.
- Create a temporary demo wallet address.
- Queue a demo transfer and include it in a demo block.
- Verify the simulated chain's hash links in the page.

## Important status
This is **a client-side simulation only**. It does not connect to a QUN node, does not persist state, does not create cryptographic wallet keys, and does not transfer real QUN or other assets. The current Rust core is a local chain-integrity prototype and has no HTTP/JSON-RPC node API yet.

## Open locally
Open `index.html` in a modern browser. No build step or third-party dependencies are required.

## Next integration gate
Implement a Rust devnet node with persistent state and a documented HTTP JSON-RPC interface. Then replace the simulated data adapter with real RPC calls and keep demo mode visibly separate from a connected node. Do not expose private keys in browser storage or enable real-value transactions before signature validation, state-transition tests, threat modelling, and an independent security review.
