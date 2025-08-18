import EncryptionService from '../services/EncryptionService.js';
import SmartAccountService from '../services/SmartAccountService.js';

export async function testEncryptionDecryption() {
  try {
    // Test data
    const testKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
    const password = 'user-strong-password-123!@#';
    const userId = 'user123';

    console.log('=== Starting Encryption/Decryption Test ===');
    console.log('Original Private Key:', testKey);

    // Test 1: Basic encryption/decryption
    console.log('\nTest 1: Basic encryption/decryption');
    const encrypted = await EncryptionService.encryptPrivateKey(testKey, password);
    const decrypted = await EncryptionService.decryptPrivateKey(encrypted, password);
    console.log('Decryption successful:', decrypted === testKey);
    console.log('Decrypted matches original:', decrypted === testKey);

    // Test 2: Master password generation and encryption
    console.log('\nTest 2: Master password workflow');
    const masterPassword = await EncryptionService.generateMasterPassword(password, userId);
    console.log('Master password generated:', masterPassword.length > 0);
    
    const encryptedWithMaster = await EncryptionService.encryptPrivateKey(testKey, masterPassword);
    const decryptedWithMaster = await EncryptionService.decryptPrivateKey(encryptedWithMaster, masterPassword);
    console.log('Decryption with master password successful:', decryptedWithMaster === testKey);

    // Test 3: Split and combine private key
    console.log('\nTest 3: Split and combine private key');
    const { firstHalf, secondHalf } = EncryptionService.splitPrivateKey(testKey);
    const combinedKey = EncryptionService.combinePrivateKey(firstHalf, secondHalf);
    console.log('Key recombination successful:', combinedKey === testKey);

    // Test 4: Error cases
    console.log('\nTest 4: Error handling');
    try {
      await EncryptionService.decryptPrivateKey('invalid-data', password);
      console.log('Error test failed - should have thrown');
    } catch (e) {
      console.log('Invalid data error caught:', e.message.includes('Failed to decrypt'));
    }

    try {
      await EncryptionService.decryptPrivateKey(encrypted, 'wrong-password');
      console.log('Error test failed - should have thrown');
    } catch (e) {
      console.log('Wrong password error caught:', e.message.includes('Failed to decrypt'));
    }

    console.log('\n=== All Tests Completed ===');
    return {
      success: true,
      tests: {
        basicEncryption: decrypted === testKey,
        masterPassword: decryptedWithMaster === testKey,
        keySplitting: combinedKey === testKey
      }
    };
  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}