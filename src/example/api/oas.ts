import { PathItem } from "../../types/open-api-3";

export default (paths: PathItem) => ({
    openapi: '3.0.0',
    info: {
        version: '0.0.1',
        title: 'Example AEJO app',
        description: 'An example AEJO app'
    },
    paths,
})