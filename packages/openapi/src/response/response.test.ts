import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { fragmentOf } from "../metadata/metadata";
import { apiResponse } from "./response";

describe("apiResponse", () => {
  test("the schema shorthand becomes a JSON content entry", () => {
    const user = z.object({ id: z.string() });

    const fragment = fragmentOf(apiResponse(200, { description: "The user", schema: user }));

    expect(fragment?.responses).toEqual({
      "200": { description: "The user", content: { "application/json": { schema: user } } },
    });
  });

  test("supports default and status ranges as statuses", () => {
    expect(fragmentOf(apiResponse("default", { description: "Unexpected error" }))?.responses).toHaveProperty(
      "default",
    );
    expect(fragmentOf(apiResponse("5XX", { description: "Server error" }))?.responses).toHaveProperty("5XX");
  });

  test("a description-only response carries no content", () => {
    expect(fragmentOf(apiResponse(204, { description: "Deleted" }))?.responses).toEqual({
      "204": { description: "Deleted" },
    });
  });

  test("carries headers, links, and a full content map", () => {
    const fragment = fragmentOf(
      apiResponse(201, {
        description: "Created",
        content: { "text/csv": { schema: { type: "string" } } },
        headers: { location: { description: "URL of the new resource", schema: { type: "string" } } },
        links: { GetUser: { operationId: "getUser", parameters: { id: "$response.body#/id" } } },
      }),
    );

    const created = fragment?.responses?.["201"];
    expect(created).toMatchObject({
      description: "Created",
      content: { "text/csv": { schema: { type: "string" } } },
      headers: { location: { description: "URL of the new resource" } },
      links: { GetUser: { operationId: "getUser" } },
    });
  });
});
