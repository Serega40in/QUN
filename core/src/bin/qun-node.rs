//! Minimal HTTP node for local QUN Core development.
//! This is a single-process development node, not a production consensus network.
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use qun_core::{Chain, LedgerState, SignedTransaction};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    env, fs,
    io::Write,
    net::SocketAddr,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::Mutex;

#[derive(Clone)]
struct AppState(Arc<Mutex<NodeState>>);

struct NodeState {
    chain: Chain,
    ledger: LedgerState,
    genesis_balances: BTreeMap<String, u64>,
    data_file: PathBuf,
}

#[derive(Serialize, Deserialize)]
struct PersistedState {
    chain: Chain,
    genesis_balances: BTreeMap<String, u64>,
}

#[derive(Serialize)]
struct Health {
    service: &'static str,
    mode: &'static str,
    height: u64,
    warning: &'static str,
}

#[derive(Serialize)]
struct BalanceResponse {
    address: String,
    balance: u64,
    nonce: u64,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Deserialize)]
struct GenesisConfig {
    balances: BTreeMap<String, u64>,
}

async fn health(State(state): State<AppState>) -> Json<Health> {
    let node = state.0.lock().await;
    Json(Health {
        service: "qun-core",
        mode: "single-process-development",
        height: node.chain.blocks.last().map(|b| b.index).unwrap_or(0),
        warning: "Development only: persistent local state, but no peer networking or consensus",
    })
}

async fn chain(State(state): State<AppState>) -> Json<Chain> {
    Json(state.0.lock().await.chain.clone())
}

async fn balance(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Json<BalanceResponse> {
    let node = state.0.lock().await;
    Json(BalanceResponse {
        balance: node.ledger.balances.get(&address).copied().unwrap_or(0),
        nonce: node.ledger.nonces.get(&address).copied().unwrap_or(0),
        address,
    })
}

async fn submit_transaction(
    State(state): State<AppState>,
    Json(signed): Json<SignedTransaction>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<ErrorResponse>)> {
    signed.verify().map_err(|e| (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse { error: format!("invalid transaction signature: {e:?}") }),
    ))?;

    let mut node = state.0.lock().await;
    // Prepare all changes off to the side; rejected writes must not mutate live state.
    let mut next_ledger = node.ledger.clone();
    next_ledger.apply(&signed.transaction).map_err(|e| (
        StatusCode::UNPROCESSABLE_ENTITY,
        Json(ErrorResponse { error: format!("transaction rejected: {e:?}") }),
    ))?;

    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)
        .unwrap_or_default().as_secs();
    let mut next_chain = node.chain.clone();
    let block = next_chain.append_signed(timestamp, vec![signed]).map_err(|e| (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse { error: format!("block rejected: {e:?}") }),
    ))?;
    let height = block.index;
    let block_hash = block.hash.clone();

    let persisted = PersistedState {
        chain: next_chain.clone(),
        genesis_balances: node.genesis_balances.clone(),
    };
    persist_atomically(&node.data_file, &persisted).map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: format!("could not persist transaction; state unchanged: {e}") }),
    ))?;

    node.chain = next_chain;
    node.ledger = next_ledger;
    Ok((StatusCode::ACCEPTED, Json(serde_json::json!({
        "accepted": true,
        "height": height,
        "block_hash": block_hash,
        "warning": "Accepted by this local process only; not a network consensus confirmation"
    }))))
}

fn persist_atomically(path: &PathBuf, state: &PersistedState) -> Result<(), String> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = serde_json::to_vec_pretty(state).map_err(|e| e.to_string())?;
    let mut temporary = path.clone();
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("json");
    temporary.set_extension(format!("{extension}.tmp"));
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(&temporary, path).map_err(|e| {
        let _ = fs::remove_file(&temporary);
        e.to_string()
    })?;
    Ok(())
}

fn ledger_from_chain(
    chain: &Chain,
    genesis_balances: &BTreeMap<String, u64>,
) -> Result<LedgerState, String> {
    chain.validate().map_err(|e| format!("invalid saved chain: {e:?}"))?;
    let mut ledger = LedgerState::default();
    for (address, amount) in genesis_balances {
        ledger.set_genesis_balance(address.clone(), *amount)
            .map_err(|e| format!("invalid saved genesis allocation: {e:?}"))?;
    }
    for (index, block) in chain.blocks.iter().enumerate().skip(1) {
        if block.signed_transactions.is_empty()
            || block.signed_transactions.len() != block.transactions.len()
        {
            return Err(format!("saved block {index} contains unsupported unsigned transactions"));
        }
        for signed in &block.signed_transactions {
            signed.verify().map_err(|e| format!("invalid signature in block {index}: {e:?}"))?;
            ledger.apply(&signed.transaction)
                .map_err(|e| format!("invalid state transition in block {index}: {e:?}"))?;
        }
    }
    Ok(ledger)
}

