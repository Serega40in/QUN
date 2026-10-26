import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const htmlPath = resolve(repoRoot, "docs/miniapp/discovery.html");
const assetRoot = resolve(repoRoot, "docs/miniapp/assets/discovery");
const html = readFileSync(htmlPath, "utf8");
const manifest = JSON.parse(readFileSync(resolve(assetRoot, "manifest.json"), "utf8"));

test("inline JavaScript parses without syntax errors", () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, "expected at least one inline script");
  for (const [index, match] of scripts.entries()) {
    assert.doesNotThrow(() => new vm.Script(match[1]), `inline script ${index + 1}`);
  }
  assert.equal((html.match(/<script[^>]+src=/gi) || []).length, 0, "no external script dependencies expected");
});

test("all manifest assets exist and match their declared SVG dimensions", () => {
  assert.equal(manifest.assets.length, 7);
  for (const asset of manifest.assets) {
    const file = resolve(assetRoot, asset.path);
    assert.ok(existsSync(file), `missing asset: ${asset.path}`);
    const svg = readFileSync(file, "utf8");
    assert.match(svg, /<svg\b/, `${asset.path} must contain an SVG root`);
    assert.match(svg, new RegExp(`width=["']${asset.width}["']`));
    assert.match(svg, new RegExp(`height=["']${asset.height}["']`));
    assert.match(svg, /<title\b/, `${asset.path} should include a title`);
    assert.match(svg, /<desc\b/, `${asset.path} should include a description`);
    assert.ok(statSync(file).size > 100, `${asset.path} unexpectedly small`);
  }
});

test("game references existing local art and keeps a text fallback", () => {
  const paths = [...html.matchAll(/(?:src|art)(?:=|:)["'](assets\/discovery\/[^"']+)["']/g)].map(m => m[1]);
  assert.ok(paths.length >= 6, "expected background and five location art references");
  for (const path of paths) {
    assert.ok(existsSync(resolve(dirname(htmlPath), path)), `broken relative asset path: ${path}`);
  }
  assert.match(html, /art\.alt=p\.name/);
  assert.match(html, /art\.onerror=\(\)=>\{art\.hidden=true\}/);
  assert.match(html, /textContent/);
  assert.doesNotMatch(html, /innerHTML/);
});

test("saved location progress is deduplicated before points are recomputed", () => {
  assert.match(html, /saved\.visited\.filter\(\(x,i,a\)=>Object\.prototype\.hasOwnProperty\.call\(places,x\)&&a\.indexOf\(x\)===i\)/);
  assert.match(html, /state\.points=state\.visited\.reduce/);
  assert.match(html, /localStorage/);
  assert.match(html, /id="reset"/);
});
