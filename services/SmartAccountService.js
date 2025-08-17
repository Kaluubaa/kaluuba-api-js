import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { baseSepolia, base, sepolia, lisk, liskSepolia } from 'viem/chains';
import EncryptionService from './EncryptionService.js';

class SmartAccountService {
  static DEFAULT_CHAIN = sepolia;
  static PRODUCTION_CHAIN = lisk;

  static getChain() {
    return process.env.NODE_ENV === 'production' 
      ? this.PRODUCTION_CHAIN 
      : this.DEFAULT_CHAIN;
  }

  static async createUserWallet(userId, userPassword) {
    try {
      const wallet = ethers.Wallet.createRandom();
      const privateKey = wallet.privateKey;
      const walletAddress = wallet.address;

      if (!EncryptionService.validatePrivateKeyFormat(privateKey)) {
        throw new Error('Generated private key has invalid format');
      }

      const owner = privateKeyToAccount(privateKey);
      
      const chain = this.getChain();
      const client = createPublicClient({ 
        chain, 
        transport: http(process.env.RPC_URL || undefined) 
      });

      const smartAccount = await toCircleSmartAccount({ 
        client, 
        owner 
      });

      const smartAccountAddress = smartAccount.address;

      const masterPassword = await EncryptionService.generateMasterPassword(
        userPassword, 
        userId
      );

      const encryptedPrivateKey = await EncryptionService.encryptPrivateKey(
        privateKey, 
        masterPassword
      );

      console.log(`Created wallet for user ${userId}:`);
      console.log(`- Wallet Address: ${walletAddress}`);
      console.log(`- Smart Account Address: ${smartAccountAddress}`);
      console.log(`- Chain: ${chain.name} (ID: ${chain.id})`);

      return {
        success: true,
        walletData: {
          walletAddress,
          smartAccount,
          smartAccountAddress,
          encryptedPrivateKey,
          chainId: chain.id,
          chainName: chain.name
        }
      };

    } catch (error) {
      console.error('Error creating user wallet:', error);
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  static async decryptUserPrivateKey(encryptedPrivateKey, userId, userPassword) {
    try {
      const masterPassword = await EncryptionService.generateMasterPassword(
        userPassword, 
        userId
      );

      const decryptedPrivateKey = await EncryptionService.decryptPrivateKey(
        encryptedPrivateKey, 
        masterPassword
      );

      if (!EncryptionService.validatePrivateKeyFormat(decryptedPrivateKey)) {
        throw new Error('Decrypted private key has invalid format');
      }

      return decryptedPrivateKey;

    } catch (error) {
      console.error('Error decrypting private key:', error);
      throw new Error('Failed to decrypt private key. Invalid password or corrupted data.');
    }
  }

  /**
   * Create a wallet instance from encrypted private key
   * @param {string} encryptedPrivateKey - Encrypted private key
   * @param {string} userId - User ID
   * @param {string} userPassword - User's password
   * @returns {Promise<object>} Ethers wallet and viem account
   */
  static async createWalletFromEncrypted(encryptedPrivateKey, userId, userPassword) {
    try {
      // Decrypt private key
      const privateKey = await this.decryptUserPrivateKey(
        encryptedPrivateKey, 
        userId, 
        userPassword
      );

      // Create ethers wallet
      const wallet = new ethers.Wallet(privateKey);
      
      // Create viem account
      const viemAccount = privateKeyToAccount(privateKey);

      return {
        success: true,
        wallet,
        viemAccount,
        address: wallet.address
      };

    } catch (error) {
      console.error('Error creating wallet from encrypted key:', error);
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  /**
   * Recreate smart account from user's encrypted private key
   * @param {string} encryptedPrivateKey - Encrypted private key
   * @param {string} userId - User ID
   * @param {string} userPassword - User's password
   * @returns {Promise<object>} Smart account instance
   */
  static async recreateSmartAccount(encryptedPrivateKey, userId, userPassword) {
    try {
      const { viemAccount } = await this.createWalletFromEncrypted(
        encryptedPrivateKey, 
        userId, 
        userPassword
      );

      const chain = this.getChain();
      const client = createPublicClient({ 
        chain, 
        transport: http(process.env.RPC_URL || undefined) 
      });

      const smartAccount = await toCircleSmartAccount({ 
        client, 
        owner: viemAccount 
      });

      return {
        success: true,
        smartAccount,
        address: smartAccount.address,
        client
      };

    } catch (error) {
      console.error('Error recreating smart account:', error);
      throw new Error(`Failed to recreate smart account: ${error.message}`);
    }
  }

  /**
   * Update user's private key encryption (e.g., when password changes)
   * @param {string} oldEncryptedKey - Current encrypted private key
   * @param {string} userId - User ID
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<string>} New encrypted private key
   */
  static async reencryptPrivateKey(oldEncryptedKey, userId, oldPassword, newPassword) {
    try {
      const privateKey = await this.decryptUserPrivateKey(
        oldEncryptedKey, 
        userId, 
        oldPassword
      );

      const newMasterPassword = await EncryptionService.generateMasterPassword(
        newPassword, 
        userId
      );

      const newEncryptedKey = await EncryptionService.encryptPrivateKey(
        privateKey, 
        newMasterPassword
      );

      return newEncryptedKey;

    } catch (error) {
      console.error('Error re-encrypting private key:', error);
      throw new Error('Failed to update private key encryption');
    }
  }

  /**
   * Validate wallet addresses match expected format
   * @param {string} walletAddress - Wallet address to validate
   * @param {string} smartAccountAddress - Smart account address to validate
   * @returns {boolean} True if both addresses are valid
   */
  static validateAddresses(walletAddress, smartAccountAddress) {
    const addressRegex = /^0x[0-9a-fA-F]{40}$/;
    
    return (
      addressRegex.test(walletAddress) && 
      addressRegex.test(smartAccountAddress)
    );
  }

  /**
   * Get wallet balance (ETH)
   * @param {string} address - Wallet address
   * @returns {Promise<string>} Balance in ETH
   */
  static async getWalletBalance(address) {
    try {
      const chain = this.getChain();
      const client = createPublicClient({ 
        chain, 
        transport: http(process.env.RPC_URL || undefined) 
      });

      const balance = await client.getBalance({ address });
      return ethers.formatEther(balance.toString());

    } catch (error) {
      console.error('Error getting wallet balance:', error);
      throw new Error('Failed to retrieve wallet balance');
    }
  }

  /**
   * Get network information
   * @returns {object} Current network information
   */
  static getNetworkInfo() {
    const chain = this.getChain();
    return {
      chainId: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      blockExplorers: chain.blockExplorers,
      rpcUrls: chain.rpcUrls,
      testnet: chain.testnet || false
    };
  }
}

export default SmartAccountService;