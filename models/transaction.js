'use strict';
import {
  Model
} from 'sequelize';
import { PaymentStatus, TransactionType } from '../utils/types.ts';

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
  id: {
    type: DataTypes.BIGINT,
    defaultValue: DataTypes.BIGINT,
    primaryKey: true
  },
  transactionId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  senderId: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  recipientId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  recipientAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recipientIdentifier: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tokenAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tokenSymbol: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false
  },
  amountUSD: {
    type: DataTypes.DECIMAL(20, 9),
    allowNull: true
  },
  blockchainTxHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  blockNumber: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  gasUsed: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  gasFee: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(
      PaymentStatus.pending, 
      PaymentStatus.submitted, 
      PaymentStatus.confirmed, 
      PaymentStatus.failed, 
      PaymentStatus.cancelled
    ),
    allowNull: false,
    defaultValue: PaymentStatus.pending
  },
  transactionType: {
    type: DataTypes.ENUM(TransactionType.direct, TransactionType.invoice),
    allowNull: false,
    defaultValue: TransactionType.direct
  },
  invoiceId: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  platformFee: {
    type: DataTypes.DECIMAL(20, 9),
    allowNull: true,
    defaultValue: 0
  },
  exchangeRate: {
    type: DataTypes.DECIMAL(20, 9),
    allowNull: true
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Transaction',
  tableName: 'transactions'
});

  return Transaction;
};