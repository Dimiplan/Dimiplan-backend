/**
 * 데이터베이스 연결 구성 모듈
 * MySQL 데이터베이스 연결 및 Knex.js 설정 관리
 *
 * @fileoverview Knex.js 기반 MySQL 데이터베이스 연결 설정
 */
import knex from "knex";
import "./dotenv.mjs";
import logger from "../utils/logger.mjs";

/**
 * 데이터베이스 연결 옵션 객체
 * 환경 변수에서 데이터베이스 연결 정보를 읽어옵니다
 *
 * @type {object}
 * @property {string} host - 데이터베이스 호스트 주소
 * @property {number} port - 데이터베이스 포트 번호
 * @property {string} user - 데이터베이스 사용자명
 * @property {string} password - 데이터베이스 비밀번호
 * @property {string} database - 데이터베이스명
 * @example
 * console.log(options.host); // 'localhost'
 */
export const options = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

/**
 * Knex.js 데이터베이스 설정 구성
 * MySQL 클라이언트 및 연결 옵션을 포함합니다
 *
 * @type {object}
 * @private
 */
const dbConfig = {
    client: "mysql",
    connection: options,
};

/**
 * 테스트 환경에서의 상세 로깅 설정
 * 개발 및 디버깅을 위한 쿼리 로깅을 구성합니다
 */
if (logger.isTestEnvironment) {
    dbConfig.log = {
        /**
         * @param message
         * @returns {void}
         */
        warn: (message) => logger.warn(message),
        /**
         * @param message
         * @returns {void}
         */
        error: (message) => logger.error(message),
        /**
         * @param message
         * @returns {void}
         */
        deprecate: (message) => logger.warn(message),
    };

    /**
     * @param result
     * @returns {object}
     */
    dbConfig.postProcessResponse = (result) => result;

    /**
     *
     * @param value
     * @param origImpl
     * @returns {string}
     */
    dbConfig.wrapIdentifier = (value, origImpl) => origImpl(value);
}

/**
 * Knex.js 데이터베이스 인스턴스
 * 애플리케이션 전반에서 사용되는 메인 데이터베이스 연결 객체
 *
 * @type {object}
 * @example
 * // 사용자 조회
 * const users = await db('users').select('*');
 *
 * // 트랜잭션 사용
 * await db.transaction(async (trx) => {
 *   await trx('users').insert(userData);
 * });
 */
export const db = knex(dbConfig);

/**
 * 테스트 환경에서 쿼리 실행 로깅
 * 실행되는 모든 SQL 쿼리를 로그에 기록합니다
 */
if (logger.isTestEnvironment) {
    db.on("query", (queryData) => {
        logger.logDbQuery(queryData.sql, queryData.bindings);
    });
}

/**
 * 데이터베이스 연결 오류 이벤트 핸들러
 * 연결 실패나 기타 데이터베이스 오류를 로그에 기록합니다
 */
db.on("error", (error) => {
    logger.error("데이터베이스 연결 오류:", error);
});

export default db;
