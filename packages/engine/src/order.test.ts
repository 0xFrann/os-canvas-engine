import { cycleOrder, moveToFront } from "./order.ts";
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

test("cycling forward brings the back-most item to the front", () => {
  const list = ["a", "b", "c"];
  assert.equal(cycleOrder(list, "forward"), true);
  assert.deepEqual(list, ["b", "c", "a"]);
});

test("cycling backward sends the front item to the back", () => {
  const list = ["a", "b", "c"];
  assert.equal(cycleOrder(list, "backward"), true);
  assert.deepEqual(list, ["c", "a", "b"]);
});

test("cycling one way then the other leaves the order alone", () => {
  const list = ["a", "b", "c"];
  cycleOrder(list, "forward");
  cycleOrder(list, "backward");
  assert.deepEqual(list, ["a", "b", "c"]);
});

test("cycling as many times as there are items comes back to the start", () => {
  const list = ["a", "b", "c"];
  const fronts = Array.from({ length: list.length }, () => {
    cycleOrder(list, "forward");
    return list.at(-1);
  });
  // Every window is visited once, and the last press restores the order it started in.
  assert.deepEqual(fronts, ["a", "b", "c"]);
  assert.deepEqual(list, ["a", "b", "c"]);
});

test("there is nothing to cycle with one window, or none", () => {
  const one = ["a"];
  assert.equal(cycleOrder(one, "forward"), false);
  assert.deepEqual(one, ["a"]);
  assert.equal(cycleOrder([], "backward"), false);
});
