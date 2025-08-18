import { ApiResponse } from "../utils/apiResponse.js";
import ConversionProvider from "../services/ConversionService.js";
import TransactionService from '../services/TransactionService.js';
import db from '../models/index.js'
import { PaymentStatus, TransactionType } from '../utils/types.ts';
import { getCurrentNetworkConfig, getSupportedTokens } from '../config/networks.js';
import { validationResult, body, param, query } from 'express-validator';
import SmartAccountService from "../services/SmartAccountService.js";
const { User } = db

const CACHE_TTL = 30000; // 30 seconds cache
const cache = new Map();
const conversionService = new ConversionProvider();
const transactionService = new TransactionService();

export const convert = async (req, res) => {
  const { amount, fromCurrency, toCurrency } = req.body;
  const cacheKey = `${amount}-${fromCurrency}-${toCurrency}`;

  if (!amount || isNaN(amount)) {
    return ApiResponse.badRequest(res, 'Valid amount is required');
  }

  if (!fromCurrency || !toCurrency) {
    return ApiResponse.badRequest(res, 'Both fromCurrency and toCurrency are required', {
      supportedCryptos: ['USDT', 'USDC']
    });
  }

  // Check cache
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return ApiResponse.success(res, { ...data, cached: true });
    }
  }

  try {
    const result = await conversionService.convert(amount, fromCurrency, toCurrency);
    
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    console.error('Conversion error:', error.message);
    return ApiResponse.serverError(res, error.message, error.response?.data);
  }
};

export const sendToken =   async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(res, errors.array()[0]?.msg)
      }

      const {
        recipientIdentifier,
        tokenSymbol,
        amount,
        description,
      } = req.body;

      const senderId = req.user.id;
      const user = await User.findByPk(senderId)

      console.log(`Processing token send from user ${user.username} to ${recipientIdentifier}`);
      console.log(`Amount: ${amount} ${tokenSymbol}`);

      const result = await transactionService.createAndExecuteTransaction({
        senderId,
        recipientIdentifier,
        tokenSymbol: tokenSymbol.toUpperCase(),
        amount,
        description,
        transactionType: TransactionType.direct,
        userPassword: user.password
      });

      console.log(`Transaction completed: ${result.transactionId}`);

      return ApiResponse.created(res, {
        ...result,
          explorerUrl: getExplorerUrl(result.transactionHash),
          message: "Transaction Completed Successfully. Keep things KALUUBA-ly😉"
        })

    } catch (error) {
      console.error('Send tokens error:', error);
      return ApiResponse.serverError(res, error.message, error.response?.data);
    }
  }

export const payinvoice = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(errors.array()[0]?.msg)
      }

      const { invoiceId, userPassword } = req.body;
      const payerId = req.user.id;

      console.log(`Processing invoice payment: ${invoiceId} by user ${payerId}`);

      const result = await transactionService.processInvoicePayment({
        payerId,
        invoiceId,
        userPassword
      });

      return ApiResponse.created(res, {
          ...result,
          explorerUrl: getExplorerUrl(result.transactionHash),
          message: 'Payment of invoice was succefuly!, keep things KALUUBA-ly😉'
        })

    } catch (error) {
      console.error('Pay invoice error:', error);
      return ApiResponse.serverError(res, error.messag || 'Invoice payment failed', error.response?.data);
    }
  }

export const getBalances =   async (req, res) => {
    try {
      const userId = req.user.id;

      console.log(`Fetching balances for user ${userId}`);

      const balances = await transactionService.getUserTokenBalances(userId);

      return ApiResponse.success(res, {balances, message: "Balance Retrieved Successfully!"})

    } catch (error) {
      console.error('Get balances error:', error);
      return ApiResponse.serverError(res, error.messag || 'Failed to retrieve balances', error.response?.data);
    }
  }

export const estimateCost =   async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(res, errors.array()[0]?.msg)
      }

      const { tokenSymbol, amount } = req.body;
      const senderId = req.user.id;

      const estimation = await transactionService.estimateTransactionCost({
        senderId,
        tokenSymbol: tokenSymbol.toUpperCase(),
        amount
      });

      return ApiResponse.success(res, {
        estimation,
        message: 'Cost estimated successfully'
      })

    } catch (error) {
      console.error('Estimate cost error:', error);
      return ApiResponse.serverError(res, error.messag || 'Cost estimation failed', error.response?.data);

    }
  }

