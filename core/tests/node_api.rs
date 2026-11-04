use ed25519_dalek::{Signer, SigningKey};
use qun_core::{SignedTransaction, Transaction};
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

struct TestNode {
    child: Child,
    address: String,
    data_file: std::path::PathBuf,
}

impl TestNode {
    fn start() -> Self {
        let probe = TcpListener::bind("127.0.0.1:0").expect("reserve a free local port");
        let port = probe.local_addr().unwrap().port();
        drop(probe);

        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let data_file = std::env::temp_dir().join(format!(
            "qun-api-test-{}-{unique}.json",
            std::process::id()
        ));
        let address = format!("127.0.0.1:{port}");
        let child = Command::new(env!("CARGO_BIN_EXE_node"))
            .env("QUN_BIND", &address)
            .env("QUN_DATA_FILE", &data_file)
            .env("QUN_ENABLE_DEV_FUNDING", "true")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("start local QUN node test process");

        let mut node = Self { child, address, data_file };
        for _ in 0..100 {
            // Wait for the TCP listener before sending an HTTP request; otherwise startup
            // can race the bind and the request helper panics on ConnectionRefused.
            if TcpStream::connect(&node.address).is_ok() && node.get("/health").is_ok() {
                return node;
            }
            if let Ok(Some(status)) = node.child.try_wait() {
                panic!("QUN node exited during startup with status {status}");
            }
            thread::sleep(Duration::from_millis(50));
        }
        panic!("QUN node did not start in time");
    }

    fn request(&mut self, method: &str, path: &str, body: Option<&Value>) -> (u16, Value) {
        let payload = body.map(Value::to_string).unwrap_or_default();
        let mut stream = TcpStream::connect(&self.address).expect("connect to local test node");
        stream.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        let request = format!(
            "{method} {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            payload.len(), payload
        );
        stream.write_all(request.as_bytes()).expect("write HTTP request");
        let mut response = String::new();
        stream.read_to_string(&mut response).expect("read HTTP response");
        let (head, body) = response.split_once("\r\n\r\n").expect("HTTP response headers");
        let status = head.lines().next().unwrap().split_whitespace().nth(1).unwrap().parse().unwrap();
        (status, serde_json::from_str(body).unwrap_or(Value::Null))
    }

    fn get(&mut self, path: &str) -> Result<Value, String> {
        let (status, body) = self.request("GET", path, None);
        if (200..300).contains(&status) { Ok(body) } else { Err(format!("HTTP {status}: {body}")) }
    }

    fn post(&mut self, path: &str, body: &Value) -> (u16, Value) {
        self.request("POST", path, Some(body))
    }
}

impl Drop for TestNode {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_file(&self.data_file);
    }
}

fn signed_transaction(key: &SigningKey, to: &str, amount: u64, nonce: u64) -> SignedTransaction {
    let public_key = hex::encode(key.verifying_key().as_bytes());
    let transaction = Transaction {
        from: public_key.clone(),
        to: to.to_owned(),
        amount,
        nonce,
    };
    let signature = key.sign(&SignedTransaction::signing_payload(&transaction));
    SignedTransaction {
        transaction,
        public_key,
        signature: hex::encode(signature.to_bytes()),
    }
}

fn submit(signed: SignedTransaction) -> Value {
    json!({ "signed_transactions": [signed] })
}

#[test]
fn rejected_signed_transactions_do_not_mutate_chain_or_ledger() {
    let mut node = TestNode::start();
    let key = SigningKey::from_bytes(&[41_u8; 32]);
    let address = hex::encode(key.verifying_key().as_bytes());

    let (fund_status, _) = node.post("/dev/fund", &json!({"address": address, "amount": 10}));
    assert_eq!(fund_status, 200, "test funding should succeed");

    let chain_before = node.get("/chain").unwrap();
    let accounts_before = node.get("/accounts").unwrap();

    let mut invalid_signature = signed_transaction(&key, "recipient-test", 5, 1);
    invalid_signature.signature = "00".repeat(64);
    let (status, _) = node.post("/dev/mine-signed", &submit(invalid_signature));
    assert_eq!(status, 422, "invalid signature must be rejected");
    assert_eq!(node.get("/chain").unwrap(), chain_before);
    assert_eq!(node.get("/accounts").unwrap(), accounts_before);

    let insufficient_funds = signed_transaction(&key, "recipient-test", 11, 1);
    let (status, _) = node.post("/dev/mine-signed", &submit(insufficient_funds));
    assert_eq!(status, 422, "insufficient balance must be rejected");
    assert_eq!(node.get("/chain").unwrap(), chain_before);
    assert_eq!(node.get("/accounts").unwrap(), accounts_before);

    let mut sender_mismatch = signed_transaction(&key, "recipient-test", 5, 1);
    sender_mismatch.transaction.from = "not-the-public-key".to_owned();
    let (status, _) = node.post("/dev/mine-signed", &submit(sender_mismatch));
    assert_eq!(status, 422, "sender/public-key mismatch must be rejected");
    assert_eq!(node.get("/chain").unwrap(), chain_before);
    assert_eq!(node.get("/accounts").unwrap(), accounts_before);
}

#[test]
fn valid_signed_transaction_updates_chain_and_ledger() {
    let mut node = TestNode::start();
    let key = SigningKey::from_bytes(&[42_u8; 32]);
    let address = hex::encode(key.verifying_key().as_bytes());
    let (status, _) = node.post("/dev/fund", &json!({"address": address, "amount": 10}));
    assert_eq!(status, 200);

    let (status, block) = node.post(
        "/dev/mine-signed",
        &submit(signed_transaction(&key, "recipient-test", 4, 1)),
    );
    assert_eq!(status, 201, "valid signed transaction should be accepted");
    assert_eq!(block["index"], 1);
    assert_eq!(block["signed_transactions"].as_array().unwrap().len(), 1);

    let accounts = node.get("/accounts").unwrap();
    assert_eq!(accounts["balances"][address], 6);
    assert_eq!(accounts["balances"]["recipient-test"], 4);
    assert_eq!(accounts["nonces"][hex::encode(key.verifying_key().as_bytes())], 1);
}
