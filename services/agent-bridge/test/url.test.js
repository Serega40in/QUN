import test from "node:test";
import assert from "node:assert/strict";
import { assertHttpUrl } from "../src/index.js";

test("accepts HTTP and HTTPS URLs", () => {
  assert.equal(assertHttpUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(assertHttpUrl("http://127.0.0.1:3000/"), "http://127.0.0.1:3000/");
});

test("blocks non-web protocols", () => {
  assert.throws(() => assertHttpUrl("file:///C:/secret.txt"), /Only http/);
  assert.throws(() => assertHttpUrl("javascript:alert(1)"), /Only http/);
  assert.throws(() => assertHttpUrl("data:text/html,hello"), /Only http/);
});

test("blocks embedded URL credentials", () => {
  assert.throws(() => assertHttpUrl("https://user:pass@example.com"), /credentials/);
});

test("rejects malformed URLs", () => {
  assert.throws(() => assertHttpUrl("not a URL"), /valid URL/);
});
