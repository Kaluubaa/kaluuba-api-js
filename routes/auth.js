import express from "express"
import { login, register, resendVerification, verifyEmail } from "../controllers/AuthController.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/resend-email-verification", resendVerification)

export default router;