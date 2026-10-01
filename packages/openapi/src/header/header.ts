import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DeriveMiddleware } from "@rhythmjs/rhythm/types";
import type { ParameterOverride } from "../metadata/metadata";
import { collectHeaders, schemaMiddleware, type Validated, type ValidationContext } from "../internal/runtime";

export interface ApiHeaderOptions {
  overrides?: Record<string, ParameterOverride>;
}

export function apiHeader<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  options: ApiHeaderOptions = {},
): DeriveMiddleware<ValidationContext, Validated<"header", TSchema>> {
  return schemaMiddleware(
    "header",
    schema,
    { parameters: [{ in: "header", schema, ...(options.overrides ? { overrides: options.overrides } : {}) }] },
    (ctx) => ({ ok: true, value: collectHeaders(ctx.request) }),
  );
}
