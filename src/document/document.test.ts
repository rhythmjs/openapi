import { describe, expect, test } from "vite-plus/test";
import { defineDocument } from "./document";

describe("defineDocument", () => {
  test("returns the config unchanged", () => {
    const config = {
      info: { title: "My API", version: "1.0.0" },
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    } as const;

    expect(defineDocument(config)).toBe(config);
  });
});
