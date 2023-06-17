import express, {
  Express,
  Request,
  Response,
  RequestHandler,
  NextFunction,
  Router,
} from 'express'
import * as OpenAPI3 from '../types/open-api-3'
import Ajv, { SchemaObject, ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { ValidationError } from './errors'

export const ajv = new Ajv()
addFormats(ajv)

/**
 * AppRoute
 *
 * Binds Express Router with defined application routes
 *
 * ```typescript
 * import { Router } from 'express'
 *
 * import { Route, Path, AppRoute } from 'aejo'
 * import listRoute from './routes/list'
 *
 * export default (router: Router): AppRoute =>
 *      Route(router,
 *        Path(
 *          '/',
 *          listRoute
 *        )
 *      )
 * ```
 */
export type AppRoute = { paths: OpenAPI3.PathItem[]; router: Router }

export const App = (a: OpenAPI3.AppObject): OpenAPI3.AppObject => a

/**
 * Controller
 *
 * Creates a new controller with a path prefix
 *
 * ```typescript
 * import { Controller } from 'aejo'
 *
 * import logsController from './logs'
 *
 * // map controller and path prefix
 * Controller({
 *   prefix: '/api/logs',
 *   route: logsController
 * })
 * ```
 */
export const Controller =
  (ctrl: { prefix: string; route: typeof Route }) =>
  (app: Express): OpenAPI3.PathItem[] => {
    const paths = ctrl.route(express.Router())
    app.use(ctrl.prefix, paths.router)
    paths.paths.forEach((p) => {
      Object.keys(p).forEach((k) => {
        /*
         * replace express.js path parameters with OpenAPI3 formatted strings
         * :id -> {id}
         * :id(<pattern>) - {id}
         **/
        const pathKey = `${ctrl.prefix}${k}`
          .replace(/\(.*?\)/g, '')
          .replace(/:(\w+)/g, '{$1}')
        p[pathKey] = p[k]
        delete p[k]
      })
    })
    return paths.paths
  }

/**
 * Paths
 *
 * Define path endpoints with Express
 * app context
 *
 * ```typescript
 * Paths(
 *  // express app
 *  app,
 *  Controller({
 *    prefix: '/api/logs',
 *    route: logsController
 *  })
 * )
 * ```
 */
export const Paths = (
  app: Express,
  ...ctrls: ReturnType<typeof Controller>[]
): OpenAPI3.PathItem => {
  const paths = ctrls.reduce(
    (acc, c) => {
      const paths = c(app)
      paths.forEach((p) => {
        const [path] = Object.keys(p)
        const [method] = Object.keys(p[path])
        const full = `${method} ${path}`
        if (acc.track.has(full)) {
          console.warn(`possible duplicate API definition '${full}'`)
        } else {
          acc.track.add(full)
        }
        Object.assign(acc.out, p)
      })
      return acc
    },
    { out: {}, track: new Set<string>() }
  )
  return paths.out
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>

/**
 * AsyncWrapper
 *
 * Wraps Express RequestHandler's inside an async callback
 */
export const AsyncWrapper =
  (cb: AsyncRequestHandler) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await cb(req, res, next)
    } catch (e) {
      next(e)
    }
  }

/**
 * ScopeWrapper
 *
 * Wraps Express RequestHandler's inside scoped middleware.
 * Used to create middleware that maps to Security scopes.
 */
