import type {
  ComponentsObject,
  ExternalDocsObject,
  InfoObject,
  PathItemObject,
  ReferenceObject,
  SecurityRequirementObject,
  SecuritySchemeObject,
  ServerObject,
  TagObject,
} from "../types/types";

export interface OpenAPIConfig {
  info: InfoObject;
  jsonSchemaDialect?: string;
  servers?: ServerObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocsObject;
  security?: SecurityRequirementObject[];
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  components?: ComponentsObject;
  webhooks?: Record<string, PathItemObject>;
  extensions?: Record<`x-${string}`, unknown>;
}

export function defineDocument(config: OpenAPIConfig): OpenAPIConfig {
  return config;
}
