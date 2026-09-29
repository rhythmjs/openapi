import type {
  ComponentsObject,
  HeaderObject,
  MediaTypeObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  PathsObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
  SecurityRequirementObject,
} from "../types/types";
import {
  fragmentOf,
  type HeaderSpec,
  type MediaTypeSpec,
  type OperationFragment,
  type ParameterGroupSpec,
  type RequestBodySpec,
  type ResponseSpec,
  type SchemaLike,
} from "../metadata/metadata";
import { resolveSchema, type ResolverOptions, type SchemaIO } from "../resolver/resolver";
import type { OpenAPIConfig } from "../document/document";

export interface RouterSource {
  readonly entries: ReadonlyArray<
    | { readonly kind: "middleware"; readonly fn: unknown }
    | { readonly kind: "route"; readonly method: string; readonly path: string; readonly handlers: readonly unknown[] }
  >;
}

export interface GenerateOptions extends ResolverOptions {
  openapi?: string;
  includeUndocumented?: boolean;
}

const DEFS_PREFIX = "#/$defs/";

function rewriteRefs(node: unknown, rename: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(node)) return node.map((item) => rewriteRefs(item, rename));
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string" && value.startsWith(DEFS_PREFIX)) {
      const name = value.slice(DEFS_PREFIX.length);
      out[key] = `#/components/schemas/${rename.get(name) ?? name}`;
    } else {
      out[key] = rewriteRefs(value, rename);
    }
  }
  return out;
}

function hoistDefs(schema: SchemaObject, sink: Record<string, SchemaObject>): SchemaObject {
  if (typeof schema !== "object" || schema === null || !("$defs" in schema)) return schema;
  const { $defs, ...rest } = schema;
  const defs = $defs as Record<string, SchemaObject>;

  const rename = new Map<string, string>();
  for (const [name, def] of Object.entries(defs)) {
    let final = name;
    let suffix = 2;
    while (final in sink && JSON.stringify(sink[final]) !== JSON.stringify(def)) final = `${name}_${suffix++}`;
    rename.set(name, final);
  }
  for (const [name, def] of Object.entries(defs)) {
    sink[rename.get(name)!] = rewriteRefs(def, rename) as SchemaObject;
  }
  return rewriteRefs(rest, rename) as SchemaObject;
}

function isReference(value: object): value is ReferenceObject {
  return "$ref" in value;
}

function toOpenAPIPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) return `{${segment.slice(1)}}`;
      if (segment === "*") return "{wildcard}";
      return segment;
    })
    .join("/");
}

type Resolve = (schema: SchemaLike, io: SchemaIO) => Promise<SchemaObject>;

async function toMediaType(spec: MediaTypeSpec, io: SchemaIO, resolve: Resolve): Promise<MediaTypeObject> {
  const { schema, ...rest } = spec;
  return { ...rest, ...(schema !== undefined ? { schema: await resolve(schema, io) } : {}) };
}

async function toContent(
  content: Record<string, MediaTypeSpec>,
  io: SchemaIO,
  resolve: Resolve,
): Promise<Record<string, MediaTypeObject>> {
  const out: Record<string, MediaTypeObject> = {};
  for (const [mediaType, spec] of Object.entries(content)) out[mediaType] = await toMediaType(spec, io, resolve);
  return out;
}

async function toRequestBody(spec: RequestBodySpec, resolve: Resolve): Promise<RequestBodyObject> {
  const { content, ...rest } = spec;
  return { ...rest, content: await toContent(content, "input", resolve) };
}

async function toResponse(spec: ResponseSpec, resolve: Resolve): Promise<ResponseObject> {
  const { content, headers, ...rest } = spec;
  const out: ResponseObject = { ...rest };
  if (content) out.content = await toContent(content, "output", resolve);
  if (headers) {
    const converted: Record<string, HeaderObject | ReferenceObject> = {};
    for (const [name, header] of Object.entries(headers)) {
      if (isReference(header)) {
        converted[name] = header;
      } else {
        const { schema, ...headerRest } = header as HeaderSpec;
        converted[name] = {
          ...headerRest,
          ...(schema !== undefined ? { schema: await resolve(schema, "output") } : {}),
        };
      }
    }
    out.headers = converted;
  }
  return out;
}