export const ScopeWrapper =
  (cb: RequestHandler, scopes: OpenAPI3.ScopeHandler[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (scopes.some((v) => v(req, res, next))) {
      next()
      return
    } else {
      cb(req, res, next)
    }
  }

export interface Security<S = string> {
  name: string
  before?: RequestHandler
  handler: RequestHandler
  scopes: OpenAPI3.NamedHandler<S>
  responses: OpenAPI3.MediaSchemaItem
}

/**
 * Scope
 *
 * Create a user security scope
 *
 * ```typescript
 * import { Request, Response } from 'express'
 * import { Security, ScopeHandler } from 'aejo'
 *
 * // user session interface
 * interface UserAuth extends Request {
 *    user?: {
 *      level: number
 *    }
 * }
 *
 * // authorization middleware based on user level
 * const UserLevel = (minLevel: number): ScopeHandler => (
 *    req: UserAuth
 * ): boolean => req.user.level > minLevel
 *
 * const auth: Security = {
 *  name: 'auth',
 *  handler: (_req: Request, res: Response) => {
 *    // unauthorized handler
 *    res.status(400).send('Not Auth')
 *  },
 *  scopes: {
 *    admin: UserLevel(100),
 *    moderator: UserLevel(50)
 *  },
 *  responses: {
 *  '400': {
 *    description: 'Not Auth'
 *   }
 *  }
 * }
 *
 * // build admin authorization middleware
 * const AdminAuth = AuthPathOp(Scope(auth, 'admin'))
 * ```
 */
export const Scope = <T = string>(
  security: Security<T>,
  ...scopes: (keyof OpenAPI3.NamedHandler<T>)[]
): OpenAPI3.ScopeObject => ({
  auth: security.name,
  scopes,
  middleware: [
    ...(security.before ? [security.before] : []),
    ScopeWrapper(
      security.handler,
      scopes.map((s) => security.scopes[s as string])
    ),
  ],
  responses: security.responses,
})

/**
 * AuthPathOp
 *
 * Authorization middleware builder.
 *
 * ```typescript
 * // create admin authorization middleware guard
 * const AdminAuth = AuthPathOp(Scope(auth, 'admin'))
 *
 * // secure route with admin authorization
 * AdminAuth(
 *  Get({
 *    middleware: [
 *      // express HTTP handler
 *    ]
 *  })
 * )
 * ```
 */
export const AuthPathOp =
  (scope: OpenAPI3.ScopeObject) =>
  (pop: OpenAPI3.PathObject): OpenAPI3.PathObject => {
    const [m] = Object.keys(pop)
    const ret: OpenAPI3.PathOperation = pop[m]

    ret.security = [{ [scope.auth]: scope.scopes }]
    ret.scope = [scope]
    ret.responses = { ...ret.responses, ...scope.responses }
    return { [m]: ret }
  }

/**
 * Route
 *
 * Map an Express route to one or more Paths
 *
 * ```typescript
 * // returns router and PathItems for swagger docs
 * const { router, pathItems } = Route(
 *  express.Router(),
 *  Path(
 *    '/users',
 *    Get({
 *       middleware: [
 *        // express HTTP handler
 *       ]
 *    })
 *    )
 *  )
 * ```
 */
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
      )
    })
    return urtr
  }, rtr),
})

const mapRouter = (
  urtr: Router,
  {
    pathOp,
    path,
    method,
  }: { pathOp: OpenAPI3.PathOperation; path: string; method: string }
) => {
  let wrapper: (cb: RequestHandler) => RequestHandler = (cb) => cb
  if (pathOp.wrapper) {
    wrapper = pathOp.wrapper
  }

  const middle: RequestHandler[] = []

  // security handler
  if (pathOp.scope) {
    for (const s of pathOp.scope) {
      for (const m of s.middleware) {
        middle.push(wrapper(m))
      }
    }
  }

  const content = pathOp.requestBody?.content['application/json']
  if (content) {
    const handler = validateHandler(ajv.compile(content.schema), 'body')
    middle.push(wrapper(handler))
  }

  if (pathOp.parameters) {
    const { handlers } = validate(pathOp.parameters)
    for (const h of handlers) {
      middle.push(wrapper(h))
    }
  }

  for (const m of pathOp.middleware) {
    middle.push(wrapper(m))
  }

  urtr[method](path, middle)
}

/**
 * Path
 *
 * Create a single Path operation
 *
 * The path may have multiple Path items
 *
 * ```typescript
 * // Defines GET and POST routes
 * Path(
 *   '/users',
 *   Get(listUsers),
 *   Post(createUser)
 *  )
 * ```
 */
export const Path = (
  path: string,
  ...po: OpenAPI3.PathObject[]
): OpenAPI3.PathItem => ({
  [path]: po.reduce((acc, p) => ({ ...acc, ...p }), {}),
})

/**
 * Method
 *
 * Define a PathOperation based on an HTTP method
 *
 * ```typescript
 * // Create `GET` method
 * const Get = Method('get')
 * ```
 */
export const Method =
  (m: string) =>
  (pop: OpenAPI3.PathOperation): OpenAPI3.PathObject => ({
    [m]: pop,
  })

/**
 * AsyncMethod
 *
 * Wrapper for calling AsyncMethods
 */
export const AsyncMethod =
  (m: string, wrapper: (cb: AsyncRequestHandler) => AsyncRequestHandler) =>
  (pop: OpenAPI3.PathOperation): OpenAPI3.PathObject => ({
    [m]: { wrapper, ...pop },
  })

export const Get = Method('get')
export const Post = Method('post')
export const Put = Method('put')

export const AsyncGet = AsyncMethod('get', AsyncWrapper)
export const AsyncPost = AsyncMethod('post', AsyncWrapper)
export const AsyncPut = AsyncMethod('put', AsyncWrapper)
export const AsyncDelete = AsyncMethod('delete', AsyncWrapper)

/**
 * Param
 *
 * OpenAPI3 param type builder
 *
 * See {@link QueryParam} and {@link PathParam}
 */
export const Param =
  (pin: OpenAPI3.ParamIn) =>
  (param: Omit<OpenAPI3.Parameter, 'in'>): OpenAPI3.Parameter => ({
    in: pin,
    ...param,
  })

