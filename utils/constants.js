import dotenv from "dotenv"
dotenv.config()

export const BASE_URL = process.env.BASE_URL ? `${process.env.BASE_URL}/${process.env.API_VERSION}` : 'http://localhost:3030/api/v1';
