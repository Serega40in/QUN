use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Html, Json, Router,
};
use qun_core::{Chain, LedgerState, Transaction};
use serde::{Deserialize, Serialize};
use std::{
    env,
    net::SocketAddr,
    path::{Path as FsPath, PathBuf},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{net::TcpListener, sync::Mutex};

const DASHBOARD: &str = r#"<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QUN Core — Local Explorer</title>
<style>
:root{color-scheme:dark;--bg:#071521;--panel:#102535;--line:#244253;--text:#edf8ff;--muted:#a8c1ce;--blue:#55c7ed;--green:#6ce0b0}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top right,#123c50 0,transparent 45%),var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif}
main{max-width:1040px;margin:auto;padding:28px 18px 60px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}h1{font-size:clamp(28px,5vw,44px);margin:0;letter-spacing:-1.5px}h2{font-size:19px;margin:0 0 14px}.sub{color:var(--muted);margin:8px 0 24px}.pill{border:1px solid var(--line);border-radius:99px;padding:7px 12px;color:var(--green);font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}.panel,.stat{background:linear-gradient(145deg,#102b3c,#0b1d2b);border:1px solid var(--line);border-radius:16px;padding:18px}.label{color:var(--muted);font-size:13px}.value{font-size:27px;font-weight:700;margin-top:5px;overflow-wrap:anywhere}.layout{display:grid;grid-template-columns:1.3fr 1fr;gap:14px}@media(max-width:760px){.layout{grid-template-columns:1fr}}button{background:var(--blue);border:0;color:#05202b;font-weight:700;border-radius:10px;padding:11px 15px;cursor:pointer}button.secondary{background:#19394a;color:var(--text);border:1px solid var(--line)}button:disabled{opacity:.5;cursor:wait}input{width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:#071925;color:var(--text);margin:5px 0 12px}label{font-size:13px;color:var(--muted)}.actions{display:flex;gap:8px;flex-wrap:wrap}.block{padding:12px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.block:last-child{border-bottom:0}.hash{font:12px ui-monospace,monospace;color:var(--muted);word-break:break-all}.notice{color:var(--muted);font-size:13px;margin-top:18px}.status{color:var(--green);min-height:24px}.error{color:#ffb4a8}
</style></head><body><main>
<header><div><h1>QUN Core</h1><div class="sub">Локальный обозреватель блокчейна</div></div><span class="pill">LOCAL DEVNET · НЕ ДЛЯ РЕАЛЬНЫХ СРЕДСТВ</span></header>
<div class="stats"><section class="stat"><div class="label">Статус узла</div><div class="value" id="status">—</div></section><section class="stat"><div class="label">Высота цепочки</div><div class="value" id="height">—</div></section><section class="stat"><div class="label">Всего блоков</div><div class="value" id="count">—</div></section></div>
<div class="layout"><section class="panel"><h2>Блоки</h2><div class="actions"><button class="secondary" onclick="refresh()">Обновить данные</button></div><div id="blocks" class="sub">Загружаем цепочку…</div></section>
<section class="panel"><h2>Создать демонстрационный блок</h2><p class="sub">Только тестовые данные. Эта форма не выполняет проверку подписей или балансов.</p>
<form id="txform"><label for="from">Отправитель (demo)</label><input id="from" value="alice-demo" required maxlength="80"><label for="to">Получатель (demo)</label><input id="to" value="bob-demo" required maxlength="80"><label for="amount">Сумма (условные единицы)</label><input id="amount" type="number" min="1" max="18446744073709551615" value="25" required><label for="nonce">Nonce</label><input id="nonce" type="number" min="0" value="1" required><div class="actions"><button id="submit" type="submit">Создать блок</button></div></form><p id="message" class="status" role="status"></p></section></div>
<p class="notice">Узел работает только на вашем компьютере. Блоки хранятся в локальном JSON-файле. Подписи, консенсус, P2P и полноценное состояние счетов ещё не подключены.</p>
</main><script>
const el=id=>document.getElementById(id);
async function request(path,options){const r=await fetch(path,options);const body=await r.json();if(!r.ok)throw new Error(body.error||('HTTP '+r.status));return body}
async function refresh(){try{const [h,c]=await Promise.all([request('/health'),request('/chain')]);el('status').textContent=h.status==='ok'?'Онлайн':'Ошибка';el('height').textContent=h.height;el('count').textContent=h.blocks;el('blocks').innerHTML='';[...c.blocks].reverse().forEach(b=>{const d=document.createElement('div');d.className='block';const title=document.createElement('strong');title.textContent='Блок #'+b.index+' · '+b.transactions.length+' транз.';const hash=document.createElement('div');hash.className='hash';hash.textContent='Hash: '+b.hash;const prev=document.createElement('div');prev.className='hash';prev.textContent='Prev: '+b.previous_hash;d.append(title,hash,prev);el('blocks').append(d)});if(!c.blocks.length)el('blocks').textContent='Цепочка пока пуста.'}catch(e){el('status').textContent='Нет соединения';el('message').textContent=e.message;el('message').className='status error'}}
el('txform').addEventListener('submit',async e=>{e.preventDefault();const b=el('submit');b.disabled=true;el('message').textContent='Создаём блок…';el('message').className='status';try{const tx={from:el('from').value.trim(),to:el('to').value.trim(),amount:Number(el('amount').value),nonce:Number(el('nonce').value)};if(!tx.from||!tx.to||!Number.isSafeInteger(tx.amount)||tx.amount<1||!Number.isSafeInteger(tx.nonce)||tx.nonce<0)throw new Error('Проверьте адреса, сумму и nonce.');const block=await request('/dev/mine',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transactions:[tx]})});el('message').textContent='Создан блок #'+block.index;el('nonce').value=String(tx.nonce+1);await refresh()}catch(err){el('message').textContent=err.message;el('message').className='status error'}finally{b.disabled=false}});
refresh();
</script></body></html>"#;

async fn dashboard() -> Html<&'static str> {
    Html(DASHBOARD)
}

