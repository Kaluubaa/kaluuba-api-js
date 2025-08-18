'use strict';

const { PaymentStatus, TransactionType } = require('../utils/types');

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('transactions', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.BIGINT
    },
    transactionId: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
      comment: 'Unique transaction identifier for API'
    },
    senderId: {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    recipientId: {
      type: Sequelize.BIGINT,
      allowNull: true, // null for external recipients
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    recipientAddress: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'External wallet address if recipient not in system'
    },
    recipientIdentifier: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Username, email, or wallet address used for recipient'
    },
    tokenAddress: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'ERC20 token contract address'
    },
    tokenSymbol: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Token symbol (USDC, USDT, etc.)'
    },
    amount: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      comment: 'Amount in token decimals'
    },
    amountUSD: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: true,
      comment: 'USD equivalent at time of transaction'
    },
    blockchainTxHash: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Blockchain transaction hash'
    },
    blockNumber: {
      type: Sequelize.BIGINT,
      allowNull: true
    },
    gasUsed: {
      type: Sequelize.BIGINT,
      allowNull: true
    },
    gasFee: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: true
    },
    status: {
      type: Sequelize.ENUM(
        PaymentStatus.pending,      // Created, not yet on blockchain
        PaymentStatus.submitted,    // Submitted to blockchain
        PaymentStatus.confirmed,    // Confirmed on blockchain
        PaymentStatus.failed,       // Transaction failed
        PaymentStatus.failed     // Cancelled by user
      ),
      allowNull: false,
      defaultValue: PaymentStatus.pending
    },
    transactionType: {
      type: Sequelize.ENUM(TransactionType.direct, TransactionType.invoice),
      allowNull: false,
      defaultValue: TransactionType.direct
    },
    invoiceId: {
      type: Sequelize.BIGINT,
      allowNull: true,
      comment: 'Reference to invoice if payment is for invoice'
    },     
    // Metadata
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    metadata: {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Additional transaction metadata'
    },
    platformFee: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: true,
      defaultValue: 0
    },
    exchangeRate: {
      type: Sequelize.DECIMAL(20, 9),
      allowNull: true,
      comment: 'Exchange rate if fiat conversion involved'
    },
    submittedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    confirmedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false
    }
  });

  await queryInterface.addIndex('Transactions', ['senderId']);
  await queryInterface.addIndex('Transactions', ['recipientId']);
  await queryInterface.addIndex('Transactions', ['status']);
  await queryInterface.addIndex('Transactions', ['blockchainTxHash']);
  await queryInterface.addIndex('Transactions', ['transactionId']);
  await queryInterface.addIndex('Transactions', ['createdAt']);
  await queryInterface.addIndex('Transactions', ['tokenAddress']);
}
export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable('transactions');
}