fn initial_state() -> Result<NodeState, String> {
    let data_file = PathBuf::from(
        env::var("QUN_NODE_DATA_FILE").unwrap_or_else(|_| "./.qun-node-data.json".to_owned())
    );

    if data_file.exists() {
        let bytes = fs::read(&data_file)
            .map_err(|e| format!("could not read {}: {e}", data_file.display()))?;
        let saved: PersistedState = serde_json::from_slice(&bytes)
            .map_err(|e| format!("invalid saved state {}: {e}", data_file.display()))?;
        let ledger = ledger_from_chain(&saved.chain, &saved.genesis_balances)?;
        return Ok(NodeState {
            chain: saved.chain,
            ledger,
            genesis_balances: saved.genesis_balances,
            data_file,
        });
    }

    let mut genesis_balances = BTreeMap::new();
    if let Ok(raw) = env::var("QUN_DEV_GENESIS_BALANCES") {
        let config: GenesisConfig = serde_json::from_str(&raw)
            .map_err(|e| format!("invalid QUN_DEV_GENESIS_BALANCES JSON: {e}"))?;
        for (address, amount) in config.balances {
            if address.trim().is_empty() {
                return Err("development genesis contains an empty address".to_owned());
            }
            genesis_balances.insert(address, amount);
        }
    }
    let ledger = ledger_from_chain(&Chain::new(), &genesis_balances)?;
    let node = NodeState {
        chain: Chain::new(),
        ledger,
        genesis_balances,
        data_file,
    };
    persist_atomically(&node.data_file, &PersistedState {
        chain: node.chain.clone(),
        genesis_balances: node.genesis_balances.clone(),
    })?;
    Ok(node)
}

#[tokio::main]
async fn main() {
    let node = initial_state().unwrap_or_else(|e| {
        eprintln!("QUN node configuration error: {e}");
        std::process::exit(2);
    });
    let state = AppState(Arc::new(Mutex::new(node)));
    let app = Router::new()
        .route("/health", get(health))
        .route("/chain", get(chain))
        .route("/balance/:address", get(balance))
        .route("/transactions", post(submit_transaction))
        .with_state(state);

    let address: SocketAddr = env::var("QUN_NODE_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:8787".to_owned())
        .parse()
        .unwrap_or_else(|e| {
            eprintln!("invalid QUN_NODE_ADDR: {e}");
            std::process::exit(2);
        });
    let listener = tokio::net::TcpListener::bind(address).await.unwrap_or_else(|e| {
        eprintln!("cannot bind QUN node at {address}: {e}");
        std::process::exit(1);
    });
    println!("QUN Core development node listening at http://{address}");
    println!("State file: {}", env::var("QUN_NODE_DATA_FILE").unwrap_or_else(|_| "./.qun-node-data.json".to_owned()));
    println!("WARNING: local single-process prototype only; do not expose to the public internet");
    axum::serve(listener, app).await.unwrap_or_else(|e| {
        eprintln!("QUN node server failed: {e}");
        std::process::exit(1);
    });
}


#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[test]
    fn persisted_state_reloads_and_replays_signed_transfers() {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let address = hex::encode(signing_key.verifying_key().to_bytes());
        let mut genesis = BTreeMap::new();
        genesis.insert(address.clone(), 10);

        let transaction = qun_core::Transaction {
            from: address.clone(),
            to: "recipient".to_owned(),
            amount: 3,
            nonce: 1,
        };
        let signature = signing_key.sign(&SignedTransaction::signing_payload(&transaction));
        let signed = SignedTransaction {
            transaction,
            public_key: address.clone(),
            signature: hex::encode(signature.to_bytes()),
        };
        let mut chain = Chain::new();
        chain.append_signed(1, vec![signed]).expect("valid signed transaction");

        let path = env::temp_dir().join(format!(
            "qun-node-state-{}-{}.json",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let saved = PersistedState { chain, genesis_balances: genesis };
        persist_atomically(&path, &saved).expect("persist state");

        let bytes = fs::read(&path).expect("read persisted state");
        let loaded: PersistedState = serde_json::from_slice(&bytes).expect("decode state");
        let ledger = ledger_from_chain(&loaded.chain, &loaded.genesis_balances)
            .expect("replay saved chain");
        assert_eq!(ledger.balances.get(&address), Some(&7));
        assert_eq!(ledger.balances.get("recipient"), Some(&3));
        assert_eq!(ledger.nonces.get(&address), Some(&1));
        fs::remove_file(path).expect("cleanup temporary state file");
    }

    #[test]
    fn saved_chain_rejects_tampered_block_hash() {
        let mut chain = Chain::new();
        chain.append(1, vec![]);
        chain.blocks[1].hash = "tampered".to_owned();
        assert!(ledger_from_chain(&chain, &BTreeMap::new()).is_err());
    }
}
