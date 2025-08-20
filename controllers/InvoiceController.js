// controllers/InvoiceController.js
'use strict';

import {  InvoiceService, ClientService } from "../services/InvoiceService.js";

export const createInvoice = async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        clientId,
        title,
        description,
        items,
        currency,
        taxRate,
        discountType,
        discountValue,
        dueDate,
        expiryDate,
        invoiceType,
        recurrenceInterval,
        recurrenceCount,
        acceptedTokens,
        acceptsFiatPayment,
        paymentInstructions,
        terms,
        publicNotes
      } = req.body;
      
      // Validate required fields
      if (!clientId || !title || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: clientId, title, and items are required'
        });
      }
      
      // Validate items structure
      for (const item of items) {
        if (!item.name || typeof item.rate !== 'number' || item.rate < 0) {
          return res.status(400).json({
            success: false,
            message: 'Each item must have a name and a valid rate'
          });
        }
      }
      
      const invoiceData = {
        clientId,
        title,
        description,
        items,
        currency: currency || 'USD',
        taxRate: taxRate || 0,
        discountType,
        discountValue: discountValue || 0,
        dueDate,
        expiryDate,
        invoiceType: invoiceType || 'one_time',
        recurrenceInterval,
        recurrenceCount,
        acceptedTokens: acceptedTokens || [],
        acceptsFiatPayment: acceptsFiatPayment || false,
        paymentInstructions,
        terms,
        publicNotes
      };
      
      // Validate recurring invoice fields
      if (invoiceType === 'recurring' && !recurrenceInterval) {
        return res.status(400).json({
          success: false,
          message: 'Recurrence interval is required for recurring invoices'
        });
      }
      
      const invoice = await InvoiceService.createInvoice(userId, invoiceData);
      
      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: { invoice }
      });
      
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
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
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
export const getInvoice = async (req, res) =>{
    try {
      const userId = req.user.id;
      const invoiceId = parseInt(req.params.id);
      
      const invoice = await InvoiceService.getInvoiceDetails(invoiceId, userId);
      
      res.json({
        success: true,
        data: { invoice }
      });
      
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
export const updateInvoice = async (req, res) => {
    try {
      const userId = req.user.id;
      const invoiceId = parseInt(req.params.id);
      const updateData = req.body;
      
      // Get current invoice to check status
      const currentInvoice = await InvoiceService.getInvoiceDetails(invoiceId, userId);
      
      if (currentInvoice.status === 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update paid invoices'
        });
      }
      
      if (currentInvoice.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update cancelled invoices'
        });
      }
      
      const invoice = await currentInvoice.update(updateData);
      
      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: { invoice }
      });
      
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

export const updateInvoiceStatus = async (req, res) => {
    try {
      const userId = req.user.id;
      const invoiceId = parseInt(req.params.id);
      const { status, metadata } = req.body;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }
      
      const validStatuses = ['draft', 'sent', 'viewed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
        });
      }
      
      const invoice = await InvoiceService.updateInvoiceStatus(
        invoiceId, 
        userId, 
        status, 
        metadata
      );
      
      res.json({
        success: true,
        message: `Invoice ${status} successfully`,
        data: { invoice }
      });
      
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

export const getInvoiceStats = async (req, res) => {
    try {
      const userId = req.user.id;
      const { period = '30d' } = req.query;
      
      const stats = await InvoiceService.getInvoiceStats(userId, period);
      
      res.json({
        success: true,
        data: { stats }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

export const getPublicInvoice = async (req, res) => {
    try {
      const { invoiceNumber } = req.params;
      
      const invoice = await Invoice.findOne({
        where: { invoiceNumber },
        include: [
          {
            model: Client,
            as: 'client',
            attributes: ['contactName', 'businessName', 'email']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['username', 'email']
          }
        ]
      });
      
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }
      
      if (invoice.status === 'draft') {
        return res.status(404).json({
          success: false,
          message: 'Invoice not available'
        });
      }
      
      if (invoice.isExpired()) {
        return res.status(400).json({
          success: false,
          message: 'Invoice has expired'
        });
      }
      
      // Mark as viewed if first time
      if (invoice.status === 'sent' && !invoice.viewedAt) {
        await invoice.update({ 
          status: 'viewed',
          viewedAt: new Date()
        });
      }
      
      // Don't expose sensitive data
      const publicInvoiceData = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        description: invoice.description,
        items: invoice.items,
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        expiryDate: invoice.expiryDate,
        acceptedTokens: invoice.acceptedTokens,
        acceptsFiatPayment: invoice.acceptsFiatPayment,
        paymentInstructions: invoice.paymentInstructions,
        terms: invoice.terms,
        publicNotes: invoice.publicNotes,
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        client: invoice.client,
        creator: {
          username: invoice.creator.username
        }
      };
      
      res.json({
        success: true,
        data: { invoice: publicInvoiceData }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
