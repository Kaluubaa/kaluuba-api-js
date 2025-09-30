import GaslessPaymentService from './GasslessPaymentService.js';
import db from '../models/index.js';
import { InvoiceStatus, PaymentStatus, TransactionType } from '../utils/types.js';
import { Op } from 'sequelize';
import { ethers } from 'ethers';
import crypto from 'crypto';

const {User, Transaction, Invoice, Client} = db

class TransactionService {
  constructor() {
    this.paymentService = new GaslessPaymentService();
  }

  async createAndExecuteTransaction({
    senderId,
    recipientIdentifier, // username, email, or wallet address
    tokenSymbol,
    amount,
    description = null,
    transactionType = TransactionType.direct,
    invoiceId = null,
    userPassword
  }) {
    let transaction = null;
    
    try {
      const transactionId = this.generateTransactionId();
      
      const sender = await User.findByPk(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      // Resolve recipient
      const recipient = await this.resolveRecipient(recipientIdentifier);
      
      // Get token configuration
      const tokenConfig = this.paymentService.supportedTokens[tokenSymbol.toUpperCase()];
      if (!tokenConfig) {
        throw new Error(`Unsupported token: ${tokenSymbol}`);
      }

      // Convert amount to proper decimals for storage
      const amountInWei = ethers.parseUnits(amount.toString(), tokenConfig.decimals);
      
      // Get USD equivalent (you can integrate with a real price feed)
      const amountUSD = await this.getUSDEquivalent(tokenSymbol, amount);

      // Create transaction record first
      transaction = await Transaction.create({
        transactionId,
        senderId,
        recipientId: recipient.internal ? recipient.userId : null,
        recipientAddress: recipient.address,
        recipientIdentifier,
        tokenAddress: tokenConfig.address,
        tokenSymbol: tokenSymbol.toUpperCase(),
        amount: amountInWei.toString(),
        amountUSD,
        status: PaymentStatus.pending,
        transactionType,
        invoiceId,
        description,
        metadata: {
          tokenDecimals: tokenConfig.decimals,
          originalAmount: amount,
          networkName: this.paymentService.networkConfig.networkName,
          chainId: this.paymentService.chain.id,
          gasless: true
        }
      });

      console.log(`Created transaction ${transactionId} with status pending`);

      // Validate user has sufficient balance
      const balance = await this.paymentService.checkTokenBalance(
        sender.smartAccountAddress,
        tokenSymbol
      );

      if (parseFloat(balance.formatted) < parseFloat(amount)) {
        const msg = `Insufficient ${tokenSymbol} balance. Required: ${amount}, Available: ${balance.formatted}`
        await transaction.update({ status: PaymentStatus.failed, description: msg });
        throw new Error(msg);
      }

      // Execute gasless transaction
      const executionResult = await this.paymentService.executeGaslessTransaction({
        encryptedPrivateKey: sender.privateKey,
        userId: sender.id.toString(),
        userPassword,
        recipientAddress: recipient.address,
        tokenSymbol,
        amount,
        description
      });

      if (!executionResult.success) {
        await transaction.markAsFailed();
        throw new Error(executionResult.error);
      }

      await transaction.markAsSubmitted(executionResult.transactionHash);
      
      await transaction.update({
        blockNumber: executionResult.blockNumber,
        gasUsed: executionResult.gasUsed,
        metadata: {
          ...transaction.metadata,
          userOpHash: executionResult.userOpHash,
          networkTransactionHash: executionResult.transactionHash
        }
      });

      // Mark as confirmed immediately for gasless transactions
      // since they're already confirmed when we get the receipt
      await transaction.markAsConfirmed(
        executionResult.blockNumber,
        executionResult.gasUsed
      );

      console.log(`Transaction ${transactionId} executed successfully`);
      console.log(`Transaction Hash: ${executionResult.transactionHash}`);
      console.log(`User Operation Hash: ${executionResult.userOpHash}`);

      return {
        success: true,
        transactionId,
        transactionHash: executionResult.transactionHash,
        userOpHash: executionResult.userOpHash,
        status: PaymentStatus.confirmed,
        recipient: recipientIdentifier,
        amount,
        tokenSymbol: tokenSymbol.toUpperCase(),
        gasless: true,
        networkName: this.paymentService.networkConfig.networkName
      };

    } catch (error) {
      console.error('Transaction execution failed:', error);
      
      if (transaction) {
        await transaction.markAsFailed();
      }
      
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async processInvoicePayment({
    payerId,
    invoiceId,
    userPassword,
    tokenSymbol
  }) {
    try {
        const invoice = await Invoice.findOne({
        where: { 
            id: invoiceId
        },
        include: [
            {
            model: Client,
            as: 'client',
            include: [
                { model: User, as: 'registeredUser' }
            ]
            },
            {
                model: User,
                as: 'recipient'
            }
        ]
        });
        
        if (!invoice) {
        throw new Error('Invoice not found or access denied');
        }
        
        if (invoice.status === InvoiceStatus.paid) {
        throw new Error('Invoice already paid in full');
        }

        if (invoice.status === InvoiceStatus.cancelled) {
        throw new Error('Invoice has been cancelled');
        }
        
        if (invoice.isExpired()) {
        throw new Error('Invoice has expired');
        }
    
        const paymentAmount = parseFloat(invoice.totalAmount);
    
        if (paymentAmount > parseFloat(invoice.totalAmount)) {
        throw new Error('Payment amount exceeds remaining balance');
        }

        if (new Date() > invoice.expiresAt) {
            throw new Error('Invoice expired');
        }

       if(!invoice.recipient) {
        throw new Error('Cant load recipient details')
       }

      const result = await this.createAndExecuteTransaction({
        senderId: payerId,
        recipientIdentifier: invoice.recipient.username,
        tokenSymbol: tokenSymbol,
        amount: paymentAmount,
        description: `Payment for invoice ${invoiceId}`,
        transactionType: TransactionType.invoice,
        invoiceId,
        userPassword
      });

        const newPaidAmount = parseFloat(invoice.paidAmount) + paymentAmount;
        const newRemainingAmount = parseFloat(invoice.totalAmount) - newPaidAmount;
      
            let newStatus = invoice.status;
            if (newRemainingAmount <= 0) {
              newStatus = InvoiceStatus.paid;
            } else if (newPaidAmount > 0) {
              newStatus = InvoiceStatus.partial;
            }
      
            await invoice.update({
              paidAmount: newPaidAmount,
              remainingAmount: newRemainingAmount,
              status: newStatus,
              paidAt: newStatus === InvoiceStatus.paid ? new Date() : null
            });

            return result;
    } catch (error) {
      throw new Error(`Invoice payment failed: ${error.message}`);
    }
  }

  async getUserTokenBalances(userId) {
    try {
      const user = await User.findByPk(userId);

      console.log(user, userId);
      if (!user || !user.smartAccountAddress) {
        throw new Error('User or smart account not found');
      }

      const balances = await this.paymentService.getAllTokenBalances(user.smartAccountAddress);
      
      const totalUSD = balances.reduce((sum, balance) => {
        const usdValue = parseFloat(balance.formatted) * (balance.symbol === 'USDC' ? 1 : 1); // Mock USD rate
        return sum + usdValue;
      }, 0);

      return {
        totalUSD: totalUSD.toFixed(2),
        balances: balances.map(balance => ({
          ...balance,
          usdValue: (parseFloat(balance.formatted) * (balance.symbol === 'USDC' ? 1 : 1)).toFixed(2)
        })),
        smartAccountAddress: user.smartAccountAddress,
        networkInfo: this.paymentService.getNetworkInfo()
      };
    } catch (error) {
      throw new Error(`Balance retrieval failed: ${error.message}`);
    }
  }

  async estimateTransactionCost({
    senderId,
    tokenSymbol,
    amount
  }) {
    try {
      const user = await User.findByPk(senderId);
      if (!user) {
        throw new Error('User not found');
      }

      const estimation = await this.paymentService.estimateTransactionFees(tokenSymbol, amount);
      
      // Add additional context
      return {
        ...estimation,
        userAddress: user.smartAccountAddress,
        sufficientBalance: await this.checkSufficientBalance(user.smartAccountAddress, tokenSymbol, amount)
      };
    } catch (error) {
      throw new Error(`Cost estimation failed: ${error.message}`);
    }
  }

  async checkSufficientBalance(userAddress, tokenSymbol, amount) {
    try {
      const balance = await this.paymentService.checkTokenBalance(userAddress, tokenSymbol);
      return parseFloat(balance.formatted) >= parseFloat(amount);
    } catch (error) {
      console.warn('Balance check failed:', error.message);
      return false;
    }
  }

  async getTransactionStatus(transactionId) {
    try {
      const transaction = await Transaction.findOne({
        where: { transactionId },
        include: [
          { 
            model: User, 
            as: 'sender', 
            attributes: ['id', 'username', 'firstname', 'lastname', 'smartAccountAddress'] 
          },
          { 
            model: User, 
            as: 'recipient', 
            attributes: ['id', 'username', 'firstname', 'lastname', 'smartAccountAddress'] 
          }
        ]
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Format amount for display
      const decimals = transaction.metadata?.tokenDecimals || 6;
      const amountToUnits = ethers.parseUnits(transaction.amount, decimals)
      const formattedAmount = ethers.formatUnits(amountToUnits, decimals);

      return {
        transactionId: transaction.transactionId,
        status: transaction.status,
        amount: formattedAmount,
        tokenSymbol: transaction.tokenSymbol,
        tokenAddress: transaction.tokenAddress,
        sender: transaction.sender ? {
          id: transaction.sender.id,
          username: transaction.sender.username,
          name: `${transaction.sender.firstname} ${transaction.sender.lastname}`.trim(),
          smartAccountAddress: transaction.sender.smartAccountAddress
        } : null,
        recipient: transaction.recipient ? {
          id: transaction.recipient.id,
          username: transaction.recipient.username,
          name: `${transaction.recipient.firstname} ${transaction.recipient.lastname}`.trim(),
          smartAccountAddress: transaction.recipient.smartAccountAddress
        } : {
          address: transaction.recipientAddress,
          identifier: transaction.recipientIdentifier
        },
        blockchainTxHash: transaction.blockchainTxHash,
        blockNumber: transaction.blockNumber?.toString(),
        gasUsed: transaction.gasUsed?.toString(),
        amountUSD: transaction.amountUSD,
        description: transaction.description,
        transactionType: transaction.transactionType,
        submittedAt: transaction.submittedAt,
        confirmedAt: transaction.confirmedAt,
        createdAt: transaction.createdAt,
        metadata: transaction.metadata,
        networkInfo: this.paymentService.getNetworkInfo()
      };
    } catch (error) {
      throw new Error(`Status retrieval failed: ${error.message}`);
    }
  }

  async getUserTransactionHistory(userId, {
    page = 1,
    limit = 20,
    status = null,
    transactionType = null,
    tokenSymbol = null,
    startDate = null,
    endDate = null
  } = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const userIdInt = parseInt(userId);

      const whereClause = {
        [Op.or]: [
          { senderId: userIdInt },
          { recipientId: userIdInt }
        ]
      };

      // Add filters
      if (status) whereClause.status = status;
      if (transactionType) whereClause.transactionType = transactionType;
      if (tokenSymbol) whereClause.tokenSymbol = tokenSymbol.toUpperCase();
      if (startDate) {
        whereClause.createdAt = { [Op.gte]: new Date(startDate) };
      }
      if (endDate) {
        whereClause.createdAt = {
          ...whereClause.createdAt,
          [Op.lte]: new Date(endDate)
        };
      }

      const { count, rows } = await Transaction.findAndCountAll({
        where: whereClause,
        include: [
          { 
            model: User, 
            as: 'sender', 
            attributes: ['id', 'username', 'firstname', 'lastname', 'smartAccountAddress'] 
          },
          { 
            model: User, 
            as: 'recipient', 
            attributes: ['id', 'username', 'firstname', 'lastname', 'smartAccountAddress'] 
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: Math.min(limit, 100), // Max 100 per page
        offset: (page - 1) * limit
      });

      const transactions = rows.map(transaction => {
        const decimals = transaction.metadata?.tokenDecimals || 6;
      
        // Convert amount to string and remove trailing zeros
        const amountStr = transaction.amount.toString().replace(/\.?0+$/, '');
      
        // Format the amount properly
        const formattedAmount = ethers.formatUnits(amountStr, decimals);
        const isIncoming = Number(transaction.recipientId) === userIdInt;

        return {
          transactionId: transaction.transactionId,
          status: transaction.status,
          type: isIncoming ? 'incoming' : 'outgoing',
          amount: formattedAmount,
          tokenSymbol: transaction.tokenSymbol,
          counterparty: isIncoming 
            ? (transaction.sender ? {
                id: transaction.sender.id,
                username: transaction.sender.username,
                name: `${transaction.sender.firstname} ${transaction.sender.lastname}`.trim()
              } : { address: 'External' })
            : (transaction.recipient ? {
                id: transaction.recipient.id,
                username: transaction.recipient.username,
                name: `${transaction.recipient.firstname} ${transaction.recipient.lastname}`.trim()
              } : { address: transaction.recipientAddress }),
          description: transaction.description,
          transactionType: transaction.transactionType,
          blockchainTxHash: transaction.blockchainTxHash,
          amountUSD: transaction.amountUSD,
          createdAt: transaction.createdAt,
          confirmedAt: transaction.confirmedAt
        };
      });

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalTransactions: count,
          hasNextPage: page < Math.ceil(count / limit),
          hasPrevPage: page > 1
        },
        summary: {
          totalSent: await this.getTotalSent(userId),
          totalReceived: await this.getTotalReceived(userId),
          pendingCount: await this.getPendingTransactionCount(userId)
        }
      };
    } catch (error) {
      throw new Error(`Transaction history retrieval failed: ${error.message}`);
    }
  }

  // Helper methods

  generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `TXN-${timestamp}-${random}`.toUpperCase();
  }

  async resolveRecipient(identifier) {
    try {
      // Check if it's a valid Ethereum address
      if (/^0x[a-fA-F0-9]{40}$/.test(identifier)) {
        // Check if this address belongs to a user in our system
        const user = await User.findOne({
          where: {
            [Op.or]: [
              { walletAddress: identifier },
              { smartAccountAddress: identifier }
            ]
          }
        });

        return {
          address: identifier,
          internal: !!user,
          userId: user?.id || null,
          username: user?.username || null
        };
      }

      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username: identifier },
            { email: identifier }
          ]
        }
      });

