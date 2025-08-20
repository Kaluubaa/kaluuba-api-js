'use strict';

const { InvoiceStatus, InvoiceType, RecurrenceInterval, DiscountType } = require('../utils/types.js');

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('invoices', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.BIGINT
    },
    invoiceNumber: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      comment: 'Human-readable invoice number (INV-2024-001)'
    },
    userId: {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: {
        model: 'User',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Invoice creator/sender'
    },
    clientId: {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'Client',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Invoice recipient'
    },
    // Invoice Type and Recurrence
    invoiceType: {
      type: Sequelize.ENUM(
        InvoiceType.oneTime,      // 'one_time'
        InvoiceType.recurring     // 'recurring'
      ),
      allowNull: false,
      defaultValue: InvoiceType.oneTime
    },
    parentInvoiceId: {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'Invoices',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Parent invoice for recurring invoices'
    },
    // Recurrence Settings
    recurrenceInterval: {
      type: Sequelize.ENUM(
        RecurrenceInterval.weekly,    // 'weekly'
        RecurrenceInterval.monthly,   // 'monthly'
        RecurrenceInterval.quarterly, // 'quarterly'
        RecurrenceInterval.yearly     // 'yearly'
      ),
      allowNull: true,
      comment: 'Required for recurring invoices'
    },
    recurrenceCount: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Number of times to repeat (null = infinite)'
    },
    nextInvoiceDate: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When next recurring invoice should be generated'
    },
    // Invoice Details
    title: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Invoice title/subject'
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    // Line Items (stored as JSON)
    items: {
      type: Sequelize.JSONB,
      allowNull: false,
      comment: 'Array of invoice items: [{name, description, quantity, rate, amount}]'
    },
    // Financial Information
    currency: {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'USD'
    },
    subtotal: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: false,
      comment: 'Sum of all line items before tax/discount'
    },
    discountType: {
      type: Sequelize.ENUM(DiscountType.percentage, DiscountType.fixed),
      allowNull: true
    },
    discountValue: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: true,
      defaultValue: 0
    },
    discountAmount: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: true,
      defaultValue: 0
    },
    totalAmount: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: false,
      comment: 'Final amount after discount'
    },
    // Payment Information
    acceptedTokens: {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Array of accepted token addresses and symbols'
    },
    acceptsFiatPayment: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    // Status and Dates
    status: {
      type: Sequelize.ENUM(
        InvoiceStatus.draft,      // 'draft'
        InvoiceStatus.sent,       // 'sent'
        InvoiceStatus.viewed,     // 'viewed'
        InvoiceStatus.partial,    // 'partial_paid'
        InvoiceStatus.paid,       // 'paid'
        InvoiceStatus.overdue,    // 'overdue'
        InvoiceStatus.cancelled   // 'cancelled'
      ),
      allowNull: false,
      defaultValue: InvoiceStatus.draft
    },
    issueDate: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    },
    dueDate: {
      type: Sequelize.DATE,
      allowNull: false
    },
    expiryDate: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Optional expiry date for time-limited invoices'
    },
    paidAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    sentAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    // Payment Tracking
    paidAmount: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: false,
      defaultValue: 0
    },
    remainingAmount: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: false,
      defaultValue: 0
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Internal notes (not visible to client)'
    },
    metadata: {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Additional invoice metadata'
    },
    // Auto-generation tracking
    isAutoGenerated: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this invoice was auto-generated from recurring'
    },
    // Timestamps
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE
    }
  });

  await queryInterface.addIndex('invoices', ['userId']);
  await queryInterface.addIndex('invoices', ['clientId']);
  await queryInterface.addIndex('invoices', ['status']);
  await queryInterface.addIndex('invoices', ['invoiceNumber']);
  await queryInterface.addIndex('invoices', ['dueDate']);
  await queryInterface.addIndex('invoices', ['expiryDate']);
  await queryInterface.addIndex('invoices', ['issueDate']);
  await queryInterface.addIndex('invoices', ['nextInvoiceDate']);
  await queryInterface.addIndex('invoices', ['parentInvoiceId']);
  await queryInterface.addIndex('invoices', ['invoiceType']);
  await queryInterface.addIndex('invoices', ['isAutoGenerated']);
  
  await queryInterface.addIndex('invoices', ['userId', 'status']);
  await queryInterface.addIndex('invoices', ['clientId', 'status']);
  await queryInterface.addIndex('invoices', ['status', 'dueDate']);
  await queryInterface.addIndex('invoices', ['invoiceType', 'nextInvoiceDate']);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable('invoices');
}