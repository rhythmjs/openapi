import { describe, expect, test } from "bun:test";
import { fragmentOf } from "../metadata/metadata";
import { apiExtension } from "./extension";

describe("apiExtension", () => {
  test("carries the extension as a fragment", () => {
    expect(fragmentOf(apiExtension("x-codegen-hint", { skip: true }))?.extensions).toEqual({
      "x-codegen-hint": { skip: true },
    });
  });

  test("rejects names that do not start with x-", () => {
    expect(() => apiExtension("nope" as never, 1)).toThrow('must start with "x-"');
  });
});
