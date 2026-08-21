import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMoneyInput,
  isValidMoneyInput,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "./money";

test("money input can stay empty while editing", () => {
  assert.equal(isValidMoneyInput(""), true);
  assert.equal(sanitizeMoneyInput(""), "");
  assert.equal(parseMoneyInput(""), 0);
});

test("money input accepts Portuguese comma and decimal point", () => {
  assert.equal(parseMoneyInput("220,50"), 220.5);
  assert.equal(parseMoneyInput("220.50"), 220.5);
  assert.equal(isValidMoneyInput("220,"), true);
  assert.equal(isValidMoneyInput("220.50"), true);
});

test("money input does not reinsert zero during typing", () => {
  assert.equal(sanitizeMoneyInput("220"), "220");
  assert.equal(formatMoneyInput(parseMoneyInput("220")), "220");
});

test("money input rejects malformed values", () => {
  assert.equal(isValidMoneyInput("22a"), false);
  assert.equal(isValidMoneyInput("1,234"), false);
  assert.equal(sanitizeMoneyInput("22a"), "");
});
