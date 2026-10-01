import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import type { ExampleObject, LinkObject, ReferenceObject } from "../types/types";
import { docOnly, type HeaderSpec, type MediaTypeSpec, type ResponseSpec, type SchemaLike } from "../metadata/metadata";

export type ResponseStatus = number | "default" | "1XX" | "2XX" | "3XX" | "4XX" | "5XX";

export interface ApiResponseOptions {
  description: string;
  schema?: SchemaLike;
  contentType?: string;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  content?: Record<string, MediaTypeSpec>;
  headers?: Record<string, HeaderSpec | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
}

export function apiResponse(status: ResponseStatus, options: ApiResponseOptions): Middleware<RhythmHttpContext> {
  const hasShorthand = options.schema !== undefined || options.example !== undefined || options.examples;
  const content =
    options.content ??
    (hasShorthand
      ? {
          [options.contentType ?? "application/json"]: {
            ...(options.schema !== undefined ? { schema: options.schema } : {}),
            ...(options.example !== undefined ? { example: options.example } : {}),
            ...(options.examples ? { examples: options.examples } : {}),
          } satisfies MediaTypeSpec,
        }
      : undefined);

  const spec: ResponseSpec = {
    description: options.description,
    ...(content ? { content } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.links ? { links: options.links } : {}),
  };

  return docOnly({ responses: { [String(status)]: spec } });
}
