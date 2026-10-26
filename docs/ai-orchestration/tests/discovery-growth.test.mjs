import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const html = readFileSync(resolve(repoRoot, "docs/miniapp/discovery.html"), "utf8");


test("first playable growth loop is present and remains local-first", () => {
  assert.match(html, /id="xpFill"/);
  assert.match(html, /id="seedCount"/);
  assert.match(html, /id="knowledgeCount"/);
  assert.match(html, /id="lumiMessage"/);
  assert.match(html, /id="buildGarden"/);
  assert.match(html, /id="buildObservatory"/);
  assert.match(html, /id="journal"/);
  assert.match(html, /function renderGrowth\(\)/);
  assert.match(html, /function addJournal\(/);
  assert.match(html, /state\.seeds=Math\.min\(999,state\.seeds\+1\)/);
  assert.match(html, /state\.knowledge=Math\.min\(999,state\.knowledge\+1\)/);
  assert.match(html, /state\.build="garden"/);
  assert.match(html, /state\.build="observatory"/);
  assert.match(html, /state\.journal=Array\.isArray\(saved\.journal\)/);
  assert.doesNotMatch(html, /innerHTML/);
  assert.doesNotMatch(html, /https?:\/\/[^"' ]+\.(?:png|jpe?g|webp|svg)/i, "art should not be fetched from external image hosts");
});
