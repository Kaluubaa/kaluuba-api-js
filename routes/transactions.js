import express from "express"
import { convert } from "../controllers/TransactionController.js";

const router = express.Router();

router.get("/convert", convert)

export default router;