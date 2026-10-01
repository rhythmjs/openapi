import { describe, expect, test } from "bun:test";
import { fragmentOf } from "../metadata/metadata";
import { apiOperation } from "./operation";

describe("apiOperation", () => {
  test("carries the operation fields as a fragment", () => {
    const middleware = apiOperation({
      summary: "Create user",
      description: "Creates a user account.",
      operationId: "createUser",
      deprecated: true,
      externalDocs: { url: "https://example.com/docs" },
      servers: [{ url: "https://api.example.com" }],
    });

    expect(fragmentOf(middleware)?.operation).toEqual({
      summary: "Create user",
      description: "Creates a user account.",
      operationId: "createUser",
      deprecated: true,
      externalDocs: { url: "https://example.com/docs" },
      servers: [{ url: "https://api.example.com" }],
    });
  });

  test("is a runtime no-op", async () => {
    let called = false;
    await apiOperation({ summary: "x" })(
      {} as never,
      (async () => {
        called = true;
      }) as never,
    );
    expect(called).toBe(true);
  });
});
