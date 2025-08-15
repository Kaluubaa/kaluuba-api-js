import SmartAccountService from '../services/SmartAccountService.js';
import ValidationService from '../services/ValidationService.js';
import UserService from '../services/UserService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import bcrypt from 'bcrypt';

class WalletController {

  static async getWalletInfo(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      const user = await UserService.findUserById(userId);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      const networkInfo = SmartAccountService.getNetworkInfo();
      
      let balance = null;
      if (user.walletAddress) {
        try {
          balance = await SmartAccountService.getWalletBalance(user.walletAddress);
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      }

      return ApiResponse.success(res, {
        wallet: {
          address: user.walletAddress,
          smartAccountAddress: user.smartAccountAddress,
          balance: balance ? `${balance} ETH` : null,
          isVerified: user.isverified
        },
        network: networkInfo
      });

    } catch (error) {
      console.error('Error getting wallet info:', error);
      return ApiResponse.serverError(res, 'Failed to retrieve wallet information');
    }
  }

  static async exportPrivateKey(req, res) {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      if (!password) {
        return ApiResponse.badRequest(res, 'Password is required for private key export');
      }

      const user = await UserService.findUserById(userId);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return ApiResponse.unauthorized(res, 'Invalid password');
      }

      if (!user.privateKey) {
        return ApiResponse.notFound(res, 'No private key found for this account');
      }

      const decryptedPrivateKey = await SmartAccountService.decryptUserPrivateKey(
        user.privateKey,
        userId.toString(),
        password
      );

