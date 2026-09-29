import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DeriveMiddleware, Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmRouterContext } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { withFragment, type OperationFragment } from "../metadata/metadata";

export type ValidationTarget = "body" | "query" | "param" | "header" | "cookie";

export type ValidationContext = RhythmHttpContext &
  Partial<RhythmRouterContext> & { valid?: Partial<Record<ValidationTarget, unknown>> };

export type Validated<TTarget extends ValidationTarget, TSchema extends StandardSchemaV1> = {
  valid: { [K in TTarget]: StandardSchemaV1.InferOutput<TSchema> };
};

export interface ValidationIssue {
  message: string;
  path?: readonly (string | number)[];
}

export interface ValidationFailure {
  success: false;
  target: ValidationTarget;
  issues: readonly ValidationIssue[];
}

function serializeIssues(issues: readonly StandardSchemaV1.Issue[]): ValidationIssue[] {
  return issues.map((issue) => {
    const path = issue.path?.map((segment) =>
      typeof segment === "object" && segment !== null && "key" in segment ? segment.key : segment,
    );
    return {
      message: issue.message,
      ...(path ? { path: path.filter((key): key is string | number => typeof key !== "symbol") } : {}),
    };
  });
}

function collectMultiValue(pairs: Iterable<[string, string]>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of pairs) {
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

export function collectQuery(url: string): Record<string, string | string[]> {
  return collectMultiValue(new URL(url).searchParams);
}

export function collectHeaders(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of request.headers) out[key] = value;
  return out;
}

export function collectCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = request.headers.get("cookie");
  if (!header) return out;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (!key) continue;
    let value = pair.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export type ExtractResult = { ok: true; value: unknown } | { ok: false; message: string };

export type Extractor = (ctx: ValidationContext) => ExtractResult | Promise<ExtractResult>;

function parseMultipart(body: string, contentTypeHeader: string): Record<string, string | string[]> | undefined {
  const boundary = /boundary="?([^";]+)"?/i.exec(contentTypeHeader)?.[1];
  if (!boundary) return undefined;
  const pairs: [string, string][] = [];
  for (const part of body.split(`--${boundary}`)) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd);
    const name = /content-disposition:[^\r\n]*\sname="([^"]*)"/i.exec(headers)?.[1];
    if (name === undefined) continue;
    const filename = /\sfilename="([^"]*)"/i.exec(headers)?.[1];
    const value = filename ?? part.slice(headerEnd + 4).replace(/\r\n$/, "");
    pairs.push([name, value]);
  }
  return collectMultiValue(pairs);
}

export function bodyExtractor(contentType: string): Extractor {
  return async (ctx) => {
    if (contentType.includes("json")) {
      try {
        return { ok: true, value: await ctx.request.clone().json() };
      } catch {
        return { ok: false, message: "Malformed JSON in request body" };
      }
    }
    let text: string;
    try {
      text = await ctx.request.clone().text();
    } catch {
      return { ok: false, message: "Unreadable request body" };
    }
    if (contentType.includes("x-www-form-urlencoded")) {
      return { ok: true, value: collectMultiValue(new URLSearchParams(text)) };
    }
    if (contentType.includes("form-data")) {
      const value = parseMultipart(text, ctx.request.headers.get("content-type") ?? contentType);
      return value ? { ok: true, value } : { ok: false, message: "Malformed form data in request body" };
    }
    return { ok: true, value: text };
  };
}

export function schemaMiddleware<TTarget extends ValidationTarget, TSchema extends StandardSchemaV1>(
  target: TTarget,
  schema: TSchema,
  fragment: OperationFragment,
  extract: Extractor,
): DeriveMiddleware<ValidationContext, Validated<TTarget, TSchema>> {
  const middleware: Middleware<ValidationContext> = async (ctx, next) => {
    const fail = (issues: readonly ValidationIssue[]): void => {
      const failure: ValidationFailure = { success: false, target, issues };
      ctx.response.status = 400;
      ctx.response.headers.set("content-type", "application/json");
      ctx.response.body = JSON.stringify(failure);
    };

    const extracted = await extract(ctx);
    if (!extracted.ok) {
      fail([{ message: extracted.message }]);
      return;
    }

    const result = await schema["~standard"].validate(extracted.value);
    if (result.issues) {
      fail(serializeIssues(result.issues));
      return;
    }

    ctx.valid = { ...ctx.valid, [target]: result.value };
    await next();
  };
  return withFragment(middleware, fragment) as DeriveMiddleware<ValidationContext, Validated<TTarget, TSchema>>;
}
