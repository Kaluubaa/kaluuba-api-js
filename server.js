import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import db from './models/index.js';
import authRoutes from "./routes/auth.js"
import transactionRoutes from "./routes/transactions.js"
import userRoutes from "./routes/users.js"
import clientRoutes from "./routes/clients.js"
import invoiceRoutes from "./routes/invoices.js"
import authenticateToken from "./middleware/AuthMiddleware.js";
import job from "./config/cron.js";
import EmailService from "./services/EmailService.js";

dotenv.config()

const app = express()
app.use(express.json())

app.use(cors({
  // origin: process.env.NODE_ENV === 'production' 
  //   ? [process.env.FRONTEND_URL, 'https://your-app.onrender.com'] 
  //   : '*',
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const port = process.env.PORT || 3030
const version = process.env.API_VERSION || 1
const url = `/api/${version}`

const initializeDatabase = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    if (process.env.NODE_ENV === 'development') {
      await db.sequelize.sync({ alter: true });
      console.log('✅ Database synced successfully.');
    } else {
      await db.sequelize.sync();
      console.log('✅ Production database connected.');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

const initializeCronJob = () => {
  if (process.env.NODE_ENV === 'production') {
    try {
      job.start();
      console.log('✅ Cron job started successfully.');
    } catch (error) {
      console.error('❌ Cron job failed to start:', error);
    }
  }
};

// Routes
app.use(`${url}/auth`, authRoutes)
app.use(`${url}/transactions`, authenticateToken, transactionRoutes)
app.use(`${url}/user`, authenticateToken, userRoutes)
app.use(`${url}/clients`, authenticateToken, clientRoutes)
app.use(`${url}/invoices`, authenticateToken, invoiceRoutes)

app.get(`/`, (req, res) => {
  res.send('Hello World!')
})

app.get(`${url}/health`, (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
})

// Fix 3: Proper server initialization
const startServer = async () => {
  try {
    await initializeDatabase();
    initializeCronJob();
    
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    app.listen(port, host, () => {
      console.log(`Kaluuba API running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`Listening on http://${host}:${port}`);
      console.log(`Health check: http://${host}:${port}${url}/health`);
    });

    // if (process.env.NODE_ENV === 'production') {
    //   EmailService.testConnection().then(success => {
    //     if (success) {
    //       console.log('✅ Production email service ready');
    //     } else {
    //       console.log('❌ Production email service failed to initialize');
    //     }
    //   });
    // }

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();