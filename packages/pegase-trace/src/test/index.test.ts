import { expect, test } from "vitest";
import { truth } from "../index.js";

test("The table tracer works correctly", () => {
  expect(truth()).toBe(42);
});
