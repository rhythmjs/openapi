import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ExtensionMiddleware, Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmHttpContext } from "@rhythmjs/router/context";
import { withFragment, type OperationFragment } from "../metadata/metadata";

export type ValidationTarget = "body" | "query" | "param" | "header" | "cookie";

export type ValidationContext = RhythmHttpContext & {
  readonly params?: Readonly<Record<string, string>>;
  valid?: Partial<Record<ValidationTarget, unknown>>;
};

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

function collectMultiValue<T>(pairs: Iterable<[string, T]>): Record<string, T | T[]> {
  const out = new Map<string, T | T[]>();
  for (const [key, value] of pairs) {
    const existing = out.get(key);
    if (existing === undefined) out.set(key, value);
    else if (Array.isArray(existing)) existing.push(value);
    else out.set(key, [existing, value]);
  }
  return Object.fromEntries(out);
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

export function bodyExtractor(contentType: string): Extractor {
  return async (ctx) => {
    if (contentType.includes("json")) {
      try {
        return { ok: true, value: await ctx.request.clone().json() };
      } catch {
        return { ok: false, message: "Malformed JSON in request body" };
      }
    }
    if (contentType.includes("form-data")) {
      try {
        return { ok: true, value: collectMultiValue<string | File>(await ctx.request.clone().formData()) };
      } catch {
        return { ok: false, message: "Malformed form data in request body" };
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
    return { ok: true, value: text };
  };
}

export function schemaMiddleware<TTarget extends ValidationTarget, TSchema extends StandardSchemaV1>(
  target: TTarget,
  schema: TSchema,
  fragment: OperationFragment,
  extract: Extractor,
): ExtensionMiddleware<ValidationContext, Validated<TTarget, TSchema>> {
  const middleware: Middleware<ValidationContext> = async (ctx, next) => {
    const fail = (issues: readonly ValidationIssue[]): void => {
      const failure: ValidationFailure = { success: false, target, issues };
      ctx.json(failure, 400);
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
  return withFragment(middleware, fragment) as ExtensionMiddleware<ValidationContext, Validated<TTarget, TSchema>>;
}
