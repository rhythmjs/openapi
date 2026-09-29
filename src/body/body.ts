import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DeriveMiddleware } from "@rhythmjs/rhythm/types";
import type { EncodingObject, ExampleObject, ReferenceObject } from "../types/types";
import type { MediaTypeSpec } from "../metadata/metadata";
import { bodyExtractor, schemaMiddleware, type Validated, type ValidationContext } from "../internal/runtime";

export type {
  Validated,
  ValidationContext,
  ValidationFailure,
  ValidationIssue,
  ValidationTarget,
} from "../internal/runtime";

export interface ApiBodyOptions {
  description?: string;
  required?: boolean;
  contentType?: string;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  encoding?: Record<string, EncodingObject>;
  content?: Record<string, MediaTypeSpec>;
}

export function apiBody<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  options: ApiBodyOptions = {},
): DeriveMiddleware<ValidationContext, Validated<"body", TSchema>> {
  const contentType = options.contentType ?? "application/json";
  const content: Record<string, MediaTypeSpec> = options.content ?? {
    [contentType]: {
      schema,
      ...(options.example !== undefined ? { example: options.example } : {}),
      ...(options.examples ? { examples: options.examples } : {}),
      ...(options.encoding ? { encoding: options.encoding } : {}),
    },
  };

  return schemaMiddleware(
    "body",
    schema,
    {
      requestBody: {
        ...(options.description ? { description: options.description } : {}),
        required: options.required ?? true,
        content,
      },
    },
    bodyExtractor(contentType),
  );
}
