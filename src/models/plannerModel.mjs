/**
 * 플래너 모델
 * 암호화와 함께 모든 플래너 관련 데이터베이스 작업을 처리합니다
 */
import db from "../config/db.mjs";
import { getNextId, executeTransaction } from "../utils/dbUtils.mjs";
import {hashUserId, encryptData, decryptData, getTimestamp,} from "../utils/cryptoUtils.mjs";
import logger from "../utils/logger.mjs";

/**
 * 새 플래너 생성
 * @param {string} uid - 사용자 ID
 * @param {string} name - 플래너 이름
 * @param {number} isDaily - 일일 플래너 여부 (0 또는 1)
 * @returns {Promise<Object>} - 생성된 플래너 데이터
 */
export const createPlanner = async (uid, name, isDaily) => {
  try {
    // 데이터베이스 쿼리를 위해 사용자 ID 해시
    const hashedUid = hashUserId(uid);

    // 같은 이름의 플래너가 있는지 확인
    const existingPlanner = await db("planner")
      .where({
        owner: hashedUid,
        name: encryptData(uid, name), // 암호화된 이름 확인
      })
      .first();

    if (existingPlanner) {
      throw new Error("같은 이름의 플래너가 이미 존재합니다");
    }

    // 다음 플래너 ID 가져오기
    const plannerId = await getNextId(hashedUid, "plannerId");

    // 암호화된 이름으로 플래너 생성
    await db("planner").insert({
      owner: hashedUid,
      name: encryptData(uid, name),
      id: plannerId,
      isDaily: isDaily ?? 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    });

    return {
      owner: uid, // 애플리케이션 로직을 위해 원본 사용자 ID 반환
      name: name, // 복호화된 이름 반환
      id: plannerId,
      isDaily: isDaily ?? 0,
    };
  } catch (error) {
    logger.error("플래너 생성 오류:", error);
    throw error;
  }
};

/**
 * ID로 플래너 가져오기
 * @param {string} uid - 사용자 ID
 * @param {number} id - 플래너 ID
 * @returns {Promise<Object|null>} - 플래너 데이터 또는 찾지 못한 경우 null
 */
export const getPlannerById = async (uid, id) => {
  try {
    // 데이터베이스 쿼리를 위해 사용자 ID 해시
    const hashedUid = hashUserId(uid);

    // 암호화된 플래너 데이터 가져오기
    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      return null;
    }

    // 이름 필드 복호화
    return {
      ...planner,
      owner: uid, // 애플리케이션 로직을 위해 원본 ID 반환
      name: decryptData(uid, planner.name),
    };
  } catch (error) {
    logger.error("ID로 플래너 가져오기 오류:", error);
    throw error;
  }
};

/**
 * 모든 플래너 가져오기
 * @param {string} uid - 사용자 ID
 * @returns {Promise<Array>} - 플래너 객체 배열
 */
export const getPlanners = async (uid) => {
  try {
    // 데이터베이스 쿼리를 위해 사용자 ID 해시
    const hashedUid = hashUserId(uid);

    // 암호화된 플래너 데이터 가져오기
    const planners = await db("planner")
      .where({ owner: hashedUid })
      .orderByRaw("isDaily ASC, id ASC");

    // 결과에서 이름 복호화
    return planners.map((planner) => ({
      ...planner,
      owner: uid, // 애플리케이션 로직을 위해 원본 사용자 ID 반환
      name: decryptData(uid, planner.name),
    }));
  } catch (error) {
    logger.error("플래너 가져오기 오류:", error);
    throw error;
  }
};

/**
 * 플래너 이름 변경
 * @param {string} uid - 사용자 ID
 * @param {number} id - 플래너 ID
 * @param {string} newName - 새 플래너 이름
 * @returns {Promise<Object>} - 업데이트된 플래너 데이터
 */
export const renamePlanner = async (uid, id, newName) => {
  try {
    // 데이터베이스 쿼리를 위해 사용자 ID 해시
    const hashedUid = hashUserId(uid);

    // 플래너 가져오기
    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      throw new Error("플래너를 찾을 수 없습니다");
    }

    // 새 이름이 기존 플래너와 충돌하는지 확인
    const existingPlanner = await db("planner")
      .where({
        owner: hashedUid,
        name: encryptData(uid, newName),
      })
      .whereNot({ id: id })
      .first();

    if (existingPlanner) {
      throw new Error("같은 이름의 플래너가 이미 존재합니다");
    }

    // 암호화된 이름으로 업데이트
    await db("planner")
      .where({ owner: hashedUid, id: id })
      .update({
        name: encryptData(uid, newName),
        updated_at: getTimestamp(),
      });

    // 복호화된 이름으로 업데이트된 플래너 반환
    return {
      ...planner,
      owner: uid, // 애플리케이션 로직을 위한 원본 사용자 ID
      name: newName, // 복호화된 이름
    };
  } catch (error) {
    logger.error("플래너 이름 변경 오류:", error);
    throw error;
  }
};

/**
 * 플래너와 그 안의 모든 계획 삭제
 * @param {string} uid - 사용자 ID
 * @param {number} id - 플래너 ID
 * @returns {Promise<boolean>} - 성공 상태
 */
export const deletePlanner = async (uid, id) => {
  try {
    // 데이터베이스 작업을 위해 사용자 ID 해시
    const hashedUid = hashUserId(uid);

    // 플래너가 존재하는지 확인
    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      throw new Error("플래너를 찾을 수 없습니다");
    }

    // 모든 작업이 함께 성공 또는 실패하도록 트랜잭션 사용
    await executeTransaction(async (trx) => {
      // 플래너 내의 모든 계획 삭제
      await trx("plan").where({ owner: hashedUid, from: id }).del();

      // 플래너 삭제
      await trx("planner").where({ owner: hashedUid, id: id }).del();
    });

    logger.info(
      `플래너 삭제됨: ID ${id}, 사용자 ${hashedUid.substring(0, 8)}...`,
    );
    return true;
  } catch (error) {
    logger.error("플래너 삭제 오류:", error);
    throw error;
  }
};
