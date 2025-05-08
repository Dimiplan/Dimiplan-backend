/**
 * 암호화 유틸리티 함수
 * 보안 데이터 저장 및 검색을 위한 암호화 기능 제공
 * SHA3 해싱 및 AES 암호화/복호화
 */
const crypto = require("crypto");
const { formatDateForMySQL } = require("./dateUtils");
require("../config/dotenv"); // 환경 변수 로드

// 마스터 암호화 키 (프로덕션에서는 안전한 저장소에 보관)
const MASTER_KEY = process.env.CRYPTO_MASTER_KEY;
const MASTER_IV = process.env.CRYPTO_MASTER_IV;

// 사용자 ID 해싱을 위한 솔트
const UID_SALT = process.env.UID_SALT;

/**
 * 특정 사용자를 위한 파생 암호화 키 생성
 * @param {string} userId - 원본 사용자 ID
 * @returns {Object} 암호화에 사용할 키와 초기화 벡터(IV) 포함
 */
const getUserEncryptionKey = (userId) => {
  // 마스터 키와 사용자 ID로부터 결정론적이지만 안전한 키 파생
  const keyMaterial = crypto
    .createHmac("sha256", MASTER_KEY)
    .update(userId)
    .digest();

  // 키의 첫 32바이트 사용
  const key = keyMaterial.slice(0, 32);

  // 사용자별 결정론적 초기화 벡터 생성
  const iv = crypto
    .createHmac("sha256", MASTER_IV)
    .update(userId)
    .digest()
    .slice(0, 16); // AES는 16바이트 IV 필요

  return { key, iv };
};

/**
 * SHA3로 사용자 ID 해시
 * @param {string} userId - 원본 사용자 ID
 * @returns {string} 해시된 사용자 ID
 */
const hashUserId = (userId) => {
  // 레인보우 테이블 공격 방지를 위해 솔트 추가
  return crypto
    .createHash("sha3-256")
    .update(userId + UID_SALT)
    .digest("hex");
};

/**
 * 평문 사용자 ID와 해시된 사용자 ID 일치 여부 확인
 * @param {string} plainUserId - 원본 사용자 ID
 * @param {string} hashedUserId - 비교할 해시된 사용자 ID
 * @returns {boolean} 일치 여부
 */
const verifyUserId = (plainUserId, hashedUserId) => {
  const computedHash = hashUserId(plainUserId);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hashedUserId, "hex"),
  );
};

/**
 * 특정 사용자를 위한 데이터 암호화
 * @param {string} userId - 원본 사용자 ID
 * @param {string|Object} data - 암호화할 데이터 (객체는 JSON 문자열로 변환)
 * @returns {string} 16진수 문자열로 암호화된 데이터
 */
const encryptData = (userId, data) => {
  try {
    // 데이터 준비
    const dataStr =
      typeof data === "object" ? JSON.stringify(data) : String(data);

    // 사용자별 암호화 키 가져오기
    const { key, iv } = getUserEncryptionKey(userId);

    // 암호화 수행
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(dataStr, "utf8", "hex");
    encrypted += cipher.final("hex");

    return encrypted;
  } catch (error) {
    console.error("암호화 중 오류:", error);
    throw new Error("데이터 암호화 실패");
  }
};

/**
 * 특정 사용자의 암호화된 데이터 복호화
 * @param {string} userId - 원본 사용자 ID
 * @param {string} encryptedData - 암호화된 데이터 (16진수 문자열)
 * @param {boolean} parseJson - JSON 파싱 여부
 * @returns {string|Object} 복호화된 데이터
 */
const decryptData = (userId, encryptedData, parseJson = false) => {
  try {
    // 사용자별 암호화 키 가져오기
    const { key, iv } = getUserEncryptionKey(userId);

    // 복호화 수행
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // JSON 파싱 옵션에 따라 반환
    return parseJson ? JSON.parse(decrypted) : decrypted;
  } catch (error) {
    console.error("복호화 중 오류:", error);
    throw new Error("데이터 복호화 실패");
  }
};

/**
 * 주어진 문자열이 암호화된 데이터일 가능성 확인
 * @param {string} data - 확인할 데이터
 * @returns {boolean} 암호화된 데이터로 보이는지 여부
 */
const isEncrypted = (data) => {
  // AES 암호화 데이터의 최소 길이 및 16진수 형식 확인
  return (
    typeof data === "string" && /^[0-9a-f]+$/i.test(data) && data.length >= 32
  );
};

/**
 * 안전한 무작위 문자열 생성
 * @param {number} length - 생성할 문자열 길이
 * @returns {string} 랜덤 문자열
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * MySQL 호환 타임스탬프 생성
 * @returns {string} MySQL 호환 타임스탬프
 */
const getTimestamp = () => {
  return formatDateForMySQL(new Date());
};

module.exports = {
  hashUserId, // 사용자 ID 해시
  verifyUserId, // 사용자 ID 검증
  encryptData, // 데이터 암호화
  decryptData, // 데이터 복호화
  isEncrypted, // 암호화 여부 확인
  generateSecureToken, // 안전한 토큰 생성
  getTimestamp, // 타임스탬프 생성
};