      if (!user) {
        throw new Error(`Recipient not found: ${identifier}`);
      }

      if (!user.smartAccountAddress) {
        throw new Error('Recipient does not have a smart account set up');
      }

      return {
        address: user.smartAccountAddress,
        internal: true,
        userId: user.id,
        username: user.username
      };
    } catch (error) {
      throw new Error(`Recipient resolution failed: ${error.message}`);
    }
  }

  async getUSDEquivalent(tokenSymbol, amount) {
    // Mock implementation - integrate with real price feed
    const mockRates = {
      'USDC': 1.00,
      'USDT': 1.00,
      'ETH': 2400.00,
      'BTC': 45000.00
    };

    const rate = mockRates[tokenSymbol.toUpperCase()] || 1.00;
    return (parseFloat(amount) * rate).toFixed(9);
  }

  async getTotalSent(userId) {
    const result = await Transaction.sum('amountUSD', {
      where: {
        senderId: userId,
        status: PaymentStatus.confirmed
      }
    });
    return (result || 0).toFixed(2);
  }

  async getTotalReceived(userId) {
    const result = await Transaction.sum('amountUSD', {
      where: {
        recipientId: userId,
        status: PaymentStatus.confirmed
      }
    });
    return (result || 0).toFixed(2);
  }

  async getPendingTransactionCount(userId) {
    return await Transaction.count({
      where: {
        [Op.or]: [
          { senderId: userId },
          { recipientId: userId }
        ],
        status: {
          [Op.in]: [PaymentStatus.pending, PaymentStatus.submitted]
        }
      }
    });
  }
}

export default TransactionService;