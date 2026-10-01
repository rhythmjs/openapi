export interface Extensible {
  [extension: `x-${string}`]: unknown;
}

export type SchemaObject = Record<string, unknown> | boolean;

export interface ReferenceObject {
  $ref: string;
  summary?: string;
  description?: string;
}

export interface ContactObject extends Extensible {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject extends Extensible {
  name: string;
  identifier?: string;
  url?: string;
}

export interface InfoObject extends Extensible {
  title: string;
  summary?: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

export interface ServerVariableObject extends Extensible {
  enum?: string[];
  default: string;
  description?: string;
}

export interface ServerObject extends Extensible {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ExternalDocsObject extends Extensible {
  description?: string;
  url: string;
}

export interface TagObject extends Extensible {
  name: string;
  description?: string;
  externalDocs?: ExternalDocsObject;
}

export interface ExampleObject extends Extensible {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export type ParameterLocation = "query" | "header" | "path" | "cookie";

export type ParameterStyle = "matrix" | "label" | "simple" | "form" | "spaceDelimited" | "pipeDelimited" | "deepObject";

export interface ParameterObject extends Extensible {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
}

export type HeaderObject = Omit<ParameterObject, "name" | "in">;

export interface EncodingObject extends Extensible {
  contentType?: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface MediaTypeObject extends Extensible {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  encoding?: Record<string, EncodingObject>;
}

export interface RequestBodyObject extends Extensible {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface LinkObject extends Extensible {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: ServerObject;
}

export interface ResponseObject extends Extensible {
  description: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
}

export type ResponsesObject = Record<string, ResponseObject | ReferenceObject>;

export type CallbackObject = Record<string, PathItemObject | ReferenceObject>;

export type SecurityRequirementObject = Record<string, string[]>;

export interface OAuthFlowObject extends Extensible {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OAuthFlowsObject extends Extensible {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

export type SecuritySchemeObject =
  | (Extensible & {
      type: "apiKey";
      description?: string;
      name: string;
      in: "query" | "header" | "cookie";
    })
  | (Extensible & {
      type: "http";
      description?: string;
      scheme: string;
      bearerFormat?: string;
    })
  | (Extensible & {
      type: "mutualTLS";
      description?: string;
    })
  | (Extensible & {
      type: "oauth2";
      description?: string;
      flows: OAuthFlowsObject;
    })
  | (Extensible & {
      type: "openIdConnect";
      description?: string;
      openIdConnectUrl: string;
    });

export interface OperationObject extends Extensible {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocsObject;
  operationId?: string;
  parameters?: (ParameterObject | ReferenceObject)[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses?: ResponsesObject;
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

export interface PathItemObject extends Extensible {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: (ParameterObject | ReferenceObject)[];
}

export type PathsObject = Record<string, PathItemObject>;

export interface ComponentsObject extends Extensible {
  schemas?: Record<string, SchemaObject>;
  responses?: Record<string, ResponseObject | ReferenceObject>;
  parameters?: Record<string, ParameterObject | ReferenceObject>;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
  pathItems?: Record<string, PathItemObject>;
}

export interface OpenAPIObject extends Extensible {
  openapi: string;
  info: InfoObject;
  jsonSchemaDialect?: string;
  servers?: ServerObject[];
  paths?: PathsObject;
  webhooks?: Record<string, PathItemObject>;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocsObject;
}
