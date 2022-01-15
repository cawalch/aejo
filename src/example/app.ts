import express from 'express'
import api from './api'
const app = express()

api(app)

app.listen(3000, () => { console.log('Running at http://localhost:3000') })
