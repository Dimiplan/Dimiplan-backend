/**
 * 플래너 모델
 * 암호화와 함께 모든 플래너 관련 데이터베이스 작업을 처리합니다
 * 플래너 생성, 조회, 수정, 삭제 기능과 이름 암호화/복호화를 제공합니다
 *
 * @fileoverview 플래너 관리 시스템의 데이터 모델 모듈
 */
import db from "../config/db.mjs";
import { getNextId, executeTransaction } from "../utils/db.mjs";
import {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} from "../utils/crypto.mjs";
import logger from "../utils/logger.mjs";

// eslint-disable-next-line jsdoc/require-returns
/**
 * 새 플래너 생성
 * 사용자별로 고유한 플래너 ID를 발급하고 이름을 암호화하여 새 플래너를 생성합니다
 * 같은 이름의 플래너가 이미 존재하는 경우 오류를 발생시킵니다
 *
 * @async
 * @function createPlanner
 * @param {string} uid - 사용자 ID (평문)
 * @param {string} name - 플래너 이름
 * @param {number} [isDaily=0] - 일일 플래너 여부 (0: 일반, 1: 일일)
 * @returns {Promise<object>} 생성된 플래너 데이터
 * @returns {string} returns.owner - 사용자 ID (평문)
 * @returns {string} returns.name - 플래너 이름 (평문)
 * @returns {number} returns.id - 플래너 ID
 * @returns {number} returns.isDaily - 일일 플래너 여부
 * @throws {Error} 같은 이름의 플래너가 존재하거나 데이터베이스 오류 시 예외 발생
 * @example
 * const newPlanner = await createPlanner('user123', '일정 관리', 1);
 * console.log(newPlanner.id); // 1, 2, 3, ...
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * ID로 플래너 가져오기
 * 지정된 ID의 플래너를 데이터베이스에서 조회하고 암호화된 이름을 복호화하여 반환합니다
 * 플래너가 존재하지 않으면 null을 반환합니다
 *
 * @async
 * @function getPlannerById
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 플래너 ID
 * @returns {Promise<object | null>} 플래너 데이터 또는 찾지 못한 경우 null
 * @returns {string} returns.owner - 사용자 ID (평문)
 * @returns {string} returns.name - 플래너 이름 (복호화된 평문)
 * @returns {number} returns.id - 플래너 ID
 * @returns {number} returns.isDaily - 일일 플래너 여부
 * @returns {string} returns.created_at - 생성 일시
 * @returns {string} returns.updated_at - 수정 일시
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const planner = await getPlannerById('user123', 1);
 * if (planner) {
 *   console.log(planner.name); // '복호화된 플래너 이름'
 * }
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * 모든 플래너 가져오기
 * 사용자의 모든 플래너를 데이터베이스에서 조회하고 암호화된 이름을 복호화하여 반환합니다
 * 일일 플래너를 먼저, 다음에 ID 순으로 정렬되어 반환됩니다
 *
 * @async
 * @function getPlanners
 * @param {string} uid - 사용자 ID (평문)
 * @returns {Promise<Array<object>>} 플래너 객체 배열
 * @returns {string} returns[].owner - 사용자 ID (평문)
 * @returns {string} returns[].name - 플래너 이름 (복호화된 평문)
 * @returns {number} returns[].id - 플래너 ID
 * @returns {number} returns[].isDaily - 일일 플래너 여부
 * @returns {string} returns[].created_at - 생성 일시
 * @returns {string} returns[].updated_at - 수정 일시
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const planners = await getPlanners('user123');
 * planners.forEach(p => console.log(`${p.name} (${p.isDaily ? '일일' : '일반'})`));
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * 플래너 이름 변경
 * 지정된 플래너가 존재하는지 확인하고, 새 이름이 기존 플래너와 충돌하지 않는지 검사합니다
 * 새 이름을 암호화하여 데이터베이스에 업데이트하고 평문 데이터를 반환합니다
 *
 * @async
 * @function renamePlanner
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 플래너 ID
 * @param {string} newName - 새 플래너 이름
 * @returns {Promise<object>}ßß 업데이트된 플래너 데이터
 * @returns {string} returns.owner - 사용자 ID (평문)
 * @returns {string} returns.name - 새 플래너 이름 (평문)
 * @returns {number} returns.id - 플래너 ID
 * @throws {Error} 플래너를 찾을 수 없거나 같은 이름이 존재할 때 또는 데이터베이스 오류 시 예외 발생
 * @example
 * try {
 *   const updated = await renamePlanner('user123', 1, '새로운 이름');
 *   console.log('플래너 이름 변경 성공');
 * } catch (error) {
 *   console.error('이름 변경 실패:', error.message);
 * }
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
 * 지정된 플래너가 존재하는지 확인한 후, 트랜잭션을 사용하여 안전하게 삭제합니다
 * 플래너와 관련된 모든 계획을 원자적으로 삭제하여 데이터 일관성을 보장합니다
 *
 * @async
 * @function deletePlanner
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 삭제할 플래너 ID
 * @returns {Promise<boolean>} 삭제 성공 여부 (true: 성공)
 * @throws {Error} 플래너를 찾을 수 없을 때 또는 데이터베이스 오류 시 예외 발생
 * @example
 * try {
 *   const deleted = await deletePlanner('user123', 1);
 *   console.log('플래너와 모든 계획 삭제 성공');
 * } catch (error) {
 *   console.error('플래너를 찾을 수 없습니다');
 * }
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