const MAX_TRANSACTIONS_PER_BLOCK: usize = 1_000;

#[derive(Clone)]
struct AppState {
    snapshot: Arc<Mutex<NodeSnapshot>>,
    data_file: Arc<PathBuf>,
    dev_funding_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NodeSnapshot {
    chain: Chain,
    ledger: LedgerState,
}

impl Default for NodeSnapshot {
    fn default() -> Self { Self { chain: Chain::new(), ledger: LedgerState::default() } }
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    network: &'static str,
    mode: &'static str,
    height: u64,
    blocks: usize,
    warning: &'static str,
    dev_funding_enabled: bool,
}

#[derive(Serialize)]
struct AccountsResponse {
    balances: std::collections::BTreeMap<String, u64>,
    nonces: std::collections::BTreeMap<String, u64>,
}

#[derive(Deserialize)]
struct FundRequest { address: String, amount: u64 }

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
        .map_err(|_| {
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "system clock is before Unix epoch",
            )
        })
}

fn save_snapshot(path: &FsPath, snapshot: &NodeSnapshot) -> Result<(), ApiFailure> {
    let bytes = serde_json::to_vec_pretty(snapshot).map_err(|error| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("serialize node snapshot: {error}"),
        )
    })?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("create data directory: {error}"),
            )
        })?;
    }

    // Write a temporary file first, then atomically replace the previous snapshot.
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, bytes).map_err(|error| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("write temporary snapshot: {error}"),
        )
    })?;
    std::fs::rename(&temporary, path).map_err(|error| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("replace node snapshot file: {error}"),
        )
    })?;
    Ok(())
}

fn load_snapshot(path: &FsPath) -> Result<NodeSnapshot, String> {
    if !path.exists() { return Ok(NodeSnapshot::default()); }
    let bytes = std::fs::read(path).map_err(|error| format!("read {}: {error}", path.display()))?;
    let snapshot = match serde_json::from_slice::<NodeSnapshot>(&bytes) {
        Ok(snapshot) => snapshot,
        Err(_) => {
            let chain: Chain = serde_json::from_slice(&bytes).map_err(|error| format!("parse {} as snapshot or legacy chain: {error}", path.display()))?;
            NodeSnapshot { chain, ledger: LedgerState::default() }
        }
    };
    snapshot.chain.validate().map_err(|error| format!("stored chain failed integrity validation: {error:?}"))?;
    Ok(snapshot)
}

