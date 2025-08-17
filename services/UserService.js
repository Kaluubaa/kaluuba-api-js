import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Op } from 'sequelize';
import db from '../models/index.js';
import { BASE_URL } from '../utils/constants.js';
import SmartAccountService from './SmartAccountService.js';
import EncryptionService from './EncryptionService.js';

const { User } = db;

class UserService {
  static async checkUserExists(email, username) {
    try {
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() }
          ]
        }
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          return { exists: true, field: 'email', message: 'Email address is already registered' };
        }
        if (existingUser.username === username.toLowerCase()) {
          return { exists: true, field: 'username', message: 'Username is already taken' };
        }
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw new Error('Database error occurred while checking user existence');
    }
  }

  static async hashPassword(password) {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Error processing password');
    }
  }

  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async createUser(userData) {
    const { username, email, password } = userData;
    
    try {
      const hashedPassword = await this.hashPassword(password);
      const verificationToken = this.generateOTP();

      const user = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: hashedPassword,
        isverified: false,
        verificationToken,
        emailVerifiedAt: null,
      });

      const { password: _, ...userWithoutPassword } = user.toJSON();
      return userWithoutPassword;
    } catch (error) {
      console.error('Error creating user:', error);
      
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message
        }));
        throw new Error(`Validation error: ${JSON.stringify(validationErrors)}`);
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors[0]?.path;
        throw new Error(`${field} is already registered`);
      }
      
      throw new Error('Failed to create user account');
    }
  }

//   static generateVerificationLink(email, token) {
//     return `${BASE_URL}/auth/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
//   }

  static async findUserByEmail(email) {
    try {
      return await User.findOne({ 
        where: { email: email.toLowerCase() } 
      });
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error('Database error occurred');
    }
  }

  static async findUserByUsername(username) {
    try {
      return await User.findOne({ 
        where: { username: username.toLowerCase() } 
      });
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw new Error('Database error occurred');
    }
  }

  static async updateLastLogin(userId) {
    return await User.update(
      { lastLoginAt: new Date() },
      { where: { id: userId } }
    );
  }

  static async verifyEmailToken(email, otp) {
    try {
      const user = await User.findOne({
        where: {
          email: email.toLowerCase(),
          verificationToken: otp,
          isverified: false
        }
      });

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        if (user.isverified) {
        return { success: false, message: 'Email is already verified' };
        }

        if (!user.verificationToken) {
        return { success: false, message: 'No valid OTP found. Please request a new one.' };
        }

        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        
        if (user.updatedAt < fifteenMinutesAgo) {
        return { success: false, message: 'Invalid or expired verification OTP' };
        }

        if (user.verificationToken !== otp) {
        return { success: false, message: 'Invalid OTP' };
        }

        const createdWallet = await SmartAccountService.createUserWallet(
            user.id.toString(),
            user.password
            );

        if (!createdWallet.success) {
        throw new Error('Failed to create user wallet');
        }


        await user.update({
        isverified: true,
        emailVerifiedAt: new Date(),
        verificationToken: null,
        walletAddress: createdWallet.walletData.walletAddress,
        smartAccountAddress: createdWallet.walletData.smartAccountAddress,
        privateKey: createdWallet.walletData.encryptedPrivateKey
        });

        return { success: true, message: 'Email verified successfully', user };
    } catch (error) {
      console.error('Error verifying email token:', error);
      throw new Error('Failed to verify email');
    }
  }

static async setUserPin(userId, password, pin) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify user's password first
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new Error('Invalid password');
    }

    if (!/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be 6 digits');
    }

    const masterPassword = await EncryptionService.generateMasterPassword(password, userId);

    const encryptedPin = await EncryptionService.encryptPrivateKey(pin, masterPassword);

    await user.update({ pin: encryptedPin });
    return true;
  } catch (error) {
    console.error('Error setting user PIN:', error);
    throw new Error(`Failed to set PIN: ${error.message}`);
  }
}

static async updateUserPin(userId, currentPassword, newPin) {
  try {
    return await this.setUserPin(userId, currentPassword, newPin);
  } catch (error) {
    console.error('Error updating user PIN:', error);
    throw new Error(`Failed to update PIN: ${error.message}`);
  }
}

static async getDecryptedPin(userId, password) {
  try {
    const user = await User.findByPk(userId);
    if (!user || !user.pin) {
      throw new Error('PIN not set for user');
    }

    const masterPassword = await EncryptionService.generateMasterPassword(password, userId);

    const decryptedPin = await EncryptionService.decryptPrivateKey(user.pin, masterPassword);
    
    return decryptedPin;
  } catch (error) {
    console.error('Error getting user PIN:', error);
    throw new Error(`Failed to get PIN: ${error.message}`);
  }
}

static async verifyUserPin(userId, password, pin) {
  try {
    const decryptedPin = await this.getDecryptedPin(userId, password);
    return decryptedPin === pin;
  } catch (error) {
    console.error('Error verifying user PIN:', error);
    throw new Error(`Failed to verify PIN: ${error.message}`);
  }
}
}

export default UserService;