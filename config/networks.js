import { base, baseSepolia, sepolia, arbitrum, arbitrumSepolia, lisk, liskSepolia } from 'viem/chains';

export const NETWORK_CONFIG = {
  base: {
    chain: base,
    tokens: {
      USDC: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6
      },
      USDT: {
        address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        decimals: 6
      }
    },
    rpcUrl: process.env.BASE_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${base.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.BASE_PAYMASTER_ADDRESS
  },

  arbitrum: {
    chain: arbitrum,
    tokens: {
      USDC: {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6
      },
      USDT: {
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: 6
      }
    },
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${arbitrum.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.ARBITRUM_PAYMASTER_ADDRESS
  },

  lisk: {
    chain: lisk,
    tokens: {
      USDC: {
        address: '0x05D032ac25d322df992303dCa074EE7392C117b9',
        decimals: 6
      },
      USDT: {
        address: '0x05D032ac25d322df992303dCa074EE7392C117b9', // Update with actual USDT address
        decimals: 6
      }
    },
    rpcUrl: process.env.LISK_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${lisk.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.LISK_PAYMASTER_ADDRESS
  },

  sepolia: {
    chain: sepolia,
    tokens: {
      USDC: {
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        decimals: 6
      },
      USDT: {
        address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        decimals: 6
      }
    },
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.SEPOLIA_PAYMASTER_ADDRESS
  },

  baseSepolia: {
    chain: baseSepolia,
    tokens: {
      USDC: {
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        decimals: 6
      },
      USDT: {
        address: '0x4A3A6Dd60A34bB2Aba60D73B4C88315E9CeB6A3D',
        decimals: 6
      }
    },
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.BASE_SEPOLIA_PAYMASTER_ADDRESS
  },

  arbitrumSepolia: {
    chain: arbitrumSepolia,
    tokens: {
      USDC: {
        address: '0x75faf114eafb1BDbe2F0316DF893fd58DCB91E9',
        decimals: 6
      },
      USDT: {
        address: '0xb1f8c5b5b7A0e09de46f0d1B4A0b4E3A3B3f1c4D',
        decimals: 6
      }
    },
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${arbitrumSepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.ARBITRUM_SEPOLIA_PAYMASTER_ADDRESS
  },

  liskSepolia: {
    chain: liskSepolia,
    tokens: {
      USDC: {
        address: '0x70e5a5D5b4B2D0e4Ff83B3E2F84b0f8D5A6A1F2A',
        decimals: 6
      },
      USDT: {
        address: '0x80e5a5D5b4B2D0e4Ff83B3E2F84b0f8D5A6A1F2B',
        decimals: 6
      }
    },
    rpcUrl: process.env.LISK_SEPOLIA_RPC_URL,
    bundlerUrl: `https://api.pimlico.io/v2/${liskSepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    paymasterAddress: process.env.LISK_SEPOLIA_PAYMASTER_ADDRESS
  }
};

export const getCurrentNetworkConfig = () => {
  const defaultNetwork = process.env.NODE_ENV === 'production' ? 'base' : 'baseSepolia';
  const selectedNetwork = process.env.SELECTED_NETWORK || defaultNetwork;
  
  const config = NETWORK_CONFIG[selectedNetwork];
  if (!config) {
    throw new Error(`Unsupported network: ${selectedNetwork}`);
  }
  
  return {
    ...config,
    networkName: selectedNetwork,
    isTestnet: !['base', 'arbitrum', 'lisk'].includes(selectedNetwork)
  };
};

export const getTokenConfig = (networkName, tokenSymbol) => {
  const network = NETWORK_CONFIG[networkName];
  if (!network) {
    throw new Error(`Network ${networkName} not found`);
  }
  
  const token = network.tokens[tokenSymbol.toUpperCase()];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not supported on ${networkName}`);
  }
  
  return token;
};

export const getSupportedTokens = (networkName) => {
  const network = NETWORK_CONFIG[networkName];
  if (!network) {
    throw new Error(`Network ${networkName} not found`);
  }
  
  return Object.keys(network.tokens);
};