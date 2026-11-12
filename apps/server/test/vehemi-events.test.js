import { test } from "node:test";
import assert from "node:assert/strict";
import { settleVeHemiCancels } from "../lib/vehemi-events.js";

const row = (type, tx, tokenId, from, extra = {}) => ({ type, tx, tokenId, from, market: "vehemi", ...extra });
const SELLER = "0x" + "a".repeat(40);
const OTHER = "0x" + "b".repeat(40);

test("a cancel on its own is a delisting", () => {
  const rows = [row("CANCEL", "0x1", "5", SELLER)];
  assert.deepEqual(settleVeHemiCancels(rows).map((r) => r.type), ["CANCEL"]);
});

test("listing again in the same transaction is a price change, not a delisting", () => {
  const rows = [row("CANCEL", "0x2", "5", SELLER), row("LIST", "0x2", "5", SELLER)];
  assert.deepEqual(settleVeHemiCancels(rows).map((r) => r.type), ["UPDATE"]);
});

test("a new holder's listing clears the old holder's: that's a new listing", () => {
  const rows = [row("CANCEL", "0x3", "5", OTHER), row("LIST", "0x3", "5", SELLER)];
  assert.deepEqual(settleVeHemiCancels(rows).map((r) => r.type), ["LIST"]);
});

test("accepting an offer clears the listing: only the sale is kept", () => {
  const rows = [row("CANCEL", "0x4", "5", SELLER), row("SOLD", "0x4", "5", SELLER, { viaOffer: true })];
  assert.deepEqual(settleVeHemiCancels(rows).map((r) => r.type), ["SOLD"]);
});

test("a cancel only pairs with events on the same position", () => {
  const rows = [row("CANCEL", "0x5", "5", SELLER), row("LIST", "0x5", "6", SELLER)];
  assert.deepEqual(settleVeHemiCancels(rows).map((r) => r.type).sort(), ["CANCEL", "LIST"]);
});
