/**
 * 데이터베이스 유틸리티 함수
 * 오류 처리 및 트랜잭션 관리를 위한 공통 데이터베이스 작업을 제공합니다
 * 안전한 트랜잭션 실행, 사용자별 ID 관리, 데이터베이스 연결 테스트 기능을 포함합니다
 *
 * @fileoverview 데이터베이스 작업을 위한 공통 유틸리티 모듈
 */
import db from "../config/db.mjs";
import logger from "./logger.mjs";

/**
 * 안전한 데이터베이스 트랜잭션 실행
 * 데이터베이스 작업 중 오류 발생 시 자동으로 롤백을 수행하고 오류를 로그에 기록합니다
 * 복잡한 데이터베이스 작업에서 데이터 일관성을 보장합니다
 *
 * @async
 * @function executeTransaction
 * @param {Function} transactionFn - 트랜잭션 작업을 포함하는 비동기 함수
 * @param {object} transactionFn.trx - Knex 트랜잭션 객체
 * @returns {Promise<*>} 트랜잭션 실행 결과
 * @throws {Error} 트랜잭션 실패 시 예외 발생
 * @example
 * // 복수 테이블 업데이트
 * const result = await executeTransaction(async (trx) => {
 *   await trx('users').where('id', userId).update({ name: newName });
 *   await trx('logs').insert({ action: 'update_user', userId });
 *   return 'success';
 * });
 */
export const executeTransaction = async (transactionFn) => {
    try {
        return await db.transaction(transactionFn);
    } catch (error) {
        logger.error("데이터베이스 트랜잭션 오류:", error);
        throw error;
    }
};

/**
 * 사용자별 다음 사용 가능한 ID 조회 및 업데이트
 * 사용자별로 고유한 ID 카운터를 관리하여 충돌 없는 ID를 생성합니다
 * 사용자가 처음 접근하는 경우 userid 테이블을 초기화하고, 기존 사용자는 현재 값을 증가시킵니다
 *
 * @async
 * @function getNextId
 * @param {string} uid - 사용자 ID (해시된 사용자 ID)
 * @param {string} idType - ID 유형 (plannerId, planId, roomId, chatId 중 하나)
 * @returns {Promise<number>} 다음 사용 가능한 ID 번호
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * // 새 플래너 ID 발급
 * const newPlannerId = await getNextId(hashedUserId, 'plannerId');
 * console.log(newPlannerId); // 1, 2, 3, ...
 *
 * // 새 채팅방 ID 발급
 * const newRoomId = await getNextId(hashedUserId, 'roomId');
 * console.log(newRoomId); // 사용자별 순차적 ID
 */
export const getNextId = async (uid, idType) => {
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

        logger.verbose(
            `다음 ${idType} ID 발급 - 사용자: ${uid}, ID: ${currentId}`,
        );
        return currentId;
    } catch (error) {
        logger.error(`다음 ${idType} ID 조회 중 오류 - 사용자: ${uid}`, error);
        throw error;
    }
};

/**
 * 데이터베이스 연결 테스트
 * 데이터베이스 연결 상태를 확인하고 진단 정보를 로그에 기록합니다
 * 간단한 SELECT 1 쿼리를 실행하여 연결 상태를 검증합니다
 * 애플리케이션 시작 시나 헬스 체크에 유용합니다
 *
 * @async
 * @function testDatabaseConnection
 * @returns {Promise<boolean>} 데이터베이스 연결 상태 (true: 연결 성공, false: 연결 실패)
 * @example
 * // 애플리케이션 시작 시 연결 테스트
 * const isConnected = await testDatabaseConnection();
 * if (!isConnected) {
 *   console.error('데이터베이스 연결 실패');
 *   process.exit(1);
 * }
 *
 * // 헬스 체크 엔드포인트
 * app.get('/health', async (req, res) => {
 *   const dbStatus = await testDatabaseConnection();
 *   res.json({ database: dbStatus });
 * });
 */
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