      return ApiResponse.success(res, {
        privateKey: decryptedPrivateKey,
        walletAddress: user.walletAddress,
        warning: 'Keep your private key secure. Never share it with anyone.'
      });

    } catch (error) {
      console.error('Error exporting private key:', error);
      
      if (error.message.includes('Failed to decrypt')) {
        return ApiResponse.unauthorized(res, 'Invalid password or corrupted private key');
      }
      
      return ApiResponse.serverError(res, 'Failed to export private key');
    }
  }

  static async importWallet(req, res) {
    try {
      const userId = req.user?.id;
      const { privateKey, password } = req.body;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      if (!privateKey || !password) {
        return ApiResponse.badRequest(res, 'Private key and password are required');
      }

      // Validate private key format
      if (!EncryptionService.validatePrivateKeyFormat(privateKey)) {
        return ApiResponse.badRequest(res, 'Invalid private key format');
      }

      // Find user and verify password
      const user = await UserService.findUserById(userId);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return ApiResponse.unauthorized(res, 'Invalid password');
      }

      // Create wallet from private key to get addresses
      const { wallet, viemAccount } = await SmartAccountService.createWalletFromEncrypted(
        privateKey, // This will encrypt the provided private key
        userId.toString(),
        password
      );

      // Encrypt the private key
      const masterPassword = await EncryptionService.generateMasterPassword(
        password,
        userId.toString()
      );
      
      const encryptedPrivateKey = await EncryptionService.encryptPrivateKey(
        privateKey,
        masterPassword
      );

      // Create smart account
      const { smartAccount } = await SmartAccountService.recreateSmartAccount(
        encryptedPrivateKey,
        userId.toString(),
        password
      );

      // Update user's wallet information
      await user.update({
        privateKey: encryptedPrivateKey,
        walletAddress: wallet.address,
        smartAccountAddress: smartAccount.address
      });

      return ApiResponse.success(res, {
        message: 'Wallet imported successfully',
        wallet: {
          address: wallet.address,
          smartAccountAddress: smartAccount.address
        }
      });

    } catch (error) {
      console.error('Error importing wallet:', error);
      return ApiResponse.serverError(res, 'Failed to import wallet');
    }
  }

  static async updateWalletEncryption(req, res) {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      if (!currentPassword || !newPassword) {
        return ApiResponse.badRequest(res, 'Current password and new password are required');
      }

      const passwordValidation = ValidationService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return ApiResponse.badRequest(res, passwordValidation.message);
      }

      // Find user and verify current password
      const user = await UserService.findUserById(userId);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return ApiResponse.unauthorized(res, 'Invalid current password');
      }

      if (!user.privateKey) {
        return ApiResponse.notFound(res, 'No private key found to update');
      }

      // Re-encrypt private key with new password
      const newEncryptedKey = await SmartAccountService.reencryptPrivateKey(
        user.privateKey,
        userId.toString(),
        currentPassword,
        newPassword
      );

      // Hash new password
      const hashedNewPassword = await UserService.hashPassword(newPassword);

      // Update user's password and encrypted private key
      await user.update({
        password: hashedNewPassword,
        privateKey: newEncryptedKey
      });

      return ApiResponse.success(res, {
        message: 'Wallet encryption updated successfully'
      });

    } catch (error) {
      console.error('Error updating wallet encryption:', error);
      
      if (error.message.includes('Failed to decrypt')) {
        return ApiResponse.unauthorized(res, 'Invalid current password');
      }
      
      return ApiResponse.serverError(res, 'Failed to update wallet encryption');
    }
  }

  static async generateNewWallet(req, res) {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      if (!password) {
        return ApiResponse.badRequest(res, 'Password is required');
      }

      const user = await UserService.findUserById(userId);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return ApiResponse.unauthorized(res, 'Invalid password');
      }

      const createdWallet = await SmartAccountService.createUserWallet(
        userId.toString(),
        password
      );

      if (!createdWallet.success) {
        throw new Error('Failed to generate new wallet');
      }

      await user.update({
        privateKey: createdWallet.walletData.encryptedPrivateKey,
        walletAddress: createdWallet.walletData.walletAddress,
        smartAccountAddress: createdWallet.walletData.smartAccountAddress
      });

      return ApiResponse.success(res, {
        message: 'New wallet generated successfully',
        wallet: {
          address: createdWallet.walletData.walletAddress,
          smartAccountAddress: createdWallet.walletData.smartAccountAddress,
          network: createdWallet.walletData.chainName
        },
        warning: 'Your previous wallet is no longer accessible. Make sure to backup the new private key.'
      });

    } catch (error) {
      console.error('Error generating new wallet:', error);
      return ApiResponse.serverError(res, 'Failed to generate new wallet');
    }
  }

  static async validateAddresses(req, res) {
    try {
      const { walletAddress, smartAccountAddress } = req.query;

      if (!walletAddress && !smartAccountAddress) {
        return ApiResponse.badRequest(res, 'At least one address is required');
      }

      const results = {};

      if (walletAddress) {
        results.walletAddress = {
          address: walletAddress,
          isValid: SmartAccountService.validateAddresses(walletAddress, '0x0000000000000000000000000000000000000000')
        };
      }

      if (smartAccountAddress) {
        results.smartAccountAddress = {
          address: smartAccountAddress,
          isValid: SmartAccountService.validateAddresses('0x0000000000000000000000000000000000000000', smartAccountAddress)
        };
      }

      return ApiResponse.success(res, { validation: results });

    } catch (error) {
      console.error('Error validating addresses:', error);
      return ApiResponse.serverError(res, 'Failed to validate addresses');
    }
  }

  static async getNetworkInfo(req, res) {
    try {
      const networkInfo = SmartAccountService.getNetworkInfo();
      
      return ApiResponse.success(res, {
        network: networkInfo,
        environment: process.env.NODE_ENV
      });

    } catch (error) {
      console.error('Error getting network info:', error);
      return ApiResponse.serverError(res, 'Failed to retrieve network information');
    }
  }

  static async getBalances(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return ApiResponse.unauthorized(res, 'Authentication required');
      }

      const user = await UserService.findUserById(userId);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      const balances = {};

      // Get EOA wallet balance
      if (user.walletAddress) {
        try {
          const walletBalance = await SmartAccountService.getWalletBalance(user.walletAddress);
          balances.wallet = {
            address: user.walletAddress,
            balance: walletBalance,
            type: 'EOA'
          };
        } catch (error) {
          console.error('Error fetching wallet balance:', error);
          balances.wallet = {
            address: user.walletAddress,
            balance: null,
            error: 'Failed to fetch balance',
            type: 'EOA'
          };
        }
      }

      // Get smart account balance
      if (user.smartAccount) {
        try {
          const smartAccountBalance = await SmartAccountService.getWalletBalance(user.smartAccount);
          balances.smartAccount = {
            address: user.smartAccount,
            balance: smartAccountBalance,
            type: 'Smart Account'
          };
        } catch (error) {
          console.error('Error fetching smart account balance:', error);
          balances.smartAccount = {
            address: user.smartAccount,
            balance: null,
            error: 'Failed to fetch balance',
            type: 'Smart Account'
          };
        }
      }

      return ApiResponse.success(res, {
        balances,
        network: SmartAccountService.getNetworkInfo()
      });

    } catch (error) {
      console.error('Error getting balances:', error);
      return ApiResponse.serverError(res, 'Failed to retrieve balances');
    }
  }
}

export default WalletController;