async fn health(State(state): State<AppState>) -> Json<Health> {
    let snapshot = state.snapshot.lock().await;
    Json(Health {
        status: "ok",
        network: "qun-local-dev-v0",
        mode: "single-process-development-only",
        height: snapshot.chain.blocks.last().map(|block| block.index).unwrap_or(0),
        blocks: snapshot.chain.blocks.len(),
        warning:
            "No signatures, consensus, or real assets. Do not expose this API publicly.",
        dev_funding_enabled: state.dev_funding_enabled,
    })
}

async fn get_chain(State(state): State<AppState>) -> Json<Chain> {
    Json(state.snapshot.lock().await.chain.clone())
}

async fn get_accounts(State(state): State<AppState>) -> Json<AccountsResponse> {
    let snapshot = state.snapshot.lock().await;
    Json(AccountsResponse { balances: snapshot.ledger.balances.clone(), nonces: snapshot.ledger.nonces.clone() })
}

async fn dev_fund(State(state): State<AppState>, Json(request): Json<FundRequest>) -> Result<Json<AccountsResponse>, ApiFailure> {
    if !state.dev_funding_enabled {
        return Err(api_error(StatusCode::FORBIDDEN, "development funding is disabled; set QUN_ENABLE_DEV_FUNDING=true for local testing only"));
    }
    if request.amount == 0 || request.address.trim().is_empty() {
        return Err(api_error(StatusCode::BAD_REQUEST, "address must be non-empty and amount must be greater than zero"));
    }
    let mut snapshot = state.snapshot.lock().await;
    let mut next = snapshot.clone();
    next.ledger.set_genesis_balance(request.address, request.amount)
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, format!("invalid funding request: {error:?}")))?;
    save_snapshot(state.data_file.as_path(), &next)?;
    *snapshot = next;
    Ok(Json(AccountsResponse { balances: snapshot.ledger.balances.clone(), nonces: snapshot.ledger.nonces.clone() }))
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
    let mut snapshot = state.snapshot.lock().await;
    let mut next = snapshot.clone();
    for (position, tx) in request.transactions.iter().enumerate() {
        next.ledger.apply(tx).map_err(|error| api_error(StatusCode::UNPROCESSABLE_ENTITY,
            format!("transaction {position} rejected by demo ledger: {error:?}; sender identity is NOT cryptographically authenticated")))?;
    }
    next.chain.append(timestamp, request.transactions);
    next.chain.validate().map_err(|error| api_error(StatusCode::INTERNAL_SERVER_ERROR, format!("new block failed validation: {error:?}")))?;
    save_snapshot(state.data_file.as_path(), &next)?;
    *snapshot = next;
    let block = snapshot.chain.blocks.last().expect("append always creates a block").clone();
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

    let snapshot = load_snapshot(&data_file).map_err(|error| format!("cannot start QUN node: {error}"))?;
    let dev_funding_enabled = env::var("QUN_ENABLE_DEV_FUNDING").map(|v| v == "true" || v == "1").unwrap_or(false);
    let state = AppState { snapshot: Arc::new(Mutex::new(snapshot)), data_file: Arc::new(data_file.clone()), dev_funding_enabled };

    let app = Router::new()
        .route("/", get(dashboard))
        .route("/health", get(health))
        .route("/chain", get(get_chain))
        .route("/accounts", get(get_accounts))
        .route("/blocks/:index", get(get_block))
        .route("/dev/mine", post(dev_mine))
        .route("/dev/fund", post(dev_fund))
        .with_state(state);

    let listener = TcpListener::bind(bind).await?;
    println!("QUN local development node listening on http://{bind}");
    println!("Data file: {}", data_file.display());
    println!("WARNING: local development-only chain; no signatures, consensus, or real assets.");
    println!("Development funding enabled: {dev_funding_enabled} (QUN_ENABLE_DEV_FUNDING)");
    axum::serve(listener, app).await?;
    Ok(())
}
