# AEJO

(AJV + Express.js + JSON Schema + OAS 3.x) API Builder

A library for building fully documented and validated Express API endpoints

- Composable functions based on OpenAPI 3.x schemas (fully typed)
- Generates OAS 3.x schemas
- Express.js Param, Query, Body validations via AJV
- Scoped auth strategies

## Query Params

```typescript
// Validate `limit` against `req.query`
Query({
  name: "limit",
  description: "max number",
  schema: {
    type: "integer",
    minimum: 1,
  },
})
```

## Controller

```typescript
// Define a new controller using the `/api/users` path
Controller({
  prefix: "/api/users",
  // DI express router
  route: (router: Router): AppRoute =>
    Route(
      router,
      // Define a new path under the `/api/users` controller
      Path(
        "/",
        AsyncGet({
          tags: ["users"],
          description: "List Users",
          // Define path parameters
          parameters: [
            Query({
              name: "limit",
              description: "max number",
              schema: {
                type: "integer",
                minimum: 1,
              },
            })
          ],
          // Middleware handlers
          middleware: [
            async (
              req: Request,
              res: Response,
              next: NextFunction
            ) => {
              const users = await UserService(req.query)
              res.status(200).send(users)
            }
          ],
          // Endpoint Responses (testable)
          responses: {
            "200": {
              description: "Success",
              content: UserListResponse
            }
          }
        })
      )
    )
})
```

## TODO

- [ ] Actual documentation
- [ ] Publish npm
- [ ] Better OAS support
- [ ] More Tests
