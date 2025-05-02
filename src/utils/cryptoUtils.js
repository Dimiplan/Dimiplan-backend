/**
 * Cryptographic utility functions for secure data storage and retrieval
 * Provides SHA3 hashing and AES encryption/decryption
 */
const crypto = require("crypto");
const { formatDateForMySQL } = require("./dateUtils");

// Master encryption key - in production, should be stored in a secure vault/environment variable
// This is just a placeholder - NEVER hardcode this in actual code
const MASTER_KEY =
  process.env.CRYPTO_MASTER_KEY ||
  "your-secure-master-key-with-at-least-32-chars";
const MASTER_IV = process.env.CRYPTO_MASTER_IV || "your-secure-16-c";

// Salt for user ID hashing - should be a secure random value
const UID_SALT = process.env.UID_SALT || "dimiplan-uid-salt-value";

/**
 * Generate a derived encryption key for a specific user
 * @param {string} userId - Original user ID
 * @returns {Object} - Object containing key and iv for encryption
 */
const getUserEncryptionKey = (userId) => {
  // Create a deterministic but secure key derivation from master key and user ID
  const keyMaterial = crypto
    .createHmac("sha256", MASTER_KEY)
    .update(userId)
    .digest();

  // Use the first 32 bytes for the key
  const key = keyMaterial.slice(0, 32);

  // Generate a deterministic IV for this user
  const iv = crypto
    .createHmac("sha256", MASTER_IV)
    .update(userId)
    .digest()
    .slice(0, 16); // AES requires 16 bytes IV

  return { key, iv };
};

/**
 * Hash a user ID using SHA3
 * @param {string} userId - Original user ID
 * @returns {string} - Hashed user ID
 */
const hashUserId = (userId) => {
  // Add a salt to prevent rainbow table attacks
  return crypto
    .createHash("sha3-256")
    .update(userId + UID_SALT)
    .digest("hex");
};

/**
 * Verify if a plain user ID matches a hashed user ID
 * @param {string} plainUserId - Original user ID
 * @param {string} hashedUserId - Hashed user ID to compare against
 * @returns {boolean} - True if they match
 */
const verifyUserId = (plainUserId, hashedUserId) => {
  const computedHash = hashUserId(plainUserId);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hashedUserId, "hex"),
  );
};

/**
 * Encrypt data for a specific user
 * @param {string} userId - Original user ID (unhashed)
 * @param {string|Object} data - Data to encrypt (objects will be JSON stringified)
 * @returns {string} - Encrypted data as hex string
 */
const encryptData = (userId, data) => {
  try {
    // Prepare data
    const dataStr =
      typeof data === "object" ? JSON.stringify(data) : String(data);

    // Get user-specific encryption key
    const { key, iv } = getUserEncryptionKey(userId);

    // Create cipher and encrypt
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(dataStr, "utf8", "hex");
    encrypted += cipher.final("hex");

    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Decrypt data for a specific user
 * @param {string} userId - Original user ID (unhashed)
 * @param {string} encryptedData - Encrypted data (hex string)
 * @param {boolean} parseJson - Whether to parse result as JSON
 * @returns {string|Object} - Decrypted data
 */
const decryptData = (userId, encryptedData, parseJson = false) => {
  try {
    // Get user-specific encryption key
    const { key, iv } = getUserEncryptionKey(userId);

    // Create decipher and decrypt
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Parse JSON if requested
    return parseJson ? JSON.parse(decrypted) : decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
};

/**
 * Generate a secure random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Get current timestamp in MySQL-compatible format
 * @returns {string} - MySQL compatible timestamp
 */
const getTimestamp = () => {
  return formatDateForMySQL(new Date());
};

module.exports = {
  hashUserId,
  verifyUserId,
  encryptData,
  decryptData,
  generateSecureToken,
  getTimestamp,
};
