import dotenv from "dotenv/config";

console.log('🔍 Environment Variables Debug:');
console.log('DB_USER:', process.env.DB_USER, 'Type:', typeof process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'UNDEFINED', 'Type:', typeof process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME, 'Type:', typeof process.env.DB_NAME);
console.log('DB_HOST:', process.env.DB_HOST, 'Type:', typeof process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT, 'Type:', typeof process.env.DB_PORT);
console.log('NODE_ENV:', process.env.NODE_ENV, 'Type:', typeof process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'UNDEFINED');

// Validate required environment variables
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  process.exit(1);
}

export default {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    logging: console.log
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // This is crucial for Render
      }
    },
    ssl: true,
    logging: false, // Disable logging in production for better performance
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
};