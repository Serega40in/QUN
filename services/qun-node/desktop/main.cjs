const { app, BrowserWindow, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

let agent = null;
let windowRef = null;
let updateCheckStarted = false;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
const PORT = Number(process.env.QUN_NODE_PORT || 8787);
const HOST = "127.0.0.1";

function getNodeRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "qun-node");
  return path.resolve(__dirname, "..");
}
function startAgent() {
  const root = getNodeRoot();
  const serverPath = path.join(root, "src", "server.js");
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    QUN_NODE_HOST: HOST,
    QUN_NODE_PORT: String(PORT),
    QUN_NODE_DATA_DIR: path.join(app.getPath("userData"), "node-data"),
    QUN_NODE_PEERS: ""
  };
  agent = spawn(process.execPath, [serverPath], {
    cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  agent.stdout.on("data", data => console.log("[QUN Node]", String(data).trim()));
  agent.stderr.on("data", data => console.error("[QUN Node]", String(data).trim()));
  agent.on("exit", code => {
    agent = null;
    if (!app.isQuitting && windowRef && !windowRef.isDestroyed()) {
      dialog.showMessageBox(windowRef, {
        type: "warning",
        title: "QUN Node остановлен",
        message: "Агент QUN Node завершил работу.",
        detail: "Код завершения: " + code + ". Перезапустите приложение, чтобы запустить узел снова."
      });
    }
  });
}
function waitForDashboard(attempt = 0) {
  return new Promise(resolve => {
    const req = http.get({ host: HOST, port: PORT, path: "/health", timeout: 700 }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        try {
          const status = JSON.parse(body);
          resolve(res.statusCode === 200 && status.service === "qun-node");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => {
      if (attempt >= 40) return resolve(false);
      setTimeout(() => resolve(waitForDashboard(attempt + 1)), 250);
    });
    req.on("timeout", () => req.destroy());
  });
}
function setupAutoUpdates() {
  if (!app.isPackaged || updateCheckStarted) return;
  updateCheckStarted = true;
  autoUpdater.on("checking-for-update", () => console.log("[QUN updater] Checking for updates"));
  autoUpdater.on("update-available", info => {
    console.log("[QUN updater] Update available:", info.version);
  });
  autoUpdater.on("update-not-available", info => console.log("[QUN updater] Up to date:", info.version));
  autoUpdater.on("download-progress", progress => console.log("[QUN updater] Download:", Math.round(progress.percent) + "%"));
  autoUpdater.on("update-downloaded", async info => {
    if (!windowRef || windowRef.isDestroyed()) return;
    const result = await dialog.showMessageBox(windowRef, {
      type: "info", title: "QUN Node — обновление готово",
      message: "Версия " + info.version + " скачана и проверена.",
      detail: "Перезапустить QUN Node сейчас? Данные узла сохранятся.",
      buttons: ["Перезапустить и обновить", "Позже"], defaultId: 0, cancelId: 1
    });
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", error => console.error("[QUN updater] Update error:", error.message));
  setTimeout(() => autoUpdater.checkForUpdates().catch(error => console.error("[QUN updater]", error.message)), 12000);
  setInterval(() => autoUpdater.checkForUpdates().catch(error => console.error("[QUN updater]", error.message)), 6 * 60 * 60 * 1000);
}
async function createWindow() {
  windowRef = new BrowserWindow({
    width: 1180, height: 820, minWidth: 760, minHeight: 620,
    title: "QUN Node", backgroundColor: "#08121f",
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  const ready = await waitForDashboard();
  if (!ready) {
    await dialog.showMessageBox(windowRef, {
      type: "error", title: "QUN Node не запустился",
      message: "Не удалось запустить локальный агент.",
      detail: "Проверьте журналы приложения или обратитесь в поддержку."
    });
    app.quit(); return;
  }
  await windowRef.loadURL("http://" + HOST + ":" + PORT + "/");
  setupAutoUpdates();
  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://github.com/Serega40in/QUN/")) shell.openExternal(url);
    return { action: "deny" };
  });
}
app.whenReady().then(async () => {
  startAgent();
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", () => {
  app.isQuitting = true;
  if (agent && !agent.killed) agent.kill();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
