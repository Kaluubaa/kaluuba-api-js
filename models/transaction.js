'use strict';
import {
  Model
} from 'sequelize';
import { PaymentStatus, TransactionType } from '../utils/types.js';

export default (sequelize, DataTypes) => {
  class Transaction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Transaction.belongsTo(models.User, {
        foreignKey: 'senderId',
        as: 'sender',
        onDelete: 'CASCADE'
      });
      Transaction.belongsTo(models.User, {
        foreignKey: 'recipientId',
        as: 'recipient',
        onDelete: 'CASCADE'
      });
    }

    async markAsSubmitted(txHash) {
      this.blockchainTxHash = txHash;
      this.status = PaymentStatus.submitted;
      this.submittedAt = new Date();
      await this.save();
    }

    async markAsConfirmed(blockNumber, gasUsed) {
      this.status = PaymentStatus.confirmed;
      this.blockNumber = blockNumber;
      this.gasUsed = gasUsed;
      this.confirmedAt = new Date();
      await this.save();
    }

    async markAsFailed() {
      this.status = PaymentStatus.failed;
      await this.save();
    }
  }
  Transaction.init({
  transactionId: DataTypes.STRING,
  senderId: DataTypes.BIGINT,
  recipientId: DataTypes.BIGINT,
  recipientAddress: DataTypes.STRING,
  recipientIdentifier: DataTypes.STRING,
  tokenAddress:DataTypes.STRING,
  tokenSymbol: DataTypes.STRING,
  amount: DataTypes.DECIMAL(36, 18),
  amountUSD: DataTypes.DECIMAL(20, 9),
  blockchainTxHash: DataTypes.STRING,
  blockNumber: DataTypes.BIGINT,
  gasUsed: DataTypes.BIGINT,
  gasFee: DataTypes.DECIMAL(36, 18),
  status: DataTypes.ENUM(
      PaymentStatus.pending, 
      PaymentStatus.submitted, 
      PaymentStatus.confirmed, 
      PaymentStatus.failed, 
      PaymentStatus.cancelled
    ),
  transactionType: DataTypes.ENUM(TransactionType.direct, TransactionType.invoice),
  invoiceId: DataTypes.BIGINT,
  description: DataTypes.TEXT,
  metadata:  DataTypes.JSONB,
  platformFee: DataTypes.DECIMAL(20, 9),
  exchangeRate: DataTypes.DECIMAL(20, 9),
  submittedAt: DataTypes.DATE,
  confirmedAt:  DataTypes.DATE
}, {
  sequelize,
  modelName: 'Transaction',
  tableName: 'transactions'
});

  return Transaction;
};