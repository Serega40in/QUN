# QUN Node peer-to-peer validation runbook

This runbook distinguishes a local integration test from a real multi-machine trial. Passing the local test does not prove internet-scale reliability or consensus.

## What CI now proves

The test suite starts two separate QUN Node processes with separate data directories and confirms:

- a synthetic object written to peer A is replicated to peer B;
- an object written to peer B is replicated back to peer A;
- internal replication endpoints reject missing and incorrect shared secrets;
- stored data and SHA-256 manifests survive a full process restart;
- a disconnected peer can catch up and a corrupted replica can be repaired.

See `test/bidirectional-replication.test.js`, `test/peer-auth.test.js`, and `test/replication.test.js`.

## Safe trial on two computers

Do not expose the Node HTTP port directly to the public internet. The replication bearer secret is sensitive.

1. Use a private network/VPN between the computers, or a correctly configured TLS reverse proxy. A remote peer URL must use `https://`; the service refuses non-local plaintext HTTP peers.
2. Keep the application bound to `127.0.0.1` behind a local TLS proxy where possible. If binding the service to a non-loopback interface is unavoidable, set `QUN_NODE_ALLOW_REMOTE=1` only after firewalling it to the private interface and validating the TLS termination and access rules.
3. Generate a unique shared secret of at least 32 characters using a password manager or a cryptographically secure generator. Do not commit it to Git, paste it into issues, or reuse a production credential in tests.
4. Configure each peer with the other peer's HTTPS URL in `QUN_NODE_PEERS`, and configure the same secret in `QUN_NODE_SHARED_TOKEN` on both nodes. Current prototype uses a shared secret for all configured peers; it does not yet support per-peer identities or rotation without coordinated configuration.
5. Give each computer a separate `QUN_NODE_DATA_DIR`. Start the nodes and check their local `/health` endpoints before adding any test object.
6. Write only synthetic, non-sensitive test data. Confirm it is readable and has the same SHA-256 digest on the other node.
7. Stop one node, write a second synthetic object on the available node, restart the stopped node, and verify that it catches up.
8. Disconnect the trial, remove any temporary firewall rules, rotate the test secret, and inspect logs for errors before considering a longer trial.

## Important limitations

- The current replication protocol is authenticated HTTP(S) object replication, not a general-purpose peer discovery network.
- Nodes must be configured with peer URLs; automatic public discovery is not implemented.
- The shared bearer token is not a node identity system. There is no per-peer authorization policy, mutual TLS identity, rate limiting, or consensus protocol in this trial guide.
- If two peers have different valid bytes under the same object ID, reconciliation reports a conflict; it does not decide which value is authoritative. Treat object IDs as immutable.
- This is not yet a decentralized storage guarantee, blockchain consensus, or a rewards oracle. Do not store secrets or valuable user data in this prototype.

## Next engineering gate

Before a broader rollout, add per-peer credentials/identity, replay protection or request signing, configurable resource quotas, conflict observability, and tests against a real network boundary. Run a controlled two-computer trial before claiming cross-device readiness.
