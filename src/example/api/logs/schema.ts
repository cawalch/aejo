import { ParamSchema } from "../../../types/open-api-3";

export const Schema: { [p in string]: ParamSchema } = {
    type: {
        type: 'string',
        description: 'log level',
        example: 'info',
        enum: ['info', 'error', 'warning']
    },
    message: {
        type: 'string',
        description: 'log message',
    }
}

