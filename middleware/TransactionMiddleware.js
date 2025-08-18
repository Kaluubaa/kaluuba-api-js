// TransactionMiddleware.js
import { body, param, query } from 'express-validator';
import { PaymentStatus, TokenSymbols, TransactionType } from '../utils/types.ts';

export const sendTokensValidation = [
  body('recipientIdentifier')
    .notEmpty()
    .withMessage('Recipient identifier is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Recipient identifier must be 1-100 characters'),

  body('tokenSymbol')
    .notEmpty()
    .withMessage('Token symbol is required')
    .isIn(Object.values(TokenSymbols))
    .withMessage('Invalid token symbol'),

  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number greater than 0.000001'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

export const payInvoiceValidation = [
  body('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid invoice ID format'),

  body('userPassword')
    .notEmpty()
    .withMessage('User password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty')
];

export const estimateCostValidation = [
  body('tokenSymbol')
    .notEmpty()
    .withMessage('Token symbol is required')
    .isIn(Object.values(TokenSymbols))
    .withMessage('Invalid token symbol'),

  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number greater than 0.000001')
];

export const transactionIdValidation = [
  param('transactionId')
    .matches(/^TXN-[A-Z0-9]+-[A-F0-9]+$/)
    .withMessage('Invalid transaction ID format')
];

export const transactionHistoryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(Object.values(PaymentStatus))
    .withMessage('Invalid status value'),

  query('transactionType')
    .optional()
    .isIn(Object.values(TransactionType))
    .withMessage('Invalid transaction type'),

  query('tokenSymbol')
    .optional()
    .isIn(Object.values(TokenSymbols))
    .withMessage('Invalid token symbol'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO8601 format'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO8601 format')
];

export const checkBalanceValidation = [
  body('tokenSymbol')
    .notEmpty()
    .withMessage('Token symbol is required')
    .isIn(Object.values(TokenSymbols))
    .withMessage('Invalid token symbol'),

  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number greater than 0.000001')
];

export const validateRecipientValidation = [
  body('recipientIdentifier')
    .notEmpty()
    .withMessage('Recipient identifier is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Recipient identifier must be 1-100 characters')
];
