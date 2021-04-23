import express, {
  Express,
  Request,
  Response,
  RequestHandler,
  NextFunction,
  Router,
} from "express";
import * as OpenAPI3 from "../types/open-api-3";
// import { JsonObject } from "swagger-ui-express";
import Ajv, { SchemaObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { ValidationError } from "./errors";

export const ajv = new Ajv();
addFormats(ajv);

export type AppRoute = { paths: OpenAPI3.PathItem[]; router: Router };

export const App = (a: OpenAPI3.AppObject): OpenAPI3.AppObject => a;

export const Controller = (ctrl: { prefix: string; route: typeof Route }) => (
  app: Express
): OpenAPI3.PathItem[] => {
  const paths = ctrl.route(express.Router());
  app.use(ctrl.prefix, paths.router);
  paths.paths.forEach(p => {
    Object.keys(p).forEach(k => {
      p[`${ctrl.prefix}${k}`] = p[k]
      delete p[k]
    })
  })
  return paths.paths;
};

export const Paths = (
  app: Express,
  ...ctrls: ReturnType<typeof Controller>[]
): OpenAPI3.PathItem =>
  ctrls.reduce((acc, c) => {
    const paths = c(app);
    paths.forEach((p) => (acc = { ...acc, ...p }));
    return acc;
  }, {});

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export const AsyncWrapper = (cb: AsyncRequestHandler) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await cb(req, res, next);
  } catch (e) {
    next(e);
  }
};

export const ScopeWrapper = (
  cb: RequestHandler,
  scopes: OpenAPI3.ScopeHandler[]
) => (req: Request, res: Response, next: NextFunction): void => {
  if (scopes.some((v) => v(req, res, next))) {
    next();
    return;
  } else {
    cb(req, res, next);
  }
};

export interface Security<S = string> {
  name: string;
  handler: RequestHandler;
  scopes: OpenAPI3.NamedHandler<S>;
  responses: OpenAPI3.MediaSchemaItem;
}

export const Scope = <T = string>(
  security: Security<T>,
  ...scopes: (keyof OpenAPI3.NamedHandler<T>)[]
): OpenAPI3.ScopeObject => ({
  auth: security.name,
  scopes,
  middleware: [
    ScopeWrapper(
      security.handler,
      scopes.map((s) => security.scopes[s as string])
    ),
  ],
  responses: security.responses,
});

export const AuthPathOp = (scope: OpenAPI3.ScopeObject) => (
  pop: OpenAPI3.PathObject
): OpenAPI3.PathObject => {
  const [m] = Object.keys(pop);
  const ret: OpenAPI3.PathOperation = pop[m];
  ret.security = {
    [scope.auth]: scope.scopes,
  };
  ret.scope = [scope];
  ret.responses = { ...ret.responses, ...scope.responses };
  return { [m]: ret };
};

export const Route = (
  rtr: Router,
  ...pitems: OpenAPI3.PathItem[]
): AppRoute => ({
  paths: pitems,
  router: pitems.reduce((urtr, pitem) => {
    Object.keys(pitem).forEach((path: string) => {
      Object.keys(pitem[path]).forEach((method: keyof OpenAPI3.PathObject) =>
        mapRouter(urtr, {
          pathOp: pitem[path][method],
          path,
          method,
        })
      );
    });
    return urtr;
  }, rtr),
});

const mapRouter = (
  urtr: Router,
  p: { pathOp: OpenAPI3.PathOperation; path: string; method: string }
) => {
  const middle = [];
  let wrapper = (cb: RequestHandler) => cb;
  if (p.pathOp.wrapper) {
    wrapper = p.pathOp.wrapper;
  }

  // security handler
  if (p.pathOp.scope) {
    p.pathOp.scope.forEach((s: OpenAPI3.ScopeObject) => {
      middle.push(...s.middleware.map(wrapper));
    });
  }

  if (p.pathOp.parameters) {
    const { handler } = validate(p.pathOp.parameters)
    middle.push(wrapper(handler));
  }

  middle.push(p.pathOp.middleware.map(wrapper));
  urtr[p.method](p.path, middle);
};

export const Path = (
  path: string,
  ...po: OpenAPI3.PathObject[]
): OpenAPI3.PathItem => ({
  [path]: po.reduce((acc, p) => ({ ...acc, ...p }), {}),
});

export const Method = (m: string) => (
  pop: OpenAPI3.PathOperation
): OpenAPI3.PathObject => ({
  [m]: pop,
});

export const AsyncMethod = (
  m: string,
  wrapper: (cb: AsyncRequestHandler) => AsyncRequestHandler
) => (pop: OpenAPI3.PathOperation): OpenAPI3.PathObject => ({
  [m]: { wrapper, ...pop },
});

export const Get = Method("get");
export const Post = Method("post");
export const Put = Method("put");

export const AsyncGet = AsyncMethod("get", AsyncWrapper);
export const AsyncPost = AsyncMethod("post", AsyncWrapper);
export const AsyncPut = AsyncMethod("put", AsyncWrapper);
export const AsyncDelete = AsyncMethod("delete", AsyncWrapper);

export const Param = (pin: OpenAPI3.ParamIn) => (
  param: Omit<OpenAPI3.Parameter, "in">
): OpenAPI3.Parameter => ({
  in: pin,
  ...param,
});

export const Query = Param("query");
export const Body = Param("body");

export const Integer = (
  sch: Partial<OpenAPI3.ParamSchema>
): OpenAPI3.ParamSchema => ({
  type: "integer" as OpenAPI3.ParamType,
  ...sch,
});

export const validateParams = (
  p: Partial<OpenAPI3.Parameter>[]
): SchemaObject =>
  p.reduce<SchemaObject>(
    (acc, s) => {
      acc.properties[s.name] = { ...s.schema };
      // base-level requirements
      if (s.required === true) {
        acc.required.push(s.name)
      }
      return acc;
    },
    { type: "object", properties: {}, required: [] } as OpenAPI3.ParamSchema
  );

export const groupByParamIn = (params: OpenAPI3.Parameter[]) =>
  params.reduce((group, p) => {
    if (!group[p.in]) {
      group[p.in] = [];
    }
    group[p.in].push(p);
    return group;
  }, {} as { [key in OpenAPI3.ParamIn]: OpenAPI3.Parameter[] });

type ValidateByParam = { [key in OpenAPI3.ParamIn]: ValidateFunction<unknown> };

export const validateBuilder = (v: Ajv) => (
  s: OpenAPI3.Parameter[]
): {
  handler: ((req: Request, res: Response, next: NextFunction) => void),
  schema: { [p: string]: SchemaObject },
} => {
  const pIns = groupByParamIn(s);
  const ret: { [p: string]: SchemaObject } = {}
  const pKeys = Object.keys(pIns);
  const validators: ValidateByParam = pKeys.reduce(
    (acc, k: OpenAPI3.ParamIn) => {
      const schema = validateParams(pIns[k])
      acc[k] = v.compile(schema);
      ret[k] = schema
      return acc;
    },
    {} as ValidateByParam
  );
  return {
    handler: (req: Request, _res: Response, next: NextFunction) => {
    pKeys.forEach((k) => {
      if (!validators[k](req[k])) {
        throw new ValidationError("AejoValidationError", validators[k].errors);
      }
    });
    next();
  },
  schema: ret,
  }
};

export const validate = validateBuilder(ajv);

/*
export const docPath = (doc: JsonObject) => (
  paths: OpenAPI3.PathObject
): void => {
  Object.keys(paths).forEach((p) => (doc[p] = paths[p]));
};
*/

export default {
  validate,
  validateParams,
  validateBuilder,
  // docPath,
};
