import { expect, test } from "vitest";
import { truth } from "../index.js";

test("The extension for XRegExp works correctly", () => {
  expect(truth()).toBe(42);
});
