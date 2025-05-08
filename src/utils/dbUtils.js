/**
 * 데이터베이스 유틸리티 함수
 * 오류 처리 및 트랜잭션 관리를 위한 공통 데이터베이스 작업 제공
 */
const db = require("../config/db");
const logger = require("./logger");

/**
 * 안전한 데이터베이스 트랜잭션 실행
 * 데이터베이스 작업 중 오류 처리 및 롤백 관리
 *
 * @param {Function} transactionFn - 트랜잭션 작업을 포함하는 함수
 * @returns {Promise} 트랜잭션 결과
 */
const executeTransaction = async (transactionFn) => {
  try {
    return await db.transaction(transactionFn);
  } catch (error) {
    logger.error("데이터베이스 트랜잭션 오류:", error);
    throw error;
  }
};

/**
 * 사용자별 다음 사용 가능한 ID 조회 및 업데이트
 * 사용자 고유 ID 카운터 관리
 *
 * @param {string} uid - 사용자 ID
 * @param {string} idType - ID 유형 (plannerId, planId, roomId, chatId)
 * @returns {Promise<number>} 다음 사용 가능한 ID
 */
const getNextId = async (uid, idType) => {
  try {
    // 사용자의 userid 테이블 존재 여부 확인
    const userData = await db("userid")
      .where({ owner: uid })
      .select(idType)
      .first();

    if (!userData) {
      // 사용자 ID 초기화
      await db("userid").insert({
        owner: uid,
        plannerId: 1,
        planId: 1,
        roomId: 1,
        chatId: 1,
      });

      logger.info(`새 사용자 ID 초기화 - 사용자: ${uid}`);
      return 1;
    }

    const currentId = userData[idType];

    // 다음 ID로 업데이트
    await db("userid")
      .where({ owner: uid })
      .update({ [idType]: currentId + 1 });

    logger.debug(`다음 ${idType} ID 발급 - 사용자: ${uid}, ID: ${currentId}`);
    return currentId;
  } catch (error) {
    logger.error(`다음 ${idType} ID 조회 중 오류 - 사용자: ${uid}`, error);
    throw error;
  }
};

/**
 * 데이터베이스 연결 테스트
 * 데이터베이스 연결 상태 확인 및 진단
 *
 * @returns {Promise<boolean>} 데이터베이스 연결 상태
 */
const testDatabaseConnection = async () => {
  try {
    await db.raw("SELECT 1");
    logger.info("데이터베이스 연결 성공");
    return true;
  } catch (error) {
    logger.error("데이터베이스 연결 실패:", error);
    return false;
  }
};

module.exports = {
  executeTransaction, // 트랜잭션 실행
  getNextId, // 다음 ID 발급
  testDatabaseConnection, // 데이터베이스 연결 테스트
};
