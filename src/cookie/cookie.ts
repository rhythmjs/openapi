import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DeriveMiddleware } from "@rhythmjs/rhythm/types";
import type { ParameterOverride } from "../metadata/metadata";
import { collectCookies, schemaMiddleware, type Validated, type ValidationContext } from "../internal/runtime";

export interface ApiCookieOptions {
  overrides?: Record<string, ParameterOverride>;
}

export function apiCookie<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  options: ApiCookieOptions = {},
): DeriveMiddleware<ValidationContext, Validated<"cookie", TSchema>> {
  return schemaMiddleware(
    "cookie",
    schema,
    { parameters: [{ in: "cookie", schema, ...(options.overrides ? { overrides: options.overrides } : {}) }] },
    (ctx) => ({ ok: true, value: collectCookies(ctx.request) }),
  );
}
