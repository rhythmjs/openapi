import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import * as v from "valibot";
import { isStandardSchema, resolveSchema } from "./resolver";

describe("resolver", () => {
  test("isStandardSchema distinguishes Standard Schemas from raw JSON Schemas", () => {
    expect(isStandardSchema(z.string())).toBe(true);
    expect(isStandardSchema(v.string())).toBe(true);
    expect(isStandardSchema({ type: "string" })).toBe(false);
  });

  test("raw JSON Schemas pass through untouched", async () => {
    const raw = { type: "object", properties: { id: { type: "string" } } };

    expect(await resolveSchema(raw, "input")).toBe(raw);
  });

  test("converts zod schemas via the native z.toJSONSchema", async () => {
    const schema = z.object({ name: z.string(), age: z.number().int().optional() });

    const json = (await resolveSchema(schema, "input")) as Record<string, unknown>;

    expect(json.type).toBe("object");
    expect((json.properties as Record<string, Record<string, unknown>>).name.type).toBe("string");
    expect(json.required).toEqual(["name"]);
    expect(json).not.toHaveProperty("$schema");
  });

  test("documents the input side of coercing zod schemas when io is input", async () => {
    const schema = z.object({ createdAt: z.iso.datetime() });

    const json = (await resolveSchema(schema, "input")) as Record<string, unknown>;

    expect((json.properties as Record<string, Record<string, unknown>>).createdAt.type).toBe("string");
  });

  test("converts valibot schemas via @valibot/to-json-schema", async () => {
    const schema = v.object({ page: v.string() });

    const json = (await resolveSchema(schema, "input")) as Record<string, unknown>;

    expect(json.type).toBe("object");
    expect((json.properties as Record<string, Record<string, unknown>>).page.type).toBe("string");
  });

  test("a converter passed via options wins over built-ins and unlocks unknown vendors", async () => {
    const fake = {
      "~standard": { version: 1, vendor: "acme", validate: (value: unknown) => ({ value }) },
    } as never;

    const json = await resolveSchema(fake, "output", { converters: { acme: () => ({ type: "integer" }) } });

    expect(json).toEqual({ type: "integer" });
  });

  test("throws a descriptive error for an unknown vendor without a converter", async () => {
    const fake = {
      "~standard": { version: 1, vendor: "mystery", validate: (value: unknown) => ({ value }) },
    } as never;

    await expect(resolveSchema(fake, "input")).rejects.toThrow('vendor "mystery"');
  });
});
