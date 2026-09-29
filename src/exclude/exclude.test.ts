import { describe, expect, test } from "vite-plus/test";
import { fragmentOf } from "../metadata/metadata";
import { apiExclude } from "./exclude";

describe("apiExclude", () => {
  test("carries an exclusion fragment", () => {
    expect(fragmentOf(apiExclude())?.exclude).toBe(true);
  });
});
