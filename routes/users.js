import express from "express";
import { userDetails } from "../controllers/UserController.js";

const router = express.Router();

router.get('/', userDetails)

export default router;