export const getTransactionStatus =   async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(res, errors.array()[0]?.msg)
      }

      const { transactionId } = req.params;
      const userId = req.user.id;

      const status = await transactionService.getTransactionStatus(transactionId);

      // Check if user has permission to view this transaction
      if (!canUserViewTransaction(userId, status)) {
        return ApiResponse.forbidden(res, 'Access denied')
      }

      return ApiResponse.success(res, {
          ...status,
          explorerUrl: status.blockchainTxHash ? getExplorerUrl(status.blockchainTxHash) : null,
          message: 'Transaction status retrieved successfuly!'
        })

    } catch (error) {
      console.error('Get transaction status error:', error);
      return ApiResponse.serverError(res, error.message || 'Transaction not found', error.response?.data)
    }
  }

export const getUserTransactionHistory = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(res, errors.array()[0]?.msg)
      }

      const userId = req.user.id;
      const {
        page = 1,
        limit = 20,
        status,
        transactionType,
        tokenSymbol,
        startDate,
        endDate
      } = req.query;

      console.log(`Fetching transaction history for user ${userId}`);

      const history = await transactionService.getUserTransactionHistory(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        transactionType,
        tokenSymbol,
        startDate,
        endDate
      });

      const transactionsWithUrls = history.transactions.map(tx => ({
        ...tx,
        explorerUrl: tx.blockchainTxHash ? getExplorerUrl(tx.blockchainTxHash) : null
      }));

      return ApiResponse.success(res, {
          ...history,
          transactions: transactionsWithUrls,
          message: 'Transaction history retrieved'
        })

    } catch (error) {
      console.error('Get transaction history error:', error);
      return ApiResponse.serverError(res, error.message || 'Failed to retrieve transaction history', error.response?.data)
    }
  }

export const checkBalance = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(res, errors.array()[0]?.msg)
      }

      const { tokenSymbol, amount } = req.body;
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      
      if (!user || !user.smartAccountAddress) {
        return ApiResponse.notFound(res, 'User or smart account not found')
      }

      const sufficient = await transactionService.checkSufficientBalance(
        user.smartAccountAddress,
        tokenSymbol.toUpperCase(),
        amount
      );

      // Get current balance for additional info
      const balance = await transactionService.paymentService.checkTokenBalance(
        user.smartAccountAddress,
        tokenSymbol.toUpperCase()
      );

      return ApiResponse.success(res, {
          sufficient,
          requestedAmount: amount,
          availableBalance: balance.formatted,
          tokenSymbol: tokenSymbol.toUpperCase(),
          shortfall: sufficient ? '0' : (parseFloat(amount) - parseFloat(balance.formatted)).toFixed(6)
        })

    } catch (error) {
      console.error('Check balance error:', error);
      return ApiResponse.serverError(res, error.message || 'Balance check failed', error.response?.data)
    }
  }

export const getNetworkInfo = async (req, res) =>{
    try {
      const networkConfig = getCurrentNetworkConfig();
      const supportedTokens = getSupportedTokens(networkConfig.networkName);

      return ApiResponse.success(res, {
          network: transactionService.paymentService.getNetworkInfo(),
          supportedTokens,
          gasless: true,
          features: [
            'Gasless Transactions',
            'Circle Smart Accounts',
            'ERC20 Token Support',
            'Invoice Payments'
          ],
          message: 'Network information retrieved'
        })

    } catch (error) {
      console.error('Get network info error:', error);
      ApiResponse.serverError(res, 'Failed to retrieve network information', error.response?.data)
    }
  }

export const  validateRecipient = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.error(res, errors.array()[0]?.msg)
      }

      const { recipientIdentifier } = req.body;

      try {
        const recipient = await transactionService.resolveRecipient(recipientIdentifier);
        
        return ApiResponse.success(res, {
            valid: true,
            recipientType: recipient.internal ? 'internal_user' : 'external_address',
            recipientInfo: recipient.internal ? {
              username: recipient.username,
              smartAccountAddress: recipient.address
            } : {
              address: recipient.address
            },
            message: 'Recipient validated'
          })

      } catch (error) {
        return ApiResponse.success(res, {
            valid: false,
            error: error.message,
            message: 'Recipient validation completed'
          })
      }

    } catch (error) {
      console.error('Validate recipient error:', error);
      return ApiResponse.serverError(res, 'Recipient validation failed', error.response?.data)
    }
  }

