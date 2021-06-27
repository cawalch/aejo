import { Express } from 'express'
import swaggerUI from 'swagger-ui-express'
import { Paths, Controller, ajv } from "../..";
import logsController from './logs'
import oas from './oas'

// app-level ajv config options
ajv.addKeyword('example')
ajv.opts.coerceTypes = true

export default (app: Express) => {
    const oasPaths = Paths(
        app,
        Controller({
            prefix: '/api/logs',
            route: logsController,
        })
    )
    // wrap swagger doc
    const swaggerDoc = oas(oasPaths)
    // setup swagger doc endpoint
    app.use('/api-docs', swaggerUI.serve)
    app.use('/api-docs', swaggerUI.setup(swaggerDoc))
}