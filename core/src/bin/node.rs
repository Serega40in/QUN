use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use qun_core::{Chain, Transaction};
use serde::{Deserialize, Serialize};
use std::{
    env,
    net::SocketAddr,
    path::{Path as FsPath, PathBuf},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{net::TcpListener, sync::Mutex};

const MAX_TRANSACTIONS_PER_BLOCK: usize = 1_000;

#[derive(Clone)]
struct AppState {
    chain: Arc<Mutex<Chain>>,
    data_file: Arc<PathBuf>,
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    network: &'static str,
    mode: &'static str,
    height: u64,
    blocks: usize,
    warning: &'static str,
}

#[derive(Deserialize)]
struct MineRequest {
    transactions: Vec<Transaction>,
}

#[derive(Serialize)]
struct ApiError {
    error: String,
}

struct ApiFailure(StatusCode, String);

impl IntoResponse for ApiFailure {
    fn into_response(self) -> Response {
        (self.0, Json(ApiError { error: self.1 })).into_response()
    }
}

fn api_error(status: StatusCode, message: impl Into<String>) -> ApiFailure {
    ApiFailure(status, message.into())
}

fn unix_timestamp() -> Result<u64, ApiFailure> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "system clock is before Unix epoch"))
}

fn save_chain(path: &FsPath, chain: &Chain) -> Result<(), ApiFailure> {
    let bytes = serde_json::to_vec_pretty(chain)
        .map_err(|error| api_error(StatusCode::INTERNAL_SERVER_ERROR, format!("serialize chain: {error}")))?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| api_error(StatusCode::INTERNAL_SERVER_ERROR, format!("create data directory: {error}")))?;
    }

    // Write a temporary file first, then atomically replace the previous snapshot.
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, bytes)
        .map_err(|error| api_error(StatusCode::INTERNAL_SERVER_ERROR, format!("write temporary chain: {error}")))?;
    std::fs::rename(&temporary, path)
        .map_err(|error| api_error(StatusCode::INTERNAL_SERVER_ERROR, format!("replace chain file: {error}")))?;
    Ok(())
}

fn load_chain(path: &FsPath) -> Result<Chain, String> {
    if !path.exists() {
        return Ok(Chain::new());
    }
    let bytes = std::fs::read(path).map_err(|error| format!("read {}: {error}", path.display()))?;
    let chain: Chain = serde_json::from_slice(&bytes)
        .map_err(|error| format!("parse {}: {error}", path.display()))?;
    chain.validate().map_err(|error| format!("stored chain failed integrity validation: {error:?}"))?;
    Ok(chain)
}

async fn health(State(state): State<AppState>) -> Json<Health> {
    let chain = state.chain.lock().await;
    Json(Health {
        status: "ok",
        network: "qun-local-dev-v0",
        mode: "single-process-development-only",
        height: chain.blocks.last().map(|block| block.index).unwrap_or(0),
        blocks: chain.blocks.len(),
        warning: "No signatures, balances, consensus, or real assets. Do not expose this API publicly.",
    })
}

async fn get_chain(State(state): State<AppState>) -> Json<Chain> {
    Json(state.chain.lock().await.clone())
}

async fn get_block(
    State(state): State<AppState>,
    Path(index): Path<u64>,
) -> Result<Json<qun_core::Block>, ApiFailure> {
    let chain = state.chain.lock().await;
    chain
        .blocks
        .iter()
        .find(|block| block.index == index)
        .cloned()
        .map(Json)
        .ok_or_else(|| api_error(StatusCode::NOT_FOUND, format!("block {index} not found")))
}

async fn dev_mine(
    State(state): State<AppState>,
    Json(request): Json<MineRequest>,
) -> Result<(StatusCode, Json<qun_core::Block>), ApiFailure> {
    if request.transactions.len() > MAX_TRANSACTIONS_PER_BLOCK {
        return Err(api_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            format!("at most {MAX_TRANSACTIONS_PER_BLOCK} demo transactions per block"),
        ));
    }

    let timestamp = unix_timestamp()?;
    let mut chain = state.chain.lock().await;
    let old_chain = chain.clone();
    chain.append(timestamp, request.transactions);

    if let Err(error) = chain.validate() {
        *chain = old_chain;
        return Err(api_error(StatusCode::INTERNAL_SERVER_ERROR, format!("new block failed validation: {error:?}")));
    }

    if let Err(error) = save_chain(state.data_file.as_path(), &chain) {
        *chain = old_chain;
        return Err(error);
    }

    let block = chain.blocks.last().expect("append always creates a block").clone();
    Ok((StatusCode::CREATED, Json(block)))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Localhost is the safe default. This prototype has no authentication.
    let bind: SocketAddr = env::var("QUN_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8787".to_owned())
        .parse()?;
    let data_file = PathBuf::from(
        env::var("QUN_DATA_FILE").unwrap_or_else(|_| "data/qun-chain.json".to_owned()),
    );

    let chain = load_chain(&data_file)
        .map_err(|error| format!("cannot start QUN node: {error}"))?;
    let state = AppState {
        chain: Arc::new(Mutex::new(chain)),
        data_file: Arc::new(data_file.clone()),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/chain", get(get_chain))
        .route("/blocks/:index", get(get_block))
        .route("/dev/mine", post(dev_mine))
        .with_state(state);

    let listener = TcpListener::bind(bind).await?;
    println!("QUN local development node listening on http://{bind}");
    println!("Data file: {}", data_file.display());
    println!("WARNING: development-only chain; no signatures, balances, consensus, or real assets.");
    axum::serve(listener, app).await?;
    Ok(())
}
