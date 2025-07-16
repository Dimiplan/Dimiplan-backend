import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { formatDateForMySQL } from "./date.mjs";
import "../config/dotenv.mjs";

const MASTER_KEY = process.env.CRYPTO_MASTER_KEY;
const MASTER_IV = process.env.CRYPTO_MASTER_IV;

const UID_SALT = process.env.UID_SALT;

const getUserEncryptionKey = (userId) => {
  const keyMaterial = createHmac("sha256", MASTER_KEY).update(userId).digest();
  const key = keyMaterial.slice(0, 32);
  const iv = createHmac("sha256", MASTER_IV)
    .update(userId)
    .digest()
    .slice(0, 16);
  return { key, iv };
};

export const hashUserId = (userId) => {
  return createHash("sha3-256")
    .update(userId + UID_SALT)
    .digest("hex");
};

export const verifyUserId = (plainUserId, hashedUserId) => {
  const computedHash = hashUserId(plainUserId);
  return timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hashedUserId, "hex"),
  );
};

export const encryptData = (userId, data) => {
  try {
    const dataStr =
      typeof data === "object" ? JSON.stringify(data) : String(data);

    const { key, iv } = getUserEncryptionKey(userId);

    const cipher = createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(dataStr, "utf8", "hex");
    encrypted += cipher.final("hex");

    return encrypted;
  } catch (error) {
    console.error("암호화 중 오류:", error);
    throw new Error("데이터 암호화 실패");
  }
};

export const decryptData = (userId, encryptedData, parseJson = false) => {
  try {
    const { key, iv } = getUserEncryptionKey(userId);

    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return parseJson ? JSON.parse(decrypted) : decrypted;
  } catch (error) {
    console.error("복호화 중 오류:", error);
    throw new Error("데이터 복호화 실패");
  }
};

export const isEncrypted = (data) => {
  return typeof data === "string" && /^[0-9a-f]+$/i.test(data);
};

export const generateSecureToken = (length = 32) => {
  return randomBytes(length).toString("hex");
};

export const getTimestamp = () => {
  return formatDateForMySQL(new Date());
};