async function expandParameters(
  group: ParameterGroupSpec,
  sink: Map<string, ParameterObject>,
  resolve: Resolve,
): Promise<void> {
  const resolved = await resolve(group.schema, "input");
  if (typeof resolved !== "object" || resolved === null) return;
  const properties = (resolved.properties ?? {}) as Record<string, SchemaObject>;
  const required = Array.isArray(resolved.required) ? (resolved.required as string[]) : [];

  for (const [name, propertySchema] of Object.entries(properties)) {
    const override = group.overrides?.[name] ?? {};
    const { required: overrideRequired, ...overrideRest } = override;
    const parameter: ParameterObject = {
      name,
      in: group.in,
      required: group.in === "path" ? true : (overrideRequired ?? required.includes(name)),
      schema: propertySchema,
      ...overrideRest,
    };
    sink.set(`${group.in}:${name}`, parameter);
  }
}

async function buildOperation(
  fragments: readonly OperationFragment[],
  resolve: Resolve,
): Promise<OperationObject | undefined> {
  const tags: string[] = [];
  const security: SecurityRequirementObject[] = [];
  let noSecurity = false;
  const parameters = new Map<string, ParameterObject>();
  let requestBody: RequestBodyObject | undefined;
  const responses: ResponsesObject = {};
  const callbacks: NonNullable<OperationObject["callbacks"]> = {};
  const fields: Partial<OperationObject> = {};
  const extensions: Record<string, unknown> = {};

  for (const fragment of fragments) {
    if (fragment.exclude) return undefined;
    if (fragment.operation) Object.assign(fields, fragment.operation);
    for (const tag of fragment.tags ?? []) {
      if (!tags.includes(tag)) tags.push(tag);
    }
    if (fragment.security === "none") {
      noSecurity = true;
    } else {
      for (const requirement of fragment.security ?? []) {
        if (!security.some((existing) => JSON.stringify(existing) === JSON.stringify(requirement))) {
          security.push(requirement);
        }
      }
    }
    for (const group of fragment.parameters ?? []) await expandParameters(group, parameters, resolve);
    if (fragment.requestBody) requestBody = await toRequestBody(fragment.requestBody, resolve);
    for (const [status, spec] of Object.entries(fragment.responses ?? {})) {
      responses[status] = isReference(spec) ? spec : await toResponse(spec, resolve);
    }
    Object.assign(callbacks, fragment.callbacks);
    Object.assign(extensions, fragment.extensions);
  }

  return {
    ...(tags.length ? { tags } : {}),
    ...fields,
    ...(parameters.size ? { parameters: [...parameters.values()] } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: Object.keys(responses).length ? responses : { "200": { description: "Successful response" } },
    ...(Object.keys(callbacks).length ? { callbacks } : {}),
    ...(noSecurity ? { security: [] } : security.length ? { security } : {}),
    ...extensions,
  };
}

export async function generate(
  router: RouterSource,
  config: OpenAPIConfig,
  options: GenerateOptions = {},
): Promise<OpenAPIObject> {
  const schemas: Record<string, SchemaObject> = {};
  const resolve: Resolve = async (schema, io) => hoistDefs(await resolveSchema(schema, io, options), schemas);

  const paths: PathsObject = {};
  const inherited: OperationFragment[] = [];

  for (const entry of router.entries) {
    if (entry.kind === "middleware") {
      const fragment = fragmentOf(entry.fn);
      if (fragment) inherited.push(fragment);
      continue;
    }

    const own = entry.handlers.map(fragmentOf).filter((fragment): fragment is OperationFragment => !!fragment);
    if (!own.length && !(options.includeUndocumented ?? true)) continue;

    const operation = await buildOperation([...inherited, ...own], resolve);
    if (!operation) continue;

    const path = toOpenAPIPath(entry.path);
    const method = entry.method.toLowerCase() as keyof PathItemObject;
    (paths[path] ??= {})[method] = operation as never;
  }

  const components: ComponentsObject = { ...config.components };
  if (config.securitySchemes) {
    components.securitySchemes = { ...components.securitySchemes, ...config.securitySchemes };
  }
  if (Object.keys(schemas).length) {
    components.schemas = { ...components.schemas, ...schemas };
  }

  return {
    openapi: options.openapi ?? "3.1.1",
    info: config.info,
    ...(config.jsonSchemaDialect ? { jsonSchemaDialect: config.jsonSchemaDialect } : {}),
    ...(config.servers ? { servers: config.servers } : {}),
    paths,
    ...(config.webhooks ? { webhooks: config.webhooks } : {}),
    ...(Object.keys(components).length ? { components } : {}),
    ...(config.security ? { security: config.security } : {}),
    ...(config.tags ? { tags: config.tags } : {}),
    ...(config.externalDocs ? { externalDocs: config.externalDocs } : {}),
    ...config.extensions,
  };
}
