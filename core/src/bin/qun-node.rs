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
use std::{collections::BTreeMap, env, net::SocketAddr, sync::Arc, time::{SystemTime, UNIX_EPOCH}};
use tokio::sync::Mutex;

#[derive(Clone)]
struct AppState(Arc<Mutex<NodeState>>);

#[derive(Default)]
struct NodeState {
    chain: Chain,
    ledger: LedgerState,
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
        warning: "Not production-ready: no peer networking, consensus, or durable storage",
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
    // Apply to a clone first: rejected transactions must not partially mutate live state.
    let mut next_ledger = node.ledger.clone();
    next_ledger.apply(&signed.transaction).map_err(|e| (
        StatusCode::UNPROCESSABLE_ENTITY,
        Json(ErrorResponse { error: format!("transaction rejected: {e:?}") }),
    ))?;

    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)
        .unwrap_or_default().as_secs();
    let block = node.chain.append_signed(timestamp, vec![signed]).map_err(|e| (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse { error: format!("block rejected: {e:?}") }),
    ))?;
    let response = serde_json::json!({
        "accepted": true,
        "height": block.index,
        "block_hash": block.hash,
        "warning": "Accepted by this local process only; not a network consensus confirmation"
    });
    node.ledger = next_ledger;
    Ok((StatusCode::ACCEPTED, Json(response)))
}

fn initial_state() -> Result<NodeState, String> {
    let mut node = NodeState { chain: Chain::new(), ledger: LedgerState::default() };
    if let Ok(raw) = env::var("QUN_DEV_GENESIS_BALANCES") {
        let config: GenesisConfig = serde_json::from_str(&raw)
            .map_err(|e| format!("invalid QUN_DEV_GENESIS_BALANCES JSON: {e}"))?;
        for (address, amount) in config.balances {
            node.ledger.set_genesis_balance(address, amount)
                .map_err(|e| format!("invalid development genesis allocation: {e:?}"))?;
        }
    }
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
    println!("WARNING: local single-process prototype only; do not expose to the public internet");
    axum::serve(listener, app).await.unwrap_or_else(|e| {
        eprintln!("QUN node server failed: {e}");
        std::process::exit(1);
    });
}
