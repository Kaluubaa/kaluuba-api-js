'use strict';

/** @type {import('sequelize-cli').Migration} */
  export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
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
      smartAccountAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      smartAccountBalance: {
        type: Sequelize.DECIMAL(20, 9),
        default: 0,
        allowNull: true,
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
      country: {
        type: Sequelize.STRING,
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

  await queryInterface.addIndex('Users', ['email'], {
    name: 'users_email_index',
    unique: true
  });

  await queryInterface.addIndex('Users', ['username'], {
    name: 'users_username_index',
    unique: true
  });

  await queryInterface.addIndex('Users', ['walletAddress'], {
    name: 'users_wallet_address_index',
    where: {
      walletAddress: {
        [Sequelize.Op.ne]: null
      }
    }
  });

  await queryInterface.addIndex('Users', ['smartAccountAddress'], {
    name: 'users_smart_account_address_index',
    where: {
      smartAccountAddress: {
        [Sequelize.Op.ne]: null
      }
    }
  });  

    await queryInterface.addIndex('Users', ['smartAccountBalance'], {
    name: 'users_smart_account_balance_index',
    where: {
      smartAccountBalance: {
        [Sequelize.Op.ne]: null
      }
    }
  }); 

  }
  
  export async function down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }