const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.WORLD_ENGINE_URL || "http://127.0.0.1:4173/world/engine/index.html";

test("QUN World Engine loads, moves, zooms and bounds its region cache", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.getByText("Мир раскрывается рядом с тобой").waitFor();
    const canvas = page.locator("canvas#world");
    assert.equal(await canvas.count(), 1);
    const before = await page.locator("#region").innerText();
    await page.getByRole("button", { name: "＋ Приблизить" }).click();
    await page.getByRole("button", { name: "＋ Приблизить" }).click();
    await page.getByRole("button", { name: "＋ Приблизить" }).click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#lod").innerText(), "МАКСИМАЛЬНЫЕ");
    await page.getByRole("button", { name: "− Отдалить" }).click();
    await page.getByRole("button", { name: "Вернуться к началу" }).click();
    assert.equal(await page.locator("#region").innerText(), "0 : 0");
    await page.getByRole("button", { name: "Детали: авто" }).click();
    assert.equal(await page.locator("#detail").innerText(), "Детали: эконом");
    await page.mouse.move(195, 400);
    await page.mouse.down();
    await page.mouse.move(30, 400, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.notEqual(await page.locator("#region").innerText(), before, "drag should move observer to another region");
    const cacheText = await page.locator("#cache").innerText();
    const cacheCount = Number(cacheText.split("/")[0].trim());
    assert.ok(cacheCount >= 1 && cacheCount <= 25, `cache must stay within 25 regions; got ${cacheText}`);
    assert.deepEqual(errors, [], "no uncaught browser JavaScript errors");
  } finally {
    await browser.close();
  }
});
