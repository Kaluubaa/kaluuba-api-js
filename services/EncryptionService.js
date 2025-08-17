import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

class EncryptionService {
  static ALGORITHM = 'aes-256-gcm';
  static KEY_LENGTH = 32; // 256 bits
  static IV_LENGTH = 16; // 128 bits
  static SALT_LENGTH = 32; // 256 bits
  static TAG_LENGTH = 16; // 128 bits

  static generateSalt() {
    return crypto.randomBytes(this.SALT_LENGTH);
  }

  static generateIV() {
    return crypto.randomBytes(this.IV_LENGTH);
  }

  /**
   * Derive a key from password using scrypt
   * @param {string} password - The password to derive key from
   * @param {Buffer} salt - The salt for key derivation
   * @returns {Promise<Buffer>} The derived key
   */
  static async deriveKey(password, salt) {
    try {
      const key = await scrypt(password, salt, this.KEY_LENGTH);
      return key;
    } catch (error) {
      console.error('Error deriving key:', error);
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypt private key using AES-256-GCM with scrypt-derived key
   * @param {string} privateKey - The private key to encrypt
   * @param {string} password - The password for encryption (user's master password)
   * @returns {Promise<string>} Base64 encoded encrypted data with salt, iv, and tag
   */
  static async encryptPrivateKey(privateKey, password) {
    try {
      if (!privateKey || !password) {
        throw new Error('Private key and password are required');
      }

      // Generate salt and IV
      const salt = this.generateSalt();
      const iv = this.generateIV();

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('privatekey'));

      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get the authentication tag
      const tag = cipher.getAuthTag();

      // Combine salt, iv, tag, and encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        encrypted
      ]);

      return combined.toString('base64');
    } catch (error) {
      console.error('Error encrypting private key:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt private key using AES-256-GCM with scrypt-derived key
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} password - The password for decryption
   * @returns {Promise<string>} The decrypted private key
   */
static async decryptPrivateKey(encryptedData, password) {
    try {
      if (!encryptedData || !password) {
        throw new Error('Encrypted data and password are required');
      }

      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Verify minimum length
      const minLength = this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH;
      if (combined.length < minLength) {
        throw new Error('Invalid encrypted data format');
      }

      // Extract components
      let position = 0;
      const salt = combined.slice(position, position + this.SALT_LENGTH);
      position += this.SALT_LENGTH;
      
      const iv = combined.slice(position, position + this.IV_LENGTH);
      position += this.IV_LENGTH;
      
      const tag = combined.slice(position, position + this.TAG_LENGTH);
      position += this.TAG_LENGTH;
      
      const encrypted = combined.slice(position);

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from('privatekey'));

      // Decrypt
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Error decrypting private key:', error);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Generate a secure master password for encryption
   * This could be derived from user's password + additional entropy
   * @param {string} userPassword - User's login password
   * @param {string} userId - User's ID for additional entropy
   * @returns {Promise<string>} Master password for encryption
   */
static async generateMasterPassword(userPassword, userId) {
    try {
      // Combine user password with user ID for additional entropy
      const combined = `${userPassword}:${userId}:${process.env.ENCRYPTION_SECRET || ''}`;
      
      // Use PBKDF2 to derive a consistent master password
      const masterPassword = crypto.pbkdf2Sync(
        combined, 
        'encryption-salt', 
        100000, 
        32, 
        'sha256'
      );
      
      // Return as base64 string instead of hex
      return masterPassword.toString('base64');
    } catch (error) {
      console.error('Error generating master password:', error);
      throw new Error('Failed to generate master password');
    }
  }

  /**
   * Validate private key format (basic validation)
   * @param {string} privateKey - Private key to validate
   * @returns {boolean} True if valid format
   */
  static validatePrivateKeyFormat(privateKey) {
    if (!privateKey) return false;
    
    // Remove 0x prefix if present
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Check if it's 64 hex characters (32 bytes)
    return /^[0-9a-fA-F]{64}$/.test(cleanKey);
  }

  /**
   * Split private key for additional security layer (your existing approach)
   * @param {string} privateKey - Private key to split
   * @returns {object} Object containing first and second half
   */
  static splitPrivateKey(privateKey) {
    if (!this.validatePrivateKeyFormat(privateKey)) {
      throw new Error('Invalid private key format');
    }

    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    const midpoint = Math.floor(cleanKey.length / 2);
    
    return {
      firstHalf: cleanKey.slice(0, midpoint),
      secondHalf: cleanKey.slice(midpoint)
    };
  }

  /**
   * Combine split private key
   * @param {string} firstHalf - First half of private key
   * @param {string} secondHalf - Second half of private key
   * @returns {string} Complete private key with 0x prefix
   */
  static combinePrivateKey(firstHalf, secondHalf) {
    const combined = `${firstHalf}${secondHalf}`;
    
    if (!this.validatePrivateKeyFormat(combined)) {
      throw new Error('Invalid combined private key format');
    }
    
    return `0x${combined}`;
  }
}

export default EncryptionService;