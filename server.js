import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import  db  from './models/index.js';
import authRoutes from "./routes/auth.js"
dotenv.config()

const app = express()
const port = process.env.PORT || 3030
const version = process.env.API_VERSION || 1
const url = `/api/${version}`

app.use(express.json())

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


app.use(`${url}/auth`, authRoutes)

app.get(`/`, (req, res) => {
  res.send('Hello World!')
})


db.sequelize.sync({ alter: true }).then(() => {
    app.listen(port, () => {
        console.log(`Kaluuba api: listening on http://localhost:${port}`)
    })
})