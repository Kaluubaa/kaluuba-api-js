'use strict';

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('clients', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.BIGINT
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
      comment: 'User who owns this client'
    },
    // Client could be a registered user or external
    clientUserId: {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'If client is a registered user'
    },
    clientIdentifier: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'Email, username, or wallet address of client'
    },
    // Business Information
    businessName: {
      type: Sequelize.STRING,
      allowNull: true
    },
    contactName: {
      type: Sequelize.STRING,
      allowNull: true
    },
    email: {
      type: Sequelize.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    address: {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Complete address object: {street, city, state, country, zipCode}'
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    metadata: {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Additional client metadata'
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

  await queryInterface.addIndex('clients', ['userId']);
  await queryInterface.addIndex('clients', ['clientUserId']);
  await queryInterface.addIndex('clients', ['email']);
  await queryInterface.addIndex('clients', ['clientIdentifier']);
  await queryInterface.addIndex('clients', ['businessName']);
  await queryInterface.addIndex('clients', ['isActive']);
  
  await queryInterface.addIndex('clients', ['userId', 'clientIdentifier'], {
    unique: true,
    name: 'unique_user_client'
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable('clients');
}