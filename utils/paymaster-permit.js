import { getContract, encodePacked, keccak256, toHex } from 'viem';
import { erc20Abi } from 'viem';

export async function signPermit({
  tokenAddress,
  account,
  client,
  spenderAddress,
  permitAmount,
  deadline = null
}) {
  try {
    // Default deadline to 1 hour from now if not provided
    const permitDeadline = deadline || BigInt(Math.floor(Date.now() / 1000) + 3600);
    
    // Get token contract
    const tokenContract = getContract({
      address: tokenAddress,
      abi: erc20Abi,
      client
    });

    // Get token name for permit domain
    let tokenName;
    try {
      tokenName = await tokenContract.read.name();
    } catch (error) {
      // Some tokens might not have a name function, use default
      tokenName = 'Token';
    }

    // Get chain ID
    const chainId = BigInt(client.chain.id);

    // Get current nonce for the account
    let nonce;
    try {
      nonce = await tokenContract.read.nonces([account.address]);
    } catch (error) {
      // Some tokens might not have nonces function, use 0
      nonce = 0n;
    }

    // EIP-712 domain separator
    const domain = {
      name: tokenName,
      version: '1',
      chainId: Number(chainId),
      verifyingContract: tokenAddress
    };

    // EIP-712 Permit message types
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    // Permit message
    const message = {
      owner: account.address,
      spender: spenderAddress,
      value: permitAmount,
      nonce: nonce,
      deadline: permitDeadline
    };

    // Sign the permit
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: 'Permit',
      message
    });

    console.log(`Permit signed for ${permitAmount} tokens`);
    console.log(`Signature: ${signature}`);

    // Return the signature with permit parameters encoded
    return encodePacked(
      ['uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
      [
        permitAmount,
        permitDeadline,
        Number(signature.slice(-2)), // v
        signature.slice(0, 66), // r
        '0x' + signature.slice(66, 130) // s
      ]
    );

  } catch (error) {
    console.error('Permit signing failed:', error);
    throw new Error(`Failed to sign permit: ${error.message}`);
  }
}

export async function verifyPermit({
  tokenAddress,
  client,
  owner,
  spender,
  value,
  deadline,
  signature
}) {
  try {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: erc20Abi,
      client
    });
    
    console.log('Permit verification not implemented - use token permit() function');
    return true;

  } catch (error) {
    console.error('Permit verification failed:', error);
    return false;
  }
}

export async function getPermitNonce(tokenAddress, accountAddress, client) {
  try {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: erc20Abi,
      client
    });

    const nonce = await tokenContract.read.nonces([accountAddress]);
    return nonce;

  } catch (error) {
    console.warn('Failed to get permit nonce:', error.message);
    return 0n; // Return 0 if nonces function doesn't exist
  }
}

export async function supportsPermit(tokenAddress, client) {
  try {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: [
        ...erc20Abi,
        {
          name: 'DOMAIN_SEPARATOR',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'bytes32' }]
        }
      ],
      client
    });

    // Check if the token has DOMAIN_SEPARATOR (required for EIP-2612)
    await tokenContract.read.DOMAIN_SEPARATOR();
    return true;

  } catch (error) {
    console.warn(`Token ${tokenAddress} does not support permit:`, error.message);
    return false;
  }
}