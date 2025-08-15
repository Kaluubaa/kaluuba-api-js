import express from "express"
import dotenv from "dotenv"
import  db  from './models/index.js';

dotenv.config()

const app = express()
const port = process.env.PORT || 3030

app.get('/', (req, res) => {
  res.send('Hello World!')
})

db.sequelize.sync({ alter: true }).then(() => {
    app.listen(port, () => {
        console.log(`Kaluuba api: listening on http://localhost:${port}`)
    })
})