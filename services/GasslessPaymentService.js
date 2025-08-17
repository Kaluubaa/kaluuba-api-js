// services/GaslessPaymentService.js
import { createPublicClient, http, getContract, encodePacked, hexToBigInt } from 'viem';
import { erc20Abi } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core';
import { getCurrentNetworkConfig, getTokenConfig } from '../config/networks.js';
import { signPermit } from '../utils/paymaster-permit.js';
import SmartAccountService from './SmartAccountService.js';
import { ethers } from 'ethers';
import { error } from 'console';

class GaslessPaymentService {
  constructor() {
    this.networkConfig = getCurrentNetworkConfig();
    this.chain = this.networkConfig.chain;
    this.supportedTokens = this.networkConfig.tokens;
  }

  async checkTokenBalance(userAddress, tokenSymbol) {
    try {
      const tokenConfig = getTokenConfig(this.networkConfig.networkName, tokenSymbol);
      
      const client = createPublicClient({
        chain: this.chain,
        transport: http(this.networkConfig.rpcUrl)
      });

      const tokenContract = getContract({
        client,
        address: tokenConfig.address,
        abi: erc20Abi
      });

      const balance = await tokenContract.read.balanceOf([userAddress]);
      
      return {
        raw: balance.toString(),
        formatted: ethers.formatUnits(balance.toString(), tokenConfig.decimals),
        decimals: tokenConfig.decimals,
        symbol: tokenSymbol.toUpperCase()
      };
    } catch (error) {
      throw new Error(`Failed to check ${tokenSymbol} balance: ${error.message}`);
    }
  }

  async executeGaslessTransaction({
    encryptedPrivateKey,
    userId,
    userPassword,
    recipientAddress,
    tokenSymbol,
    amount, // Amount in human readable format (e.g., "100.50")
    description = null
  }) {
    try {
      const account = await SmartAccountService.recreateSmartAccount(
        encryptedPrivateKey,
        userId,
        userPassword
      );

      // Get token configuration
      const tokenConfig = getTokenConfig(this.networkConfig.networkName, tokenSymbol);
      
      // Convert amount to wei/smallest unit
      const amountInWei = ethers.parseUnits(amount.toString(), tokenConfig.decimals);

      const client = createPublicClient({
        chain: this.chain,
        transport: http(this.networkConfig.rpcUrl)
      });

      console.log(`Smart account address: ${account.address}`);

      const balance = await this.checkTokenBalance(account.address, tokenSymbol);
      const balanceInWei = ethers.parseUnits(balance.formatted, tokenConfig.decimals);
      
      if (balanceInWei < amountInWei) {
        throw new Error(`Insufficient ${tokenSymbol} balance. Required: ${amount}, Available: ${balance.formatted}`);
      }
      const paymaster = await this.createPaymaster(account, client, tokenConfig);

      const bundlerClient = createBundlerClient({
        account,
        client,
        paymaster,
        userOperation: {
          estimateFeesPerGas: async () => {
            try {
              const { standard: fees } = await bundlerClient.request({
                method: "pimlico_getUserOperationGasPrice",
              });
              return {
                maxFeePerGas: hexToBigInt(fees.maxFeePerGas),
                maxPriorityFeePerGas: hexToBigInt(fees.maxPriorityFeePerGas),
              };
            } catch (error) {
              return {
                maxFeePerGas: hexToBigInt('0x5F5E100'), // 100 gwei
                maxPriorityFeePerGas: hexToBigInt('0x3B9ACA00'), // 1 gwei
              };
            }
          },
        },
        transport: http(this.networkConfig.bundlerUrl),
      });

      const userOpHash = await bundlerClient.sendUserOperation({
        account,
        calls: [{
          to: tokenConfig.address,
          abi: erc20Abi,
          functionName: "transfer",
          args: [recipientAddress, amountInWei],
        }],
      });

      console.log(`User operation hash: ${userOpHash}`);

      const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: userOpHash 
      });

      return {
        success: true,
        transactionHash: receipt.receipt.transactionHash,
        userOpHash: userOpHash,
        blockNumber: receipt.receipt.blockNumber.toString(),
        gasUsed: receipt.receipt.gasUsed.toString(),
        from: account.address,
        to: recipientAddress,
        amount: amount.toString(),
        tokenSymbol: tokenSymbol.toUpperCase(),
        tokenAddress: tokenConfig.address,
        gasless: true,
        networkName: this.networkConfig.networkName,
        chainId: this.chain.id
      };

    } catch (error) {
      console.error("Gasless transaction failed:", error);
      return {
        success: false,
        error: error.message,
        gasless: true,
        networkName: this.networkConfig.networkName,
        chainId: this.chain.id
      };
    }
  }

  async createPaymaster(account, client, tokenConfig) {
    const paymasterAddress = this.networkConfig.paymasterAddress;
    
    if (!paymasterAddress) {
      throw new Error(`Paymaster address not configured for ${this.networkConfig.networkName}`);
    }

    return {
      async getPaymasterData() {
        try {
          const permitAmount = ethers.parseUnits("10", tokenConfig.decimals); // 10 tokens for gas
          
          const permitSignature = await signPermit({
            tokenAddress: tokenConfig.address,
            account,
            client,
            spenderAddress: paymasterAddress,
            permitAmount,
          });

          return {
            paymaster: paymasterAddress,
            paymasterData: encodePacked(
              ["uint8", "address", "uint256", "bytes"],
              [0, tokenConfig.address, permitAmount, permitSignature]
            ),
            paymasterVerificationGasLimit: 200000n,
            paymasterPostOpGasLimit: 15000n,
            isFinal: true,
          };
        } catch (error) {
          console.error('Paymaster data creation failed:', error);
          throw new Error(`Paymaster setup failed: ${error.message}`);
        }
      },
    };
  }

  async estimateTransactionFees(tokenSymbol, amount) {
    try {
      const tokenConfig = getTokenConfig(this.networkConfig.networkName, tokenSymbol);
      
      return {
        networkFee: {
          amount: "0",
          symbol: "ETH",
          usd: "0.00",
          description: "Gas fees covered by paymaster"
        },
        platformFee: {
          amount: (parseFloat(amount) * 0.01).toFixed(6), // 1% platform fee
          symbol: tokenSymbol.toUpperCase(),
          percentage: "1.0%"
        },
        totalCost: "0.00", // User pays $0 in gas
        estimatedTime: "30-90 seconds",
        gasless: true,
        network: this.networkConfig.networkName,
        chainId: this.chain.id
      };
    } catch (error) {
      throw new Error(`Fee estimation failed: ${error.message}`);
    }
  }

  async getAllTokenBalances(userAddress) {
    try {
      const balances = [];
      
      for (const [symbol, config] of Object.entries(this.supportedTokens)) {
        try {
          const balance = await this.checkTokenBalance(userAddress, symbol);
          balances.push({
            ...balance,
            tokenAddress: config.address,
            network: this.networkConfig.networkName
          });
        } catch (error) {
          console.warn(`Failed to fetch ${symbol} balance:`, error.message);
          balances.push({
            raw: "0",
            formatted: "0",
            decimals: config.decimals,
            symbol: symbol,
            tokenAddress: config.address,
            network: this.networkConfig.networkName,
            error: error.message
          });
        }
      }
      
      return balances;
    } catch (error) {
      throw new Error(`Failed to fetch token balances: ${error.message}`);
    }
  }

  validateTransactionParams({
    recipientAddress,
    tokenSymbol,
    amount,
    encryptedPrivateKey,
    userId
  }) {
    const errors = [];

    // Validate recipient address
    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      errors.push('Invalid recipient address');
    }

    // Validate token symbol
    if (!tokenSymbol || !this.supportedTokens[tokenSymbol.toUpperCase()]) {
      errors.push(`Unsupported token: ${tokenSymbol}`);
    }

    // Validate amount
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      errors.push('Invalid amount');
    }

    // Validate required fields
    if (!encryptedPrivateKey || !userId) {
      errors.push('Missing required authentication data');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  getNetworkInfo() {
    return {
      networkName: this.networkConfig.networkName,
      chainId: this.chain.id,
      chainName: this.chain.name,
      isTestnet: this.networkConfig.isTestnet,
      supportedTokens: Object.keys(this.supportedTokens),
      rpcUrl: this.networkConfig.rpcUrl,
      blockExplorer: this.chain.blockExplorers?.default?.url
    };
  }
}

export default GaslessPaymentService;