import { moveToFront } from "./order.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("moves an item to the end and keeps the rest in order", () => {
  const list = ["a", "b", "c"];
  assert.equal(moveToFront(list, "a"), true);
  assert.deepEqual(list, ["b", "c", "a"]);
});

test("the item already in front doesn't move, and says so", () => {
  const list = ["a", "b", "c"];
  assert.equal(moveToFront(list, "c"), false);
  assert.deepEqual(list, ["a", "b", "c"]);
});

test("an item that isn't in the list is left out of it", () => {
  const list = ["a", "b"];
  assert.equal(moveToFront(list, "gone"), false);
  assert.deepEqual(list, ["a", "b"]);
});

test("raising each in turn ends with the last one raised in front", () => {
  const list = ["a", "b", "c"];
  moveToFront(list, "b");
  moveToFront(list, "a");
  assert.deepEqual(list, ["c", "b", "a"]);
});
