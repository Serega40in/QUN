const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.DISCOVERY_URL || "http://127.0.0.1:4173/miniapp/discovery.html";

test("Discovery plays in a real browser: Lumi, exploration, growth, save and reset", async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  try {
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Твой исследователь" }).waitFor();
    await page.locator("#lumiMessage").getByText("Луми, твой спутник").waitFor();
    assert.equal(await page.locator("#levelTag").innerText(), "УРОВЕНЬ 1");
    assert.equal(await page.locator("#points").innerText(), "0");

    await page.locator('[data-place="forest"]').click();
    assert.equal(await page.locator("#points").innerText(), "10");
    assert.match(await page.locator("#detail").innerText(), /Тихий лес/);
    assert.equal(await page.locator("#seedCount").innerText(), "3");
    assert.equal(await page.locator("#knowledgeCount").innerText(), "1");

    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#points").innerText(), "10", "exploration should persist after reload");
    assert.equal(await page.locator("#seedCount").innerText(), "3", "resources should persist after reload");
    assert.match(await page.locator('[data-place="forest"]').innerText(), /Уже посещено/);

    await page.locator("#buildGarden").click();
    assert.match(await page.locator("#islandTitle").innerText(), /Сад жизни расцветает/);
    assert.equal(await page.locator("#seedCount").innerText(), "1");
    assert.match(await page.locator("#lumiMessage").innerText(), /больше жизни/);
    assert.match(await page.locator("#journal").innerText(), /Сад жизни/);

    await page.locator("#reset").click();
    page.once("dialog", dialog => dialog.accept());
    // The click is initiated after registering the confirmation handler below.
  } finally {
    await browser.close();
  }

  assert.deepEqual(pageErrors, [], "no uncaught browser JavaScript errors");
});
