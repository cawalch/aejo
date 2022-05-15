import { Request, Response, RequestHandler, NextFunction } from "express";

export type NamedHandler<S> = Record<
  S extends string ? S : string,
  ScopeHandler
>;

export interface AppObject {
  openapi: string;
  info: {
    title: string;
    description: string;
  };
  wrapper?: (cb: RequestHandler) => RequestHandler;
  paths: PathItem;
  components?: Components;
}

interface Components {
  securitySchemes: SecuritySchemesObject;
}

interface SecuritySchemesObject {
  [y: string]: {
    type: string;
    [z: string]: unknown;
  };
}

export interface PathItem {
  [path: string]: PathObject;
}

export interface PathObject {
  get?: PathOperation;
  post?: PathOperation;
  put?: PathOperation;
  delete?: PathOperation;
}

export interface ScopeHandler {
  (req: Request, res?: Response, next?: NextFunction): boolean;
}

export type ScopeObject<S = string> = {
  auth: string;
  scopes: (keyof NamedHandler<S>)[];
  middleware: RequestHandler[];
  responses?: MediaSchemaItem;
};

export type SecurityObject = {
  [auth: string]: string[];
}[];

export interface PathOperation {
  tags?: string[];
  operationId?: string;
  summary?: string;
  requestBody?: MediaSchema;
  description?: string;
  responses?: MediaSchemaItem;
  scope?: ScopeObject[];
  security?: SecurityObject;
  parameters?: Parameter[];
  wrapper?: (cb: RequestHandler) => RequestHandler;
  middleware: RequestHandler[];
}

export interface MediaSchemaItem {
  [code: string]: MediaSchema;
}

export interface MediaSchema {
  description: string;
  required?: true,
  content?: ContentItem;
}

export interface ContentItem {
  [content: string]: {
    schema: ParamSchema;
  };
}

export type ParamIn = "query" | "path" | "body";

export interface Parameter {
  in: ParamIn;
  name: string;
  description?: string;
  required?: boolean;
  schema: ParamSchema;
  deprecated?: boolean
  examples?: {
    [ex: string]: {
      value: unknown
      summary?: string
    }
  }
}

export type ParamType = "integer" | "number" | "string" | "array" | "object" | "boolean";

export interface ParamSchema {
  type?: ParamType
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  example?: unknown;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  maxProperties?: number;
  minProperties?: number;
  nullable?: boolean;
  required?: readonly string[];
  enum?: Readonly<number[] | string[]>;
  properties?: {
    [p: string]: ParamSchema;
  };
  additionalProperties?: boolean;
  items?: ParamSchema;
  pattern?: string;
  uniqueItems?: boolean;
  oneOf?: ParamSchema[];
  anyOf?: ParamSchema[];
}
