import express from "express"
import { checkBalance, convert, estimateCost, getBalances, getNetworkInfo, getTransactionAnalytics, getTransactionStatus, getUserTransactionHistory, payinvoice, validateRecipient } from "../controllers/TransactionController.js";
import rateLimit from 'express-rate-limit';
import { sendToken } from "../controllers/TransactionController.js"
import { checkBalanceValidation, estimateCostValidation, payInvoiceValidation, sendTokensValidation, transactionHistoryValidation, transactionIdValidation, validateRecipientValidation } from "../middleware/TransactionMiddleware.js";
const router = express.Router();

// Rate limiting for sensitive operations
const transactionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 transaction requests per windowMs
  message: {
    success: false,
    message: 'Too many transaction requests, please try again later.'
  }
});

const balanceCheckRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 balance checks per minute
  message: {
    success: false,
    message: 'Too many balance check requests, please slow down.'
  }
});

router.get("/convert", convert)
router.post('/send', transactionRateLimit, sendTokensValidation, sendToken);
router.post('/pay-invoice', transactionRateLimit, payInvoiceValidation, payinvoice);
router.get('/balances', balanceCheckRateLimit, getBalances);
router.post('/estimate', estimateCostValidation, estimateCost);
router.get('/:transactionId/status', transactionIdValidation, getTransactionStatus);
router.get('/history', transactionHistoryValidation, getUserTransactionHistory);
router.post('/check-balance', balanceCheckRateLimit, checkBalanceValidation, checkBalance);
router.get('/network-info', getNetworkInfo);
router.post('/validate-recipient', validateRecipientValidation, validateRecipient);
router.get('/analytics', getTransactionAnalytics);

export default router;