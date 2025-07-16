import db from "../config/db.mjs";
import logger from "./logger.mjs";

export const executeTransaction = async (transactionFn) => {
  try {
    return await db.transaction(transactionFn);
  } catch (error) {
    logger.error("데이터베이스 트랜잭션 오류:", error);
    throw error;
  }
};

export const getNextId = async (uid, idType) => {
  try {
    const userData = await db("userid")
      .where({ owner: uid })
      .select(idType)
      .first();

    if (!userData) {
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

    await db("userid")
      .where({ owner: uid })
      .update({ [idType]: currentId + 1 });

    logger.verbose(`다음 ${idType} ID 발급 - 사용자: ${uid}, ID: ${currentId}`);
    return currentId;
  } catch (error) {
    logger.error(`다음 ${idType} ID 조회 중 오류 - 사용자: ${uid}`, error);
    throw error;
  }
};

export const testDatabaseConnection = async () => {
  try {
    await db.raw("SELECT 1");
    logger.info("데이터베이스 연결 성공");
    return true;
  } catch (error) {
    logger.error("데이터베이스 연결 실패:", error);
    return false;
  }
};
