import { Request, Response, NextFunction } from 'express'
import { AODataType, AOParamDef, Get, QueryParam } from '../../../lib'
import { buildParams } from '../common'
// common model schema
import { Schema } from './schema'

// example data access method
const getLogs = (limit: number, filter: string) => {
  const logs = []
  for (let i = 0; i < limit; i += 1) {
    logs.push({ type: 'info', message: `log message ${i}` })
  }
  return logs.filter((log) => log.split(' ').includes(filter))
}

// Express and AEJO Parameter defintion example
const ListRequestParams = {
  properties: {
    // https://swagger.io/docs/specification/describing-parameters/#query-parameters
    /** number of logs per request */
    limit: {
      description: 'number of logs per request',
      schema: {
        type: 'number',
        format: 'uuid',
        default: 10,
        minimum: 0,
        maximum: 100,
      },
    },
    /** filter on value */
    filter: {
      description: 'filter on value',
      schema: {
        type: 'string',
      },
    },
  },
} satisfies AOParamDef

export default Get({
  tags: ['logs'],
  description: 'list log records',
  // build as Query Parameters
  parameters: buildParams(QueryParam)(ListRequestParams),
  middleware: [
    // Array of middleware calls
    (
      req: Request<
        unknown,
        unknown,
        unknown,
        // use express.js generics to set param definition
        AODataType<typeof ListRequestParams>
      >,
      res: Response,
      next: NextFunction
    ) => {
      // query properties are typed from the AOParamDef (json schema)
      // no need to check types
      const { limit, filter } = req.query
      const records = getLogs(limit || 10, filter)
      res.status(200).send({ logs: records })
      next()
    },
  ],
  responses: {
    200: {
      description: 'log records',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              logs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: Schema,
                },
              },
            },
          },
        },
      },
    },
  },
})
