/**
 * 사용자 모델
 * 향상된 보안으로 모든 사용자 관련 데이터베이스 작업을 처리합니다
 */
const db = require("../config/db");
const {
  hashUserId,
  decryptData,
  getTimestamp,
  isEncrypted,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * 데이터베이스에 사용자가 존재하는지 확인
 * @param {string} uid - 사용자 ID
 * @returns {Promise<boolean>} - 사용자가 존재하면 true
 */
const isUserExists = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const count = await db("users").where("id", hashedUid).count("* as count");
    return parseInt(count[0].count, 10) > 0;
  } catch (error) {
    logger.error("사용자 존재 여부 확인 오류:", error);
    throw error;
  }
};

/**
 * 사용자가 아직 존재하지 않는 경우 데이터베이스에 새 사용자 생성
 * @param {Object} user - id, name, grade, class, email, profile_image를 가진 사용자 객체
 * @returns {Promise} - 데이터베이스 작업 결과
 */
const createUser = async (user) => {
  try {
    if (!(await isUserExists(user.id))) {
      // 민감한 사용자 데이터 암호화
      const hashedUid = hashUserId(user.id);
      const encryptedUser = {
        id: hashedUid,
        name: user.name,
        grade: user.grade,
        class: user.class,
        email: user.email,
        profile_image: user.profile_image,
      };

      // 감사 메타데이터 추가 (MySQL 호환 형식)
      const timestamp = getTimestamp();
      encryptedUser.created_at = timestamp;
      encryptedUser.updated_at = timestamp;

      await db("users").insert(encryptedUser);

      // 새 사용자를 위한 userId 테이블 초기화
      await db("userid").insert({
        owner: hashedUid,
        plannerId: 1,
        planId: 1,
        roomId: 1,
        chatId: 1,
        created_at: timestamp,
      });

      // 사용자 생성 로깅 (민감한 데이터 제외)
      logger.info(`사용자 생성됨: ${hashedUid.substring(0, 8)}...`);
    }
  } catch (error) {
    logger.error("사용자 생성 오류:", error);
    throw error;
  }
};

/**
 * ID로 사용자를 복호화된 정보와 함께 가져오기
 * @param {string} uid - 사용자 ID
 * @returns {Promise<Object|null>} - 사용자 객체 또는 찾지 못한 경우 null
 */
const getUser = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const users = await db("users").where("id", hashedUid).select("*");

    if (!users[0]) return null;

    let user = users[0];

    user.name = isEncrypted(user.name)
        ? decryptData(uid, user.name)
        : user.name;
    user.email = isEncrypted(user.email)
        ? decryptData(uid, user.email)
        : user.email;
    user.profile_image = isEncrypted(user.profile_image)
        ? decryptData(uid, user.profile_image)
        : user.profile_image;

    if (user != users[0]) {
      updateUser(uid, user);
    }

    return {
      id: uid, // 세션 사용을 위해 원본 ID 반환
      name: user.name,
      grade: user.grade,
      class: user.class,
      email: user.email,
      profile_image: user.profile_image,
    };
  } catch (error) {
    logger.error("사용자 가져오기 오류:", error);
    throw error;
  }
};

/**
 * 사용자 정보 업데이트
 * @param {string} uid - 사용자 ID
 * @param {Object} userData - 업데이트할 사용자 데이터
 * @returns {Promise} - 데이터베이스 작업 결과
 */
const updateUser = async (uid, userData) => {
  try {
    const hashedUid = hashUserId(uid);

    // 저장 전 데이터 암호화
    const encryptedData = {};

    if (userData.name !== undefined) {
      encryptedData.name = userData.name;
    }

    if (userData.email !== undefined) {
      encryptedData.email = userData.email;
    }

    if (userData.profile_image !== undefined) {
      encryptedData.profile_image = userData.profile_image;
    }

    if (userData.grade !== undefined) {
      encryptedData.grade = userData.grade;
    }

    if (userData.class !== undefined) {
      encryptedData.class = userData.class;
    }

    // 업데이트 타임스탬프 추가 (MySQL 호환 형식)
    encryptedData.updated_at = getTimestamp();

    return await db("users").where("id", hashedUid).update(encryptedData);
  } catch (error) {
    logger.error("사용자 업데이트 오류:", error);
    throw error;
  }
};

/**
 * 사용자가 등록되어 있는지 확인 (이름이 설정되어 있는지)
 * @param {string} uid - 사용자 ID
 * @returns {Promise<boolean>} - 사용자가 등록되어 있으면 true
 */
const isRegistered = async (uid) => {
  try {
    const user = await getUser(uid);
    return user !== null && user.name !== null;
  } catch (error) {
    logger.error("사용자 등록 여부 확인 오류:", error);
    throw error;
  }
};

/**
 * 일반 사용자 ID에서 해시된 사용자 ID 가져오기
 * @param {string} plainUid - 일반 사용자 ID
 * @returns {string} - 해시된 사용자 ID
 */
const getHashedUserId = (plainUid) => {
  return hashUserId(plainUid);
};

module.exports = {
  isUserExists,
  createUser,
  getUser,
  updateUser,
  isRegistered,
  getHashedUserId,
};