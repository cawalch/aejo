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
};

export interface PathOperation {
  tags?: string[];
  operationId?: string;
  summary?: string;
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
  content?: ContentItem;
}

export interface ContentItem {
  [content: string]: {
    schema: ParamSchema;
  };
}

export type ParamIn = "query" | "param" | "body";

export interface Parameter {
  in: ParamIn;
  name: string;
  description?: string;
  required?: boolean;
  schema: ParamSchema;
}

export type ParamType = "integer" | "string" | "object";

export interface ParamSchema {
  type: ParamType;
  format?: string;
  minimum?: number;
  properties?: {
    [p: string]: ParamSchema;
  };
}
