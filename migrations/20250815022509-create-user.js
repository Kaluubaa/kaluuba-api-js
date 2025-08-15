'use strict';

/** @type {import('sequelize-cli').Migration} */
  export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      firstname: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastname: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      privatekey: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      pin: {
        type: Sequelize.STRING,
        allowNull: true
      },
      walletAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      smartAccount: {
        type: Sequelize.STRING,
        allowNull: true
      },
      isverified: {
        type: Sequelize.BOOLEAN,
        default: false,
        allowNull: true
      },
      verificationToken: {
        type: Sequelize.STRING,
        allowNull: true
      },
      emailVerifiedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  }
  
  export async function down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }