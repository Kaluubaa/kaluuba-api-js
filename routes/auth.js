import express from "express"
import { login, register, resendVerification, setPin, updatePin, verifyEmail, verifyPin } from "../controllers/AuthController.js";
import authenticateToken from "../middleware/AuthMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/resend-email-verification", resendVerification)
router.post('/set-pin', authenticateToken, setPin);
router.post('/update-pin', authenticateToken, updatePin);
router.post('/verify-pin', authenticateToken, verifyPin);

export default router;