/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import express, {
  Express,
  NextFunction,
  Request,
  Response,
  Router,
} from "express";
import {
  Query,
  Get,
  Post,
  Path,
  Paths,
  Route,
  Controller,
  AppRoute,
  AsyncGet,
  Scope,
  AuthPathOp,
  Security,
} from "../lib/";
import { ScopeHandler } from '../types/open-api-3'
import request from "supertest";

interface UserAuth extends Request {
  user?: {
    level: number
  }
}

const UserLevel = (minLevel: number): ScopeHandler => (
  req: UserAuth
): boolean => (req.user.level > minLevel)

const routeHandler = (_req: Request, _res: Response, _next: NextFunction) => {};

const UserRequest = (app: Express, level: number) => {
  app.use((req: UserAuth, _res: Response, next: NextFunction) => {
    req.user = { level };
    next();
  });
};

test("Query", () => {
  expect(
    Query({
      name: "limit",
      description: "max number",
      schema: {
        type: "integer",
        minimum: 1,
      },
    })
  ).toEqual({
    name: "limit",
    in: "query",
    description: "max number",
    schema: {
      type: "integer",
      minimum: 1,
    },
  });
});

test("Get", () => {
  expect(
    Get({
      tags: ["test"],
      description: "test get",
      middleware: [routeHandler],
    })
  ).toHaveProperty("get");
});

test("Get Schema", () => {
  expect(
    Get({
      tags: ["test"],
      description: "test get",
      middleware: [routeHandler],
    })
  ).toMatchObject({
    get: {
      tags: ["test"],
      description: "test get",
    },
  });
});

test("Path", () => {
  const pathTest = Path(
    "/api/v1/widget",
    Get({
      middleware: [routeHandler],
    })
  );
  expect(pathTest).toHaveProperty("/api/v1/widget");
  const pathMultiTest = Path(
    "/api/v1/widget",
    Get({
      middleware: [routeHandler],
    }),
    Post({
      middleware: [routeHandler],
    })
  );
  expect(pathMultiTest["/api/v1/widget"]).toHaveProperty("get");
  expect(pathMultiTest["/api/v1/widget"]).toHaveProperty("post");
});

test("Router", () => {
  const app = express();
  const { router } = Route(
    express.Router(),
    Path(
      "/",
      Get({
        middleware: [
          (_req: Request, res: Response, next: NextFunction) => {
            res.status(200).json({ foo: "bar" });
            next();
          },
        ],
      })
    )
  );

  app.use("/user", router);

  request(app)
    .get("/user")
    .expect("Content-Type", /json/)
    .expect(200)
    .end(function (err, res) {
      if (err) throw err;
      expect(res.body).toEqual({ foo: "bar" });
    });
});

test("Security Schema", () => {
  const auth: Security = {
    name: "auth",
    handler: (_req: Request, res: Response) => {
      res.status(400).send("Not Auth");
    },
    scopes: {
      admin: UserLevel(100),
    },
    responses: {
      "400": {
        description: "Not auth",
      },
    },
  };

  const AdminAuth = AuthPathOp(Scope(auth, "admin"));
  const actual = AdminAuth(
    Get({
      middleware: [routeHandler],
      responses: {
        "200": {
          description: "ok",
        },
      },
    })
  );
  expect(actual.get.security).toMatchObject({
    auth: ["admin"],
  });
  expect(actual.get.responses).toMatchObject({
    "400": {
      description: "Not auth",
    },
    "200": {
      description: "ok",
    },
  });
});

test("Multi Scope", (done) => {
  const auth: Security<"admin" | "transport"> = {
    name: "auth",
    handler: (_req: Request, res: Response) => {
      res.status(400).send("Not Auth");
    },
    scopes: {
      admin: (req: UserAuth) => req.user.level >= 100,
      transport: (req: UserAuth) => req.user.level >= 50,
    },
    responses: {
      "400": {
        description: "Not auth",
      },
    },
  };

  const app = express();
  UserRequest(app, 50);

  const AdminAuth = AuthPathOp(Scope(auth, "admin", "transport"));

  const { router } = Route(
    express.Router(),
    Path(
      "/users",
      AdminAuth(
        AsyncGet({
          middleware: [
            (_req: Request, res: Response, next: NextFunction) => {
              res.status(200).json({ foo: "bar" });
              next();
            },
          ],
        })
      )
    )
  );

  app.use("/admin", router);

  request(app)
    .get("/admin/users")
    .end((_err, res) => {
      expect(res.status).toBe(200);
      done();
    });
});

test("Router Security", (done) => {
  const auth: Security = {
    name: "auth",
    handler: (_req: Request, res: Response) => {
      res.status(400).send("Not Auth");
    },
    scopes: {
      admin: UserLevel(100),
    },
    responses: {
      "400": {
        description: "Not auth",
      },
    },
  };

  const app = express();
  app.use((req: UserAuth, _res: Response, next: NextFunction) => {
    req.user = { level: 0 };
    next();
  });

  const AdminAuth = AuthPathOp(Scope(auth, "admin"));

  const { router } = Route(
    express.Router(),
    Path(
      "/users",
      AdminAuth(
        AsyncGet({
          middleware: [
            (_req: Request, res: Response, next: NextFunction) => {
              res.status(200).json({ foo: "bar" });
              next();
            },
          ],
        })
      )
    )
  );
  app.use("/admin", router);

  request(app)
    .get("/admin/users")
    .end((_err, res) => {
      expect(res.status).toBe(400);
      done();
    });
});

test("Paths", (done) => {
  const app = express();
  Paths(
    app,
    Controller({
      prefix: "/api/foo",
      route: (router: Router): AppRoute =>
        Route(
          router,
          Path(
            "/",
            Get({
              tags: ["feeds"],
              description: "List Feeds",
              middleware: [
                (_req: Request, res: Response, next: NextFunction) => {
                  res.status(200).json({ foo: "bar" });
                  next();
                },
              ],
            })
          )
        ),
    })
  );
  request(app)
    .get("/api/foo/")
    .expect("Content-Type", /json/)
    .expect(200)
    .end(function (err, res) {
      if (err) throw err;
      expect(res.body).toEqual({ foo: "bar" });
      done();
    });
});

test("Validate", (done) => {
  const app = express();
  const { router } = Route(
    express.Router(),
    Path(
      "/",
      AsyncGet({
        parameters: [
          Query({
            name: "limit",
            description: "max number",
            schema: {
              type: "integer",
              minimum: 1,
            },
          }),
        ],
        middleware: [
          (_req: Request, res: Response, next: NextFunction) => {
            res.status(200).json({ foo: "bar" });
            next();
          },
        ],
      })
    )
  );

  app.use("/test", router);
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).send({ err: err.message });
  });

  request(app)
    .get("/test")
    .query({ limit: "foo" })
    .end((_err, res) => {
      expect(res.status).toBe(400);
      done();
    });
});
