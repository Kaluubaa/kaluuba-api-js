'use strict';

import InvoiceService from "../services/InvoiceService.js";
import { ApiResponse } from "../utils/apiResponse.js";
import db from "../models/index.js"
import { CurrencyType, DiscountType, InvoiceStatus, InvoiceType } from "../utils/types.js";
const { Invoice, Client, User } = db

export const createInvoice = async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        clientId,
        title,
        description,
        items,
        currency,
        discountType,
        discountValue,
        dueDate,
        expiryDate,
        invoiceType,
        recurrenceInterval,
        recurrenceCount,
        acceptedTokens,
        acceptsFiatPayment,
        notes
      } = req.body;
      
      if (!clientId || !title || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: clientId, title, and items are required'
        });
      }
      
      for (const item of items) {
        if (!item.name || typeof item.amount !== 'number' || item.amount < 0) {
            return ApiResponse.error(res, 'Each item must have a name and a valid rate')
        }
      }
      
      const invoiceData = {
        clientId,
        title,
        description,
        items,
        currency: currency || CurrencyType.NGN,
        discountType,
        discountValue: discountValue || 0,
        dueDate,
        expiryDate,
        invoiceType: invoiceType || InvoiceType.oneTime,
        recurrenceInterval,
        recurrenceCount,
        acceptedTokens: acceptedTokens || [],
        acceptsFiatPayment: acceptsFiatPayment || false,
        notes
      };
      
      if (invoiceType === InvoiceType.recurring && !recurrenceInterval) {
        return ApiResponse.error(res, 'Recurrence interval is required for recurring invoices')
      }
      
      const invoice = await InvoiceService.createInvoice(userId, invoiceData);

      return ApiResponse.created(res, {
        message: 'Invoice created successfully',
        invoice
      })
      
    } catch (error) {
        console.log("INVOICE ERROR", error.message)
        return ApiResponse.error(res, error.message || 'Failed to create invoice', error.response?.data)
    }
  }
  
export const getInvoices = async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        page,
        limit,
        status,
        clientId,
        startDate,
        endDate,
        search,
        sortBy,
        sortOrder
      } = req.query;
      
      const result = await InvoiceService.getInvoices(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        clientId: clientId ? parseInt(clientId) : undefined,
        startDate,
        endDate,
        search,
        sortBy,
        sortOrder
      });
      
      return ApiResponse.success(res, {
        message: 'successfully retrieved all invoices',
        result
      })
      
    } catch (error) {
        console.log("GET INVOICES ERROR: ", error.message)
        return ApiResponse.serverError(res, error.message || 'failed to retrieve invoices', error.response?.data)
    }
  }
  
export const getInvoice = async (req, res) =>{
    try {
      const userId = req.user.id;
      const invoiceId = parseInt(req.params.invoiceId);
      
      const invoice = await InvoiceService.getInvoiceDetails(invoiceId, userId);
      
      return ApiResponse.success(res, {
        message: 'invoice retrieved successfuly!',
        invoice
      })
      
    } catch (error) {
        console.log("GET INVOICE ERROR: ", error.message)
        return ApiResponse.error(res, error.message || 'failed to get invoice', error.response?.data)
    }
  }

export const updateInvoice = async (req, res) => {
    try {
      const userId = req.user.id;
      const invoiceId = parseInt(req.params.invoiceId);
      const updateData = req.body;
      
      const currentInvoice = await InvoiceService.getInvoiceDetails(invoiceId, userId);
      
      if (currentInvoice.status === InvoiceStatus.paid || currentInvoice.status === InvoiceStatus.partial) {
        return ApiResponse.error(res, 'Cannot update paid invoices')
      }
      
      if (currentInvoice.status === InvoiceStatus.cancelled) {
        return ApiResponse.error(res, 'Cannot update cancelled invoices')
      }
      const { totalAmount, discountAmount, subtotal } = await InvoiceService.calculateTotals(
            updateData.items, 
            updateData.discountType || DiscountType.percentage,
            updateData.discountValue || 0
        )

      const data = {
        ...updateData,
        totalAmount,
        subTotal: subtotal,
        discountAmount
      }

      const invoice = await currentInvoice.update(data);
      
      return ApiResponse.success(res, {
        message: 'Invoice updated successfully',
        invoice
      })
      
    } catch (error) {
        return ApiResponse.error(res, error.message, error.response?.data)
    }
  }

export const updateInvoiceStatus = async (req, res) => {
    try {
      const userId = req.user.id;
      const invoiceId = parseInt(req.params.invoiceId);
      const { status, metadata } = req.body;
      
      if (!status) {
        return ApiResponse.error(res, 'Status is required')
      }

      if (status === InvoiceStatus.paid) {
        return ApiResponse.error(res, 'cannot change status to paid')
      }
      
      const validStatuses = Object.values(InvoiceStatus);

      if (!validStatuses.includes(status)) {
        return ApiResponse.error(res, 'Invalid status. Valid statuses: ' + validStatuses.join(', '))
      }
      
      const invoice = await InvoiceService.updateInvoiceStatus(
        invoiceId, 
        userId, 
        status, 
        metadata
      );

      return ApiResponse.success(res, 
        {
            message: `Invoice ${status} successfully`,
            invoice
        })
      
    } catch (error) {
        console.log("Error Updating Status:", error.message)
        return ApiResponse.error(res, error.message, error.response?.data)
    }
  }

export const getInvoiceStats = async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = '30d' } = req.query;
      
      const stats = await InvoiceService.getInvoiceStats(userId, period);
      
      return ApiResponse.success(res, stats)
      
    } catch (error) {
        console.log("Error getting Invoice", error.message)
        return ApiResponse.serverError(res, error.message)
    }
  }

export const getPublicInvoice = async (req, res) => {
    try {
        const { invoiceNumber } = req.params;
    
        if (!invoiceNumber) {
        return ApiResponse.badRequest(res, 'Invoice number is required');
        }
      
      const invoice = await Invoice.findOne({
        where: { invoiceNumber },
        include: [
          {
            model: Client,
            as: 'client',
            attributes: ['contactName', 'businesName', 'email']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['username', 'email']
          }
        ]
      });
      
      if (!invoice) {
        return ApiResponse.badRequest(res, 'Invoice not found')
      }
      
      if (invoice.status === 'draft') {
        return ApiResponse.badRequest(res, 'Invoice not available')
      }
      
      if (invoice.isExpired()) {
        return ApiResponse.error(res, 'Invoice has expired')
      }
      
      const publicInvoiceData = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        description: invoice.description,
        items: invoice.items,
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        expiryDate: invoice.expiryDate,
        acceptedTokens: invoice.acceptedTokens,
        acceptsFiatPayment: invoice.acceptsFiatPayment,
        notes: invoice.notes,
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        client: invoice.client,
        creator: {
          username: invoice.creator.username
        }
      };

      return ApiResponse.success(res, {
        invoice: publicInvoiceData
      })

    } catch (error) {
        console.log("Error Getting invoice:", error.message)
        return ApiResponse.serverError(res, error.message, error.response?.data)
    }
  }
