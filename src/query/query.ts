import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DeriveMiddleware } from "@rhythmjs/rhythm/types";
import type { ParameterOverride } from "../metadata/metadata";
import { collectQuery, schemaMiddleware, type Validated, type ValidationContext } from "../internal/runtime";

export interface ApiQueryOptions {
  overrides?: Record<string, ParameterOverride>;
}

export function apiQuery<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  options: ApiQueryOptions = {},
): DeriveMiddleware<ValidationContext, Validated<"query", TSchema>> {
  return schemaMiddleware(
    "query",
    schema,
    { parameters: [{ in: "query", schema, ...(options.overrides ? { overrides: options.overrides } : {}) }] },
    (ctx) => ({ ok: true, value: collectQuery(ctx.request.url) }),
  );
}
