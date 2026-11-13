import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qdxjltqlnphvzafapncm.supabase.co";
const SUPABASE_KEY = "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L";
const AUTH_FUNCTION = SUPABASE_URL + "/functions/v1/qun-auth";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  view: "dashboard",
  orders: [],
  transactions: [],
  tasks: [],
  settings: { goal_amount_usd: 25, goal_label: "ChatGPT Plus", target_plan: "Plus" },
  transactionFilter: "all"
};

const statuses = {
  lead: "Новый контакт",
  contacted: "Связались",
  proposal: "Предложение",
  accepted: "Согласован",
  production: "В работе",
  delivered: "Сдан",
  paid: "Оплачен",
  lost: "Не состоялся"
};
const kinds = { income: "Поступление", expense: "Расход", reserve: "Фонд подписки" };
const priorities = { low: "Низкий", normal: "Обычный", high: "Высокий" };

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch];
  });
}
function money(value, currency) {
  const amount = Number(value || 0);
  const c = currency || "RUB";
  const symbol = { RUB:"₽", EUR:"€", USD:"$", USDT:"USDT" }[c] || c;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount) + " " + symbol;
}
function shortDate(value) {
  if (!value) return "Без срока";
  const date = new Date(value + (String(value).length === 10 ? "T12:00:00" : ""));
  return date.toLocaleDateString("ru-RU", { day:"numeric", month:"short" });
}
function sumByCurrency(items, currency) {
  return items.filter(function(x){ return x.currency === currency; }).reduce(function(s,x){ return s + Number(x.amount || 0); },0);
}
function groupedMoney(items) {
  const currencies = ["RUB","EUR","USD","USDT"];
  return currencies.map(function(c){ return {currency:c, amount:sumByCurrency(items,c)}; }).filter(function(x){return x.amount > 0;});
}
function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(function(){el.classList.remove("show");}, 2600);
}
function showLogin(error) {
  $("app-shell").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  $("login-error").textContent = error || "";
  $("login-password").value = "";
}
function showWorkspace() {
  $("login-screen").classList.add("hidden");
  $("app-shell").classList.remove("hidden");
}
async function loginWithQun(login, password) {
  const response = await fetch(AUTH_FUNCTION, {
    method: "POST",
    headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":"Bearer " + SUPABASE_KEY },
    body: JSON.stringify({ action:"login", login:login, password:password })
  });
  const payload = await response.json().catch(function(){ return {}; });
  if (!response.ok || !payload.session) throw new Error(payload.error || "Не удалось войти через QUN ID.");
  const result = await sb.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token
  });
  if (result.error) throw result.error;
  return result.data.user;
}
async function loadData() {
  const userId = state.user.id;
  const settingResult = await sb.from("ai_income_settings").select("*").eq("user_id", userId).maybeSingle();
  if (settingResult.error) throw settingResult.error;
  if (!settingResult.data) {
    const inserted = await sb.from("ai_income_settings").insert({ user_id:userId }).select("*").single();
    if (inserted.error) throw inserted.error;
    state.settings = inserted.data;
  } else {
    state.settings = settingResult.data;
  }
  const results = await Promise.all([
    sb.from("ai_income_orders").select("*").order("created_at", {ascending:false}),
    sb.from("ai_income_transactions").select("*").order("booked_at", {ascending:false}),
    sb.from("ai_income_tasks").select("*").order("created_at", {ascending:false})
  ]);
  results.forEach(function(r){ if (r.error) throw r.error; });
  state.orders = results[0].data || [];
  state.transactions = results[1].data || [];
  state.tasks = results[2].data || [];
  const username = state.user.user_metadata && state.user.user_metadata.qun_username;
  state.profile = username || "QUN ID";
  $("user-name").textContent = "@" + state.profile;
  $("user-avatar").textContent = String(state.profile).slice(0,1).toUpperCase();
  $("orders-count").textContent = String(state.orders.filter(function(o){return o.status !== "paid" && o.status !== "lost";}).length);
}
async function openWorkspace(user) {
  state.user = user;
  showWorkspace();
  $("view").innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Собираем твои данные…</p></div>';
  try {
    await loadData();
    render();
  } catch (error) {
    console.error(error);
    $("view").innerHTML = '<div class="panel"><h3>Не удалось загрузить данные</h3><p class="inline-muted">' + esc(error.message) + '</p><button class="button button-secondary" data-action="reload">Повторить</button></div>';
  }
}
function heading(kicker, title, description, actions) {
  return '<div class="page-heading"><div><div class="page-eyebrow">' + kicker + '</div><h1>' + title + '</h1><p>' + description + '</p></div><div class="heading-actions">' + (actions || "") + '</div></div>';
}
function actionButton(action, label, secondary) {
  return '<button class="button ' + (secondary ? "button-secondary" : "button-primary") + '" data-action="' + action + '">' + label + '</button>';
}
function metric(label, value, foot, icon) {
  return '<div class="metric-card"><div class="metric-top"><span>' + label + '</span><span class="metric-icon">' + icon + '</span></div><div class="metric-value">' + value + '</div><div class="metric-foot">' + foot + '</div></div>';
}
function empty(title, text) {
  return '<div class="empty-state"><strong>' + title + '</strong>' + text + '</div>';
}
function orderRows(items, limit) {
  const rows = items.slice(0, limit || items.length).map(function(o){
    return '<div class="order-row"><span class="order-dot"></span><div class="order-main"><b>' + esc(o.title) + '</b><small>' + esc(o.client_name || o.platform || "Клиент") + ' · ' + esc(statuses[o.status] || o.status) + '</small></div><div class="order-amount">' + money(o.amount,o.currency) + '</div></div>';
  });
  return rows.length ? rows.join("") : empty("Пока нет заказов","Добавь первый контакт или проект — здесь появится твоя воронка.");
}
function taskRows(items, limit) {
  const rows = items.filter(function(t){return t.status !== "done";}).slice(0,limit || 20).map(function(t){
    return '<div class="task-row"><button class="task-check" data-action="task-done" data-id="' + t.id + '" title="Отметить выполненным"></button><div class="task-main"><b>' + esc(t.title) + '</b><small>' + (t.due_date ? "Срок: " + shortDate(t.due_date) : esc(t.detail || "В плане")) + '</small></div></div>';
  });
  return rows.length ? rows.join("") : empty("План пока свободен","Добавь одно небольшое действие, которое приблизит первый заказ.");
}
function dashboard() {
  const active = state.orders.filter(function(o){return !["paid","lost"].includes(o.status);});
  const paid = state.transactions.filter(function(t){return t.kind === "income";});
  const reserved = state.transactions.filter(function(t){return t.kind === "reserve" && t.currency === "USD";});
  const reserveTotal = sumByCurrency(reserved,"USD");
  const goal = Number(state.settings.goal_amount_usd || 25);
  const percent = Math.min(100, goal ? reserveTotal / goal * 100 : 0);
  const incomeByCurrency = groupedMoney(paid).map(function(x){return money(x.amount,x.currency);}).join(" · ") || "Пока 0 ₽";
  const savedLabel = money(reserveTotal,"USD");
  const nextOrders = state.orders.filter(function(o){return o.status !== "lost";});
  return heading("ТВОЙ РАБОЧИЙ ЦЕНТР","Деньги любят ясность.","Управляй заказами, держи фокус и постепенно собирай фонд на свои инструменты.",
    actionButton("add-order","＋ Добавить заказ") + actionButton("add-transaction","＋ Записать деньги",true)) +
    '<section class="hero-panel"><div class="hero-copy"><div class="page-eyebrow">ПЕРВЫЙ ФИНАНСОВЫЙ РУБЕЖ</div><h2>Сначала создаём ценность.<br>Затем растим доход.</h2><p>Наш ближайший ориентир — оплатить ChatGPT Plus собственными заказами. Без вложений в рекламу и без риска торговлей.</p><button class="button" data-action="go-tasks">Посмотреть план действий <span>→</span></button></div><div class="goal-widget"><div class="goal-head"><span>Фонд подписки · ' + esc(state.settings.goal_label || "ChatGPT Plus") + '</span><span>' + percent.toFixed(0) + '%</span></div><div class="goal-number">' + savedLabel + ' <small>/ ' + money(goal,"USD") + '</small></div><div class="goal-track"><div class="goal-fill" style="width:' + percent + '%"></div></div><div class="goal-foot"><span>Уже отложено</span><span>Цель: ' + esc(state.settings.target_plan || "Plus") + '</span></div><div style="margin-top:13px"><button class="button button-primary" data-action="add-reserve">＋ Отложить в фонд</button></div></div></section>' +
    '<section class="metric-grid">' +
      metric("Активные заказы",String(active.length),"Контакты и проекты в работе","▤") +
      metric("Поступления",incomeByCurrency,"Фактически отмеченные деньги","↗") +
      metric("Отложено на подписку",savedLabel,"Отдельные записи в фонд","◈") +
      metric("Задачи в плане",String(state.tasks.filter(function(t){return t.status !== "done";}).length),"Следующие шаги к заказу","✓") +
    '</section>' +
    '<section class="two-col"><div class="panel"><div class="panel-head"><h3>Последние заказы</h3><button class="panel-link" data-view="orders">Все заказы →</button></div><div class="order-list">' + orderRows(nextOrders,4) + '</div></div><div class="panel"><div class="panel-head"><h3>Ближайшие действия</h3><button class="panel-link" data-view="tasks">Весь план →</button></div><div class="task-list">' + taskRows(state.tasks,4) + '</div></div></section>' +
    '<section class="panel"><div class="panel-head"><div><h3>Что продаём сейчас</h3><small>Стартовые тестовые пакеты S40in AI Studio</small></div></div><div class="service-grid">' +
      serviceCard("AI-креативы","5 визуалов для рекламы, товара или соцсетей","1 990–2 990 ₽","✧","AI-креативы") +
      serviceCard("AI-видеореклама","Короткий вертикальный ролик для бизнеса","3 490–5 990 ₽","▶","AI-видеореклама") +
      serviceCard("Контент-пакет","Комплект материалов в едином стиле","6 990–12 990 ₽","◇","Контент-пакет") +
    '</div></section>';
}
function serviceCard(title, description, price, icon, service) {
  return '<div class="service-card"><div class="service-visual">' + icon + '</div><h4>' + title + '</h4><p>' + description + '</p><div class="service-foot"><span class="service-price">' + price + '</span><button data-action="service-order" data-service="' + esc(service) + '" title="Добавить заказ">＋</button></div></div>';
}
function ordersView() {
  const rows = state.orders.map(function(o){
    const safeLink = /^https?:\/\//i.test(o.link || "") ? '<a href="' + esc(o.link) + '" target="_blank" rel="noopener" class="panel-link">Ссылка ↗</a>' : "";
    return '<tr><td><strong>' + esc(o.title) + '</strong><div class="inline-muted">' + esc(o.client_name || "Без клиента") + ' · ' + esc(o.platform) + '</div></td><td>' + money(o.amount,o.currency) + '</td><td><select class="table-select" data-action="order-status" data-id="' + o.id + '">' + Object.keys(statuses).map(function(k){return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + '>' + statuses[k] + '</option>';}).join("") + '</select></td><td>' + shortDate(o.due_date) + '</td><td>' + safeLink + '</td><td><button class="small-action" data-action="delete-order" data-id="' + o.id + '" title="Удалить">×</button></td></tr>';
  });
  return heading("КЛИЕНТЫ И ПРОЕКТЫ","Заказы","Вся воронка — от первого контакта до получения оплаты.",actionButton("add-order","＋ Новый заказ")) +
    '<section class="panel"><div class="panel-head"><h3>Воронка продаж</h3><span class="inline-muted">' + state.orders.length + ' записей</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ЗАКАЗ / КЛИЕНТ</th><th>СУММА</th><th>СТАТУС</th><th>СРОК</th><th>ССЫЛКА</th><th></th></tr></thead><tbody>' +
    (rows.length ? rows.join("") : '<tr><td colspan="6">' + empty("Заказов пока нет","Добавь первую возможность — будем отслеживать движение к оплате.") + '</td></tr>') +
    '</tbody></table></div></section>';
}
function transactionRows(items) {
  return items.map(function(t){
    const sign = t.kind === "income" ? "+" : t.kind === "expense" ? "−" : "↗";
    const cls = t.kind === "income" ? "status-paid" : t.kind === "expense" ? "status-lost" : "status-proposal";
    return '<div class="transaction-row"><span class="status ' + cls + '">' + sign + '</span><div class="transaction-main"><b>' + esc(t.title) + '</b><small>' + esc(kinds[t.kind] || t.kind) + ' · ' + shortDate(t.booked_at) + (t.note ? ' · ' + esc(t.note) : '') + '</small></div><div class="order-amount">' + (t.kind === "expense" ? "−" : t.kind === "reserve" ? "↗ " : "+") + money(t.amount,t.currency) + '</div><button class="small-action" data-action="delete-transaction" data-id="' + t.id + '" title="Удалить">×</button></div>';
  }).join("");
}
function financeView() {
  const income = state.transactions.filter(function(t){return t.kind === "income";});
  const expense = state.transactions.filter(function(t){return t.kind === "expense";});
  const reserve = state.transactions.filter(function(t){return t.kind === "reserve";});
  const filter = state.transactionFilter;
  const visible = state.transactions.filter(function(t){return filter === "all" || t.kind === filter;});
  const group = function(items){return groupedMoney(items).map(function(x){return money(x.amount,x.currency);}).join(" · ") || "0";};
  return heading("ДЕНЬГИ И РЕЗЕРВ","Финансы","Отмечай фактические поступления, расходы и переводы в фонд подписки.",actionButton("add-transaction","＋ Операция") + actionButton("export-csv","Экспорт CSV",true)) +
    '<section class="finance-summary"><div class="finance-box income"><small>Поступления</small><b>' + group(income) + '</b></div><div class="finance-box expense"><small>Расходы</small><b>' + group(expense) + '</b></div><div class="finance-box reserve"><small>В фонд подписки (USD)</small><b>' + money(sumByCurrency(reserve.filter(function(t){return t.currency === "USD";}),"USD"),"USD") + '</b></div></section>' +
    '<section class="panel"><div class="panel-head"><h3>Журнал операций</h3><div class="segment">' +
      ["all","income","expense","reserve"].map(function(k){return '<button data-action="filter-transactions" data-filter="' + k + '" class="' + (filter === k ? "active" : "") + '">' + ({all:"Все",income:"Доходы",expense:"Расходы",reserve:"Фонд"}[k]) + '</button>';}).join("") +
    '</div></div><div class="transaction-list">' + (visible.length ? transactionRows(visible) : empty("Операций пока нет","Первое поступление или перевод в фонд добавит движение в журнал.")) + '</div></section>' +
    '<p class="inline-muted" style="margin:12px 2px">Важно: разные валюты показываются отдельно. Переводы в фонд подписки записываются в USD; это учёт, а не движение денег в криптокошельке.</p>';
}
function tasksView() {
  const todo = state.tasks.filter(function(t){return t.status === "todo";});
  const doing = state.tasks.filter(function(t){return t.status === "doing";});
  const done = state.tasks.filter(function(t){return t.status === "done";});
  function taskCard(title, items) {
    if (!items.length) return '<div class="empty-state">Задач пока нет</div>';
    return items.map(function(t){
      return '<div class="task-row ' + (t.status === "done" ? "done" : "") + '"><button class="task-check" data-action="task-done" data-id="' + t.id + '">' + (t.status === "done" ? "✓" : "") + '</button><div class="task-main"><b>' + esc(t.title) + '</b><small>' + esc(t.detail || (t.due_date ? shortDate(t.due_date) : priorities[t.priority])) + '</small></div><span class="priority priority-' + t.priority + '">' + priorities[t.priority] + '</span><button class="small-action" data-action="delete-task" data-id="' + t.id + '">×</button></div>';
    }).join("");
  }
  return heading("ФОКУС И ДВИЖЕНИЕ","План действий","Небольшие ежедневные шаги превращаются в оплаченные проекты.",actionButton("add-task","＋ Добавить задачу")) +
    '<section class="task-grid"><div class="task-card"><h3>В плане <span class="inline-muted">· ' + todo.length + '</span></h3>' + taskCard("В плане",todo) + '</div><div class="task-card"><h3>В процессе <span class="inline-muted">· ' + doing.length + '</span></h3>' + taskCard("В процессе",doing) + '</div><div class="task-card"><h3>Завершено <span class="inline-muted">· ' + done.length + '</span></h3>' + taskCard("Завершено",done) + '</div><div class="task-card"><h3>Три приоритета старта</h3><div class="note-box">1. Подготовить 3 демонстрационных кейса для AI Studio.<br>2. Обновить карточку Kwork и портфолио.<br>3. Отправить 5 персональных откликов на подходящие проекты.</div></div></section>';
}
function settingsView() {
  return heading("ПЕРСОНАЛЬНАЯ НАСТРОЙКА","Настройки","Параметры твоей цели и способа работы с фондом.") +
    '<section class="settings-grid"><div class="settings-card"><h3>Финансовая цель</h3><p>Измени название и сумму первого рубежа. Сейчас мы ориентируемся на резерв для оплаты ChatGPT Plus.</p><form id="goal-form"><div class="field"><label>Название цели</label><input name="goal_label" maxlength="60" value="' + esc(state.settings.goal_label) + '" required></div><div class="field"><label>План</label><input name="target_plan" maxlength="30" value="' + esc(state.settings.target_plan) + '" required></div><div class="field"><label>Сумма цели, USD</label><input name="goal_amount_usd" type="number" min="1" step="0.01" value="' + Number(state.settings.goal_amount_usd || 25) + '" required></div><button class="button button-primary" type="submit">Сохранить цель</button></form></div><div class="settings-card"><h3>Аккаунт и безопасность</h3><p>Вход осуществляется через действующую систему QUN ID. Панель не хранит пароль и не использует отдельную регистрацию.</p><div class="note-box">Аккаунт: <b>@' + esc(state.profile) + '</b><br>Данные заказов и финансов ограничены текущим пользователем с помощью RLS в Supabase.</div><div style="margin-top:15px"><button class="button button-secondary" data-action="logout">Выйти из QUN ID</button></div></div></section>' +
    '<section class="panel" style="margin-top:15px"><div class="panel-head"><h3>Принцип учёта</h3></div><p class="inline-muted" style="line-height:1.7">Поступления, расходы и фонд подписки — разные типы операций. Отложенная сумма считается только по операциям «Фонд подписки» в USD. Она не означает, что деньги уже находятся в Telegram Wallet или на криптоадресе. Фактический перевод средств всегда выполняется отдельно владельцем.</p></section>';
}
function render() {
  $("orders-count").textContent = String(state.orders.filter(function(o){return !["paid","lost"].includes(o.status);}).length);
  const views = { dashboard:dashboard, orders:ordersView, finance:financeView, tasks:tasksView, settings:settingsView };
  $("view").innerHTML = (views[state.view] || dashboard)();
  document.querySelectorAll(".nav-item").forEach(function(el){ el.classList.toggle("active",el.dataset.view === state.view); });
}
function openModal(title, body) {
  $("modal-root").innerHTML = '<div class="modal-backdrop" data-action="backdrop"><section class="modal-card"><div class="modal-head"><h3>' + title + '</h3><button class="modal-close" data-action="close-modal">×</button></div>' + body + '</section></div>';
}
function field(label, name, type, value, placeholder, full) {
  return '<div class="field ' + (full ? "full" : "") + '"><label>' + label + '</label><input name="' + name + '" type="' + (type || "text") + '" value="' + esc(value || "") + '" placeholder="' + esc(placeholder || "") + '"></div>';
}
function openOrderModal(prefill) {
  const p = prefill || {};
  openModal("Новый заказ",
    '<form data-form="order"><div class="form-grid">' +
    field("Название проекта *","title","text",p.title,"Например, видео для кофейни",true) +
    field("Клиент","client_name","text","","Компания или контакт") +
    '<div class="field"><label>Источник</label><select name="platform"><option>Kwork</option><option>Avito</option><option>Telegram</option><option>Direct</option><option>Другой</option></select></div>' +
    field("Услуга","service","text",p.service,"AI-видео, креативы…") +
    field("Сумма","amount","number","","0") +
    '<div class="field"><label>Валюта</label><select name="currency"><option value="RUB">RUB · ₽</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option><option value="USDT">USDT</option></select></div>' +
    '<div class="field"><label>Статус</label><select name="status">' + Object.keys(statuses).map(function(k){return '<option value="' + k + '">' + statuses[k] + '</option>';}).join("") + '</select></div>' +
    field("Срок","due_date","date","","") +
    field("Ссылка на заказ","link","url","","https://…",true) +
    '<div class="field full"><label>Заметки</label><textarea name="notes" placeholder="Что важно помнить о проекте…"></textarea></div>' +
    '</div><div class="modal-actions"><button class="button button-quiet" type="button" data-action="close-modal">Отмена</button><button class="button button-primary" type="submit">Сохранить заказ</button></div></form>'
  );
  if (p.service) {
    const serviceInput = $("modal-root").querySelector('[name="service"]');
    if (serviceInput) serviceInput.value = p.service;
  }
}
function openTransactionModal(kind) {
  const reserve = kind === "reserve";
  openModal(reserve ? "Пополнить фонд подписки" : "Новая финансовая операция",
    '<form data-form="transaction"><div class="form-grid">' +
    '<div class="field full"><label>Тип операции</label><select name="kind" id="transaction-kind"><option value="income"' + (kind === "income" ? " selected" : "") + '>Поступление</option><option value="expense"' + (kind === "expense" ? " selected" : "") + '>Расход</option><option value="reserve"' + (reserve ? " selected" : "") + '>Фонд подписки</option></select></div>' +
    field("Название *","title","text",reserve ? "Отложено на ChatGPT Plus" : "","Например, оплата заказа",true) +
    field("Сумма *","amount","number","","0") +
    '<div class="field"><label>Валюта</label><select name="currency" id="transaction-currency"><option value="RUB">RUB · ₽</option><option value="USD"' + (reserve ? " selected" : "") + '>USD · $</option><option value="EUR">EUR · €</option><option value="USDT">USDT</option></select></div>' +
    '<div class="field"><label>Связанный заказ</label><select name="order_id"><option value="">Не привязывать</option>' + state.orders.map(function(o){return '<option value="' + o.id + '">' + esc(o.title) + '</option>';}).join("") + '</select></div>' +
    '<div class="field full"><label>Комментарий</label><textarea name="note" placeholder="Источник, комиссия, детали…"></textarea></div>' +
    '</div><div class="note-box" style="margin-top:12px">В фонд подписки записывается сумма в USD. Это только учёт резерва — не перевод в блокчейн.</div><div class="modal-actions"><button class="button button-quiet" type="button" data-action="close-modal">Отмена</button><button class="button button-primary" type="submit">Сохранить операцию</button></div></form>'
  );
  const kindSelect = $("transaction-kind");
  const currencySelect = $("transaction-currency");
  kindSelect.addEventListener("change", function(){ if (kindSelect.value === "reserve") currencySelect.value = "USD"; });
}
function openTaskModal() {
  openModal("Новая задача",
    '<form data-form="task"><div class="form-grid">' +
    field("Что нужно сделать *","title","text","","Например, подготовить кейс для портфолио",true) +
    '<div class="field"><label>Приоритет</label><select name="priority"><option value="normal">Обычный</option><option value="high">Высокий</option><option value="low">Низкий</option></select></div>' +
    field("Срок","due_date","date","","") +
    '<div class="field full"><label>Детали</label><textarea name="detail" placeholder="Короткая заметка или следующий шаг"></textarea></div>' +
    '</div><div class="modal-actions"><button class="button button-quiet" type="button" data-action="close-modal">Отмена</button><button class="button button-primary" type="submit">Добавить задачу</button></div></form>'
  );
}
async function refresh() { await loadData(); render(); }
async function saveForm(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const fd = new FormData(form);
  const kind = form.dataset.form;
  let result;
  if (kind === "order") {
    const payload = {
      user_id:state.user.id,
      title:String(fd.get("title") || "").trim(),
      client_name:String(fd.get("client_name") || "").trim(),
      platform:String(fd.get("platform") || "Direct"),
      service:String(fd.get("service") || "").trim(),
      amount:Number(fd.get("amount") || 0),
      currency:String(fd.get("currency") || "RUB"),
      status:String(fd.get("status") || "lead"),
      due_date:fd.get("due_date") || null,
      link:String(fd.get("link") || "").trim(),
      notes:String(fd.get("notes") || "").trim()
    };
    if (!payload.title) return showToast("Добавь название заказа.");
    if (payload.link && !/^https?:\/\//i.test(payload.link)) return showToast("Ссылка должна начинаться с https://");
    result = await sb.from("ai_income_orders").insert(payload);
  } else if (kind === "transaction") {
    const transactionKind = String(fd.get("kind"));
    const payload = {
      user_id:state.user.id,
      kind:transactionKind,
      title:String(fd.get("title") || "").trim(),
      amount:Number(fd.get("amount") || 0),
      currency:transactionKind === "reserve" ? "USD" : String(fd.get("currency") || "RUB"),
      order_id:String(fd.get("order_id") || "") || null,
      note:String(fd.get("note") || "").trim()
    };
    if (!payload.title || !(payload.amount > 0)) return showToast("Проверь название и сумму операции.");
    result = await sb.from("ai_income_transactions").insert(payload);
  } else if (kind === "task") {
    const payload = {
      user_id:state.user.id,
      title:String(fd.get("title") || "").trim(),
      detail:String(fd.get("detail") || "").trim(),
      priority:String(fd.get("priority") || "normal"),
      due_date:fd.get("due_date") || null
    };
    if (!payload.title) return showToast("Добавь название задачи.");
    result = await sb.from("ai_income_tasks").insert(payload);
  }
  if (result && result.error) { console.error(result.error); return showToast("Не удалось сохранить: " + result.error.message); }
  $("modal-root").innerHTML = "";
  await refresh();
  showToast("Сохранено.");
}
async function handleClick(event) {
  const nav = event.target.closest("[data-view]");
  if (nav && nav.dataset.view) {
    state.view = nav.dataset.view;
    render();
    return;
  }
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "close-modal" || (action === "backdrop" && event.target === el)) $("modal-root").innerHTML = "";
  if (action === "add-order") openOrderModal();
  if (action === "service-order") openOrderModal({title:el.dataset.service,service:el.dataset.service});
  if (action === "add-transaction") openTransactionModal();
  if (action === "add-reserve") openTransactionModal("reserve");
  if (action === "add-task") openTaskModal();
  if (action === "go-tasks") { state.view = "tasks"; render(); }
  if (action === "reload") await openWorkspace(state.user);
  if (action === "logout") await logout();
  if (action === "filter-transactions") { state.transactionFilter = el.dataset.filter; state.view="finance"; render(); }
  if (action === "task-done") {
    const task = state.tasks.find(function(t){return t.id === el.dataset.id;});
    if (task) {
      const done = task.status !== "done";
      const r = await sb.from("ai_income_tasks").update({status:done ? "done" : "todo",completed_at:done ? new Date().toISOString() : null}).eq("id",task.id);
      if (r.error) return showToast(r.error.message);
      await refresh();
    }
  }
  if (action === "delete-order" && window.confirm("Удалить этот заказ?")) {
    const r = await sb.from("ai_income_orders").delete().eq("id",el.dataset.id);
    if (r.error) return showToast(r.error.message);
    await refresh(); showToast("Заказ удалён.");
  }
  if (action === "delete-transaction" && window.confirm("Удалить эту операцию?")) {
    const r = await sb.from("ai_income_transactions").delete().eq("id",el.dataset.id);
    if (r.error) return showToast(r.error.message);
    await refresh(); showToast("Операция удалена.");
  }
  if (action === "delete-task" && window.confirm("Удалить задачу?")) {
    const r = await sb.from("ai_income_tasks").delete().eq("id",el.dataset.id);
    if (r.error) return showToast(r.error.message);
    await refresh(); showToast("Задача удалена.");
  }
  if (action === "export-csv") exportCsv();
}
async function updateOrderStatus(event) {
  const select = event.target.closest('select[data-action="order-status"]');
  if (!select) return;
  const r = await sb.from("ai_income_orders").update({status:select.value,updated_at:new Date().toISOString()}).eq("id",select.dataset.id);
  if (r.error) return showToast(r.error.message);
  await refresh(); showToast("Статус обновлён.");
}
async function saveGoal(event) {
  if (event.target.id !== "goal-form") return;
  event.preventDefault();
  const fd = new FormData(event.target);
  const amount = Number(fd.get("goal_amount_usd"));
  if (!(amount > 0)) return showToast("Сумма цели должна быть больше нуля.");
  const result = await sb.from("ai_income_settings").update({
    goal_amount_usd:amount,
    goal_label:String(fd.get("goal_label") || "ChatGPT Plus").trim(),
    target_plan:String(fd.get("target_plan") || "Plus").trim(),
    updated_at:new Date().toISOString()
  }).eq("user_id",state.user.id).select("*").single();
  if (result.error) return showToast(result.error.message);
  state.settings = result.data;
  render(); showToast("Цель обновлена.");
}
function exportCsv() {
  const rows = [["Дата","Тип","Название","Сумма","Валюта","Комментарий"]];
  state.transactions.forEach(function(t){rows.push([t.booked_at,kinds[t.kind] || t.kind,t.title,t.amount,t.currency,t.note || ""]);});
  const csv = rows.map(function(row){return row.map(function(cell){return '"' + String(cell).replace(/"/g,'""') + '"';}).join(";");}).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="s40in-ai-income-finances.csv"; a.click(); URL.revokeObjectURL(url);
}
async function logout() {
  await sb.auth.signOut();
  state.user = null; state.orders=[]; state.transactions=[]; state.tasks=[];
  showLogin();
}
$("login-form").addEventListener("submit", async function(event){
  event.preventDefault();
  const button = event.target.querySelector("button[type=submit]");
  const login = $("login-name").value.trim();
  const password = $("login-password").value;
  $("login-error").textContent = "";
  button.disabled = true; button.querySelector("span").textContent = "Проверяем QUN ID…";
  try {
    const user = await loginWithQun(login,password);
    $("login-password").value = "";
    await openWorkspace(user);
  } catch (error) {
    $("login-error").textContent = error.message || "Ошибка входа. Проверь логин и пароль.";
  } finally {
    button.disabled = false; button.querySelector("span").textContent = "Войти через QUN ID";
  }
});
$("logout-button").addEventListener("click",logout);
document.addEventListener("click",handleClick);
document.addEventListener("submit",function(event){saveForm(event).catch(function(e){console.error(e);showToast("Ошибка сохранения.");});saveGoal(event).catch(function(e){console.error(e);showToast("Не удалось сохранить цель.");});});
document.addEventListener("change",function(event){updateOrderStatus(event).catch(function(e){console.error(e);showToast("Не удалось обновить статус.");});});

sb.auth.onAuthStateChange(function(event,session){
  if (event === "SIGNED_OUT") showLogin();
});
const initial = await sb.auth.getSession();
if (initial.data && initial.data.session) {
  await openWorkspace(initial.data.session.user);
} else {
  showLogin();
}
