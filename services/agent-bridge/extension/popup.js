const tokenInput = document.getElementById("token");
const statusBox = document.getElementById("status");

function showStatus(message) {
  statusBox.textContent = message;
}

async function refreshStatus() {
  const stored = await chrome.storage.local.get("bridgeToken");
  tokenInput.value = stored.bridgeToken || "";
  const state = await chrome.runtime.sendMessage({ type: "get_state" });
  if (state?.connected) {
    showStatus("Подключено к локальному QUN Agent Bridge. Расширение готово.");
  } else if (state?.state === "token_required" || !stored.bridgeToken) {
    showStatus("Сначала вставь токен из команды npm run token и сохрани его.");
  } else {
    showStatus("Состояние: " + (state?.state || "не подключено") + ". Проверь, что MCP-хост запустил локальный сервер.");
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    showStatus("Нужен токен из 64 шестнадцатеричных символов. Создай его командой npm run token.");
    return;
  }

  await chrome.storage.local.set({ bridgeToken: token });
  showStatus("Токен сохранён. Подключаюсь…");
  const result = await chrome.runtime.sendMessage({ type: "connect" });
  showStatus(result?.connected
    ? "Подключено к локальному QUN Agent Bridge."
    : "Не удалось подключиться (" + (result?.state || "ошибка") + "). Запусти MCP-хост и проверь токен.");
});

document.getElementById("site").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];

  try {
    const url = new URL(tab?.url || "");
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      showStatus("Для этой страницы доступ нельзя запросить. Открой обычный сайт HTTP или HTTPS.");
      return;
    }

    const granted = await chrome.permissions.request({
      origins: [url.origin + "/*"]
    });
    showStatus(granted
      ? "Доступ разрешён для " + url.origin + ". ИИ сможет читать текст этой страницы."
      : "Разрешение не выдано. Страница останется недоступной для чтения.");
  } catch {
    showStatus("Не удалось определить сайт текущей вкладки.");
  }
});

document.getElementById("tabs").addEventListener("click", async () => {
  const granted = await chrome.permissions.request({ permissions: ["tabs"] });
  showStatus(granted
    ? "Разрешён просмотр списка вкладок и их адресов."
    : "Разрешение на просмотр вкладок не выдано.");
});

refreshStatus().catch(() => showStatus("Не удалось получить состояние расширения."));