/**
 * QueryParam
 *
 * OpenAPI3 QueryParam Schema builder
 *
 * ```typescript
 * Get({
 *   parameters: [
 *     // accept `/path?limit=<number>`
 *     QueryParam({
 *        name: 'limit',
 *        description: 'max number',
 *        schema: {
 *          type: 'integer',
 *          minimum: 1,
 *        },
 *     })
 *   ]
 * })
 * ```
 */
export const QueryParam = Param('query')

/**
 * PathParam
 *
 * OpenAPI3 PathParam Schema builder
 *
 * ```typescript
 * Put({
 *  parameters: [
 *    // accept `/path/:id` where `:id` is in uuidv4 format
 *    PathParam({
 *      name: 'id',
 *      description: 'user id',
 *      schema: {
 *        type: 'string',
 *        format: 'uuidv4'
 *      }
 *    })
 *  ]
 * })
 * ```
 */
export const PathParam = Param('path')

export const Integer = (
  sch: Partial<OpenAPI3.ParamSchema>
): OpenAPI3.ParamSchema => ({
  type: 'integer',
  ...sch,
})

export const validateParams = (
  p: Partial<OpenAPI3.Parameter>[]
): SchemaObject =>
  p.reduce<SchemaObject>(
    (acc, s) => {
      acc.properties[s.name] = { ...s.schema }
      // base-level requirements
      if (s.required === true) {
        acc.required.push(s.name)
      }
      return acc
    },
    { type: 'object', properties: {}, required: [] } as OpenAPI3.ParamSchema
  )

const inMap = { path: 'params', query: 'query' }

export const groupByParamIn = (params: OpenAPI3.Parameter[]) =>
  params.reduce((group, p) => {
    const m = inMap[p.in]
    if (!group[m]) {
      group[m] = []
    }
    group[m].push(p)
    return group
  }, {} as { [key in OpenAPI3.ParamIn]: OpenAPI3.Parameter[] })

type ValidateByParam = { [key in OpenAPI3.ParamIn]: ValidateFunction<unknown> }

export const validateBuilder =
  (v: Ajv) =>
  (
    s: OpenAPI3.Parameter[]
  ): {
    handlers: ((req: Request, res: Response, next: NextFunction) => void)[]
    schema: { [p: string]: SchemaObject }
  } => {
    const pIns = groupByParamIn(s)
    const ret: { [p: string]: SchemaObject } = {}
    const handlers: ((
      req: Request,
      res: Response,
      next: NextFunction
    ) => void)[] = []

    const validators: ValidateByParam = {
      path: undefined,
      query: undefined,
      body: undefined,
    }

    for (const k of Object.keys(pIns)) {
      const schema = validateParams(pIns[k])
      const validator = v.compile(schema)
      validators[k] = validator
      ret[k] = schema
      handlers.push(validateHandler(validator, k as OpenAPI3.ParamIn))
    }

    return { handlers, schema: ret }
  }

const validateHandler =
  (valid: ValidateFunction, whereIn: OpenAPI3.ParamIn) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!valid(req[whereIn])) {
      throw new ValidationError('AejoValidationError', valid.errors)
    }
    next()
  }

export const validate = validateBuilder(ajv)

type AONumberType = 'integer' | 'int32' | 'int8' | 'number'

type AOTDataDef<S, D extends Record<string, unknown>> = S extends {
  type: AONumberType
}
  ? number
  : S extends { type: 'boolean' }
  ? boolean
  : S extends { type: 'timestamp' }
  ? string | Date
  : S extends { type: 'array'; items: { type: string } }
  ? AOTDataDef<S['items'], D>[]
  : S extends { type: 'string'; enum: readonly (infer E)[] }
  ? string extends E
    ? never
    : [E] extends [string]
    ? E
    : never
  : S extends { elements: infer E }
  ? AOTDataDef<E, D>[]
  : S extends { type: 'string' }
  ? string
  : S extends {
      properties: Record<string, unknown>
      required?: readonly string[]
      additionalProperties?: boolean
    }
  ? {
      -readonly [K in keyof S['properties']]?: AOTDataDef<S['properties'][K], D>
    } & {
      -readonly [K in S['required'][number]]: AOTDataDef<S['properties'][K], D>
    } & ([S['additionalProperties']] extends [true]
        ? Record<string, unknown>
        : unknown)
  : S extends { name: string; schema: Record<string, unknown> }
  ? {
      -readonly [K in S['name']]: AOTDataDef<S['schema'], D>
    }
  : S extends { description: string; schema: Record<string, unknown> }
  ? AODataType<S['schema']>
  : S extends { type: 'object' }
  ? Record<string, unknown>
  : null

export type AODataType<S> = AOTDataDef<S, Record<string, never>>

export type AOParamDef = Record<
  string,
  Record<string, Omit<OpenAPI3.Parameter, 'in' | 'name'>>
>

export default {
  validate,
  validateParams,
  validateBuilder,
}
