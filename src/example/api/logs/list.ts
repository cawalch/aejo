import { Request, Response, NextFunction } from 'express'
import { Get, QueryParam } from '../../../lib'
// common model schema
import { Schema } from './schema'

// example data access method
const getLogs = (limit: number) => {
    const logs = []
    for (let i = 0; i < limit; i += 1) {
        logs.push({ type: 'info', message: `log message ${i}` })
    }
    return logs
}

// for generic Express Query
interface ListRequest {
    limit?: string
}

export default Get({
    tags: ['logs'],
    description: 'list log records',
    parameters: [
        // QueryParam implies in: "query" from OAS standard
        // https://swagger.io/docs/specification/describing-parameters/#query-parameters
        QueryParam({
            name: 'limit',
            description: 'number of logs per request',
            schema: {
                type: 'integer',
                example: 20,
                default: 10,
                minimum: 0,
                maximum: 100,
            },
        })
    ],
    middleware: [
        // Array of middleware calls
        (
            req: Request<unknown, unknown, unknown, ListRequest>,
            res: Response,
            next: NextFunction
        ) => {
            const limit = parseInt(req.query.limit, 10)
            const records = getLogs(limit || 10)
            res.status(200).send({ logs: records })
            next()
        }
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
                                }
                            }
                        }
                    }
                }
            }
        }
    }
})