export const getTransactionAnalytics = async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = '30d' } = req.query;

      console.log(`Fetching analytics for user ${userId}, period: ${period}`);

      // Calculate date range based on period
      let startDate;
      const endDate = new Date();
      
      switch (period) {
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }
      console.log("gets in")

      // Get transaction history for the period
      const { transactions } = await transactionService.getUserTransactionHistory(userId, {
        page: 1,
        limit: 1000, // Get all transactions for analytics
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Calculate analytics
      const analytics = calculateTransactionAnalytics(transactions, userId);

      return ApiResponse.success(res, {
          period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          message: 'Transaction analytics retrieved',
          ...analytics
        })

    } catch (error) {
      console.error('Get analytics error:', error);
      return ApiResponse.serverError(res, error.message || 'Failed to retrieve analytics', error.response?.data)
    }
  }
  // HELPERS
function  canUserViewTransaction(userId, transaction) {
    return (
      (transaction.sender && transaction.sender.id === parseInt(userId)) ||
      (transaction.recipient && transaction.recipient.id === parseInt(userId))
    );
  }

function getExplorerUrl(txHash) {
const networkConfig = getCurrentNetworkConfig();
const baseUrl = networkConfig.chain.blockExplorers?.default?.url;

if (!baseUrl) {
    return null;
}

return `${baseUrl}/tx/${txHash}`;
}

function  calculateTransactionAnalytics(transactions, userId) {
    const userIdInt = parseInt(userId);
    
    let totalSent = 0;
    let totalReceived = 0;
    let sentCount = 0;
    let receivedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    
    const tokenBreakdown = {};
    const monthlyData = {};

    transactions.forEach(tx => {
      const month = new Date(tx.createdAt).toISOString().slice(0, 7); // YYYY-MM format
      
      if (!monthlyData[month]) {
        monthlyData[month] = { sent: 0, received: 0, count: 0 };
      }

      // Initialize token breakdown
      if (!tokenBreakdown[tx.tokenSymbol]) {
        tokenBreakdown[tx.tokenSymbol] = { sent: 0, received: 0, count: 0 };
      }

      const isIncoming = tx.type === 'incoming';
      const usdAmount = parseFloat(tx.amountUSD || 0);
      const tokenAmount = parseFloat(tx.amount);

      if (isIncoming) {
        totalReceived += usdAmount;
        receivedCount++;
        monthlyData[month].received += usdAmount;
        tokenBreakdown[tx.tokenSymbol].received += tokenAmount;
      } else {
        totalSent += usdAmount;
        sentCount++;
        monthlyData[month].sent += usdAmount;
        tokenBreakdown[tx.tokenSymbol].sent += tokenAmount;
      }

      monthlyData[month].count++;
      tokenBreakdown[tx.tokenSymbol].count++;

      // Count by status
      if (tx.status === PaymentStatus.failed) {
        failedCount++;
      } else if (tx.status === PaymentStatus.pending || tx.status === PaymentStatus.submitted) {
        pendingCount++;
      }
    });

    return {
      summary: {
        totalTransactions: transactions.length,
        totalSentUSD: totalSent.toFixed(2),
        totalReceivedUSD: totalReceived.toFixed(2),
        netBalanceUSD: (totalReceived - totalSent).toFixed(2),
        sentCount,
        receivedCount,
        failedCount,
        pendingCount,
        successRate: transactions.length > 0 
          ? (((transactions.length - failedCount) / transactions.length) * 100).toFixed(1)
          : '100.0'
      },
      tokenBreakdown: Object.entries(tokenBreakdown).map(([symbol, data]) => ({
        token: symbol,
        ...data,
        sent: data.sent.toFixed(6),
        received: data.received.toFixed(6)
      })),
      monthlyTrends: Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          ...data,
          sent: data.sent.toFixed(2),
          received: data.received.toFixed(2)
        })),
      mostActiveTokens: Object.entries(tokenBreakdown)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5)
        .map(([symbol, data]) => ({ token: symbol, transactions: data.count }))
    };
  }
