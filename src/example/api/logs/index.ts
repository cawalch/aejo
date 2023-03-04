import { Router } from "express";
import { Route, Path, AppRoute } from '../../../lib'

import listRoute from './list'

export default (router: Router): AppRoute =>
    Route(router,
        Path(
            '/',
            listRoute
        ),
        Path(
          '/',
          listRoute
        )
    )
