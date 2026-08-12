import assert from "node:assert/strict";
import test from "node:test";

import { isCryptoSymbol, marketDetailsHref, parseCryptoSymbol } from "../../src/lib/market-routes.ts";

test("parses supported crypto pairs case-insensitively", () => {
  assert.deepEqual(parseCryptoSymbol("btc-cad"), { base: "BTC", quote: "CAD" });
  assert.deepEqual(parseCryptoSymbol("ETH-USDT"), { base: "ETH", quote: "USDT" });
});

test("does not classify equity or unsupported pairs as crypto", () => {
  assert.equal(isCryptoSymbol("AAPL"), false);
  assert.equal(isCryptoSymbol("BTC-EUR"), false);
});

test("builds canonical detail routes", () => {
  assert.equal(marketDetailsHref("BTC-CAD"), "/discover/markets/crypto/BTC-CAD");
  assert.equal(marketDetailsHref("AAPL"), "/discover/markets/stocks/AAPL");
  assert.equal(marketDetailsHref("CUSTOM", "crypto"), "/discover/markets/crypto/CUSTOM");
});
