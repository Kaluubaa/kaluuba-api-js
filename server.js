import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import  db  from './models/index.js';
import authRoutes from "./routes/auth.js"
import transactionRoutes from "./routes/transactions.js"
import userRoutes from "./routes/users.js"
import clientRoutes from "./routes/clients.js"
import authenticateToken from "./middleware/AuthMiddleware.js";
dotenv.config()

const app = express()
app.use(express.json())

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const port = process.env.PORT || 3030
const version = process.env.API_VERSION || 1
const url = `/api/${version}`


app.use(`${url}/auth`, authRoutes)
app.use(`${url}/transactions`, authenticateToken, transactionRoutes)
app.use(`${url}/user`, authenticateToken, userRoutes)
app.use(`${url}/clients`, authenticateToken, clientRoutes)

app.get(`/`, (req, res) => {
  res.send('Hello World!')
})


db.sequelize.sync({ alter: true }).then(() => {
    app.listen(port, () => {
        console.log(`Kaluuba api: listening on http://localhost:${port}`)
    })
})