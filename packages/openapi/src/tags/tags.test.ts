import { describe, expect, test } from "bun:test";
import { fragmentOf } from "../metadata/metadata";
import { apiTags } from "./tags";

describe("apiTags", () => {
  test("carries the tag names as a fragment", () => {
    expect(fragmentOf(apiTags("users", "admin"))?.tags).toEqual(["users", "admin"]);
  });
});
