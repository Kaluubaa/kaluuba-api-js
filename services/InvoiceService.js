'use strict';

import db from "../models/index.js"
import { Op } from 'sequelize';
import crypto from 'crypto';
import { DiscountType, InvoiceStatus, InvoiceType, PaymentStatus, TokenSymbols, TransactionType } from "../utils/types.js";
import TransactionService from "./TransactionService.js";
const { Invoice, Client, User, Transaction, sequelize } = db;

class InvoiceService {
    constructor() {
        this.transactionService = new TransactionService();
    }

    static async generateInvoiceNumber() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(6).toString('hex');
        return `INV-${timestamp}-${random}`.toUpperCase();
    }

  static async createInvoice(userId, invoiceData) {
    try {
      const client = await Client.findOne({
        where: { 
          id: invoiceData.clientId, 
          userId 
        }
      });
      
      if (!client) {
        throw new Error('Client not found or access denied');
      }
      
      if (!invoiceData.dueDate) {
        const dueDate = new Date();
        const daysToAdd = client.paymentTerms || 7;
        dueDate.setDate(dueDate.getDate() + daysToAdd);
        
        invoiceData.dueDate = dueDate;
      }

    const{ totalAmount, subtotal, discountAmount } = await this.calculateTotals(invoiceData.items, invoiceData.discountType || DiscountType.percentage, invoiceData.discountValue || 0);
      
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await Invoice.create({
        ...invoiceData,
        userId,
        invoiceNumber,
        status: InvoiceStatus.draft,
        remainingAmount: 0,
        totalAmount,
        subTotal: subtotal,
        discountAmount
    });
      
      return await this.getInvoiceDetails(invoice.id, userId);
    } catch (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }
  
  static async  getInvoiceDetails(invoiceId, userId) {
    const invoice = await Invoice.findOne({
      where: { 
        id: invoiceId, 
        userId 
      },
      include: [
        {
          model: Client,
          as: 'client',
          include: [
            { model: User, as: 'registeredUser', attributes: ['id', 'username', 'email'] }
          ]
        },
        { model: User, as: 'creator', attributes: ['id', 'username', 'email'] },
        { model: Invoice, as: 'parentInvoice', attributes: ['id', 'invoiceNumber'] },
        { model: Invoice, as: 'recurringInvoices', attributes: ['id', 'invoiceNumber', 'status'] },
        {
          model: Transaction,
          as: 'transactions',
          where: { status: 'confirmed' },
          required: false
        }
      ]
    });
    
    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }
    
    return invoice;
  }
  
  static async updateInvoiceStatus(invoiceId, userId, status, metadata = {}) {
    const invoice = await Invoice.findOne({
      where: { 
        id: invoiceId, 
        userId 
      }
    });
    
    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }
    
    const updates = { status };
    
    switch (status) {
      case InvoiceStatus.sent:
        if (!invoice.sentAt) updates.sentAt = new Date();
        break;
      case InvoiceStatus.cancelled:
        await Transaction.update(
          { status: PaymentStatus.cancelled },
          { 
            where: { 
              invoiceId: invoiceId,
              status: PaymentStatus.pending 
            }
          }
        );
        break;
    }
    
    await invoice.update(updates);
    return await this.getInvoiceDetails(invoiceId, userId);
  }
  
  static async processPayment(invoiceId, userId, paymentData) {
    const { amount, tokenSymbol = TokenSymbols.USDC, description = 'invoice payment' } = paymentData;
    
    const invoice = await Invoice.findOne({
      where: { 
        id: invoiceId, 
        userId 
      },
      include: [
        {
          model: Client,
          as: 'client',
          include: [
            { model: User, as: 'registeredUser' }
          ]
        }
      ]
    });
    
    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }
    
    if (invoice.status === InvoiceStatus.paid) {
      throw new Error('Invoice already paid in full');
    }
    
    if (invoice.isExpired()) {
      throw new Error('Invoice has expired');
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    if (paymentAmount > parseFloat(invoice.remainingAmount)) {
      throw new Error('Payment amount exceeds remaining balance');
    }

    // Get recipient and sender (same as processPayment)
    let recipientIdentifier;
    if (invoice.client.registeredUser) {
      recipientIdentifier = invoice.client.registeredUser.username || invoice.client.registeredUser.email;
    } else if (invoice.client.walletAddress) {
      recipientIdentifier = invoice.client.walletAddress;
    } else {
      throw new Error('Client does not have a valid payment destination');
    }

    const sender = await User.findByPk(userId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    try {
      const result = await this.transactionService.createAndExecuteTransaction({
        senderId: sender.id,
        recipientIdentifier,
        tokenSymbol: tokenSymbol.toUpperCase(),
        amount: paymentAmount.toString(),
        description: `${description} - Invoice #${invoice.invoiceNumber}`,
        transactionType: TransactionType.invoice,
        userPassword: sender.password,
        invoiceId: invoice.id
      });

      // Update invoice with partial payment
      const newPaidAmount = parseFloat(invoice.paidAmount) + paymentAmount;
      const newRemainingAmount = parseFloat(invoice.totalAmount) - newPaidAmount;

      let newStatus = invoice.status;
      if (newRemainingAmount <= 0) {
        newStatus = InvoiceStatus.paid;
      } else if (newPaidAmount > 0) {
        newStatus = InvoiceStatus.partial_paid;
      }

      await invoice.update({
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        paidAt: newStatus === InvoiceStatus.paid ? new Date() : null
      });

      return {
        invoice: await this.getInvoiceDetails(invoiceId, userId),
        paymentResult: result
      };

    } catch (error) {
      console.error('Partial payment failed:', error);
      throw new Error(`Partial payment processing failed: ${error.message}`);
    }
  }
  
  static async getInvoices(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;
    
    const where = { userId };
    const include = [
      {
        model: Client,
        as: 'client',
        include: [
          { model: User, as: 'registeredUser', attributes: ['id', 'username'] }
        ]
      }
    ];
    
    if (status) {
      where.status = status;
    }
    
    if (clientId) {
      where.clientId = clientId;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    if (search) {
      where[Op.or] = [
        { invoiceNumber: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { '$client.contactName$': { [Op.iLike]: `%${search}%` } },
        { '$client.businessName$': { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const { rows, count } = await Invoice.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });
    
    return {
      invoices: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  }

  static async getInvoiceStats(userId, period = '30d') {
    const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    const baseWhere = {
      userId,
      createdAt: { [Op.gte]: startDate }
    };
    
    const [totalInvoices, paidInvoices, overdueInvoices, totalRevenue] = await Promise.all([
      Invoice.count({ where: baseWhere }),
      Invoice.count({ where: { ...baseWhere, status: 'paid' } }),
      Invoice.count({ 
        where: { 
          userId,
          status: { [Op.notIn]: ['paid', 'cancelled'] },
          dueDate: { [Op.lt]: new Date() }
        } 
      }),
      Invoice.sum('totalAmount', { 
        where: { ...baseWhere, status: 'paid' } 
      })
    ]);
    
    // Get monthly revenue trend
    const monthlyRevenue = await Invoice.findAll({
      where: {
        userId,
        status: 'paid',
        paidAt: { 
          [Op.gte]: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
        }
      },
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('paidAt')), 'month'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'revenue']
      ],
      group: ['month'],
      order: [['month', 'ASC']],
      raw: true
    });
    
    return {
      totalInvoices,
      paidInvoices,
      overdueInvoices,
      totalRevenue: totalRevenue || 0,
      paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices * 100).toFixed(2) : 0,
      monthlyRevenue
    };
  }
  
  static async generateRecurringInvoices() {
    const recurringInvoices = await Invoice.findAll({
      where: {
        invoiceType: InvoiceType.recurring,
        nextInvoiceDate: { [Op.lte]: new Date() },
        status: InvoiceStatus.paid // Only generate from paid invoices
      },
      include: [
        { model: Client, as: 'client' }
      ]
    });
    
    const results = [];
    
    for (const invoice of recurringInvoices) {
      try {
        const newInvoice = await invoice.generateNextRecurringInvoice();
        if (newInvoice) {
          results.push({
            parentInvoiceId: invoice.id,
            newInvoiceId: newInvoice.id,
            success: true
          });
        }
      } catch (error) {
        results.push({
          parentInvoiceId: invoice.id,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }
  
  static async markOverdueInvoices() {
    const overdueInvoices = await Invoice.findAll({
      where: {
        status: { [Op.notIn]: [
            InvoiceStatus.paid, 
            InvoiceStatus.cancelled, 
            InvoiceStatus.overdue
        ]},
        dueDate: { [Op.lt]: new Date() }
      }
    });
    
    const results = [];
    
    for (const invoice of overdueInvoices) {
      try {
        await invoice.update({ status: InvoiceStatus.overdue });
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          success: true
        });
      } catch (error) {
        results.push({
          invoiceId: invoice.id,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  static async calculateTotals(items = [], discountType, discountValue) {
        let subtotal = 0;
        
        items.forEach(item => {
          subtotal += (item.quantity || 1) * (item.amount || 0);
        });
        
        let discountAmount = 0;
        if (discountType === DiscountType.percentage) {
          discountAmount = (subtotal * (discountValue || 0)) / 100;
        } else if (discountType === DiscountType.fixed) {
          discountAmount = this.discountValue || 0;
        }
        
        const afterDiscount = subtotal - discountAmount;
        const totalAmount = afterDiscount;
        
        return {
          subtotal,
          discountAmount,
          totalAmount
        };
      }
}

export default InvoiceService;