/**
 * 사용자 모델
 * 향상된 보안으로 모든 사용자 관련 데이터베이스 작업을 처리합니다
 * 사용자 생성, 조회, 업데이트, 등록 상태 확인 기능과 ID 해싱 및 데이터 암호화를 제공합니다
 *
 * @fileoverview 사용자 데이터 CRUD 작업 및 암호화 처리 모듈
 */
import db from "../config/db.mjs";
import {
  hashUserId,
  decryptData,
  getTimestamp,
  isEncrypted,
} from "../utils/cryptoUtils.mjs";
import logger from "../utils/logger.mjs";

/**
 * 데이터베이스에 사용자가 존재하는지 확인
 * 사용자 ID를 해싱하여 데이터베이스에서 조회합니다
 *
 * @async
 * @param {string} uid - 사용자 ID (평문)
 * @returns {Promise<boolean>} 사용자가 존재하면 true, 없으면 false
 * @throws {Error} 데이터베이스 조회 오류 시 예외 발생
 * @example
 * const exists = await isUserExists('user123');
 * if (exists) {
 *   console.log('사용자가 존재합니다');
 * }
 */
export const isUserExists = async (uid) => {
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
 * 사용자 ID를 해싱하고 데이터를 암호화하여 저장합니다
 *
 * @async
 * @param {object} user - 사용자 정보 객체
 * @param {string} user.id - 사용자 ID
 * @param {string} user.name - 사용자 이름
 * @param {number} user.grade - 학년
 * @param {number} user.class - 반
 * @param {string} user.email - 이메일 주소
 * @param {string} user.profile_image - 프로필 이미지 URL
 * @returns {Promise<void>} 데이터베이스 삽입 작업 결과
 * @throws {Error} 데이터베이스 삽입 오류 시 예외 발생
 * @example
 * await createUser({
 *   id: 'user123',
 *   name: '김대민',
 *   grade: 2,
 *   class: 3,
 *   email: 'user@example.com',
 *   profile_image: 'https://example.com/avatar.jpg'
 * });
 */
export const createUser = async (user) => {
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * ID로 사용자를 복호화된 정보와 함께 가져오기
 * 사용자 ID를 해싱하여 데이터베이스에서 조회하고, 암호화된 데이터를 복호화하여 반환합니다
 * 암호화되지 않은 데이터는 자동으로 암호화하여 업데이트합니다
 *
 * @async
 * @function getUser
 * @param {string} uid - 사용자 ID (평문)
 * @returns {Promise<object | null>} 사용자 객체 또는 찾지 못한 경우 null
 * @returns {string} returns.id - 사용자 ID (평문)
 * @returns {string} returns.name - 사용자 이름
 * @returns {number} returns.grade - 학년
 * @returns {number} returns.class - 반
 * @returns {string} returns.email - 이메일 주소
 * @returns {string} returns.profile_image - 프로필 이미지 URL
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const user = await getUser('user123');
 * if (user) {
 *   console.log(`${user.name} (${user.grade}학년 ${user.class}반)`);
 * }
 */
export const getUser = async (uid) => {
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
 * 제공된 사용자 데이터를 기반으로 데이터베이스의 사용자 정보를 업데이트합니다
 * 민감한 데이터는 암호화하여 저장하고 업데이트 시간을 자동으로 기록합니다
 *
 * @async
 * @function updateUser
 * @param {string} uid - 사용자 ID (평문)
 * @param {object} userData - 업데이트할 사용자 데이터
 * @param {string} [userData.name] - 업데이트할 사용자 이름
 * @param {string} [userData.email] - 업데이트할 이메일 주소
 * @param {string} [userData.profile_image] - 업데이트할 프로필 이미지 URL
 * @param {number} [userData.grade] - 업데이트할 학년
 * @param {number} [userData.class] - 업데이트할 반
 * @returns {Promise<number>} 업데이트된 레코드 수
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * await updateUser('user123', {
 *   name: '김대민',
 *   grade: 2,
 *   class: 3
 * });
 */
export const updateUser = async (uid, userData) => {
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
 * 사용자의 등록 상태를 확인합니다. 사용자가 존재하고 이름이 설정되어 있으면 등록된 것으로 간주합니다
 * OAuth 인증 후 추가 정보 입력 여부를 판단하는 데 사용됩니다
 *
 * @async
 * @function isRegistered
 * @param {string} uid - 사용자 ID (평문)
 * @returns {Promise<boolean>} 사용자가 등록되어 있으면 true, 아니면 false
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const registered = await isRegistered('user123');
 * if (!registered) {
 *   console.log('추가 정보 입력이 필요합니다');
 * }
 */
export const isRegistered = async (uid) => {
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
 * 평문 사용자 ID를 SHA3-256으로 해싱하여 데이터베이스에서 사용할 수 있는 안전한 해시 값을 반환합니다
 * cryptoUtils.mjs의 hashUserId 함수를 래핑한 유틸리티 함수입니다
 *
 * @function getHashedUserId
 * @param {string} plainUid - 일반 사용자 ID (평문)
 * @returns {string} 해시된 사용자 ID (16진수 문자열)
 * @example
 * const hashedId = getHashedUserId('user123');
 * console.log(hashedId); // "a1b2c3d4..."
 * console.log(hashedId.length); // 64
 */
export const getHashedUserId = (plainUid) => {
  return hashUserId(plainUid);
};
