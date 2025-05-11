/**
 * 데이터베이스 연결 구성
 * MySQL 데이터베이스 연결 및 Knex.js 설정 관리
 */
const knex = require("knex");
require("./dotenv"); // 환경 변수 로드
const logger = require("../utils/logger");

// 데이터베이스 연결 옵션
const options = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

// Knex.js 데이터베이스 구성
const dbConfig = {
  client: "mysql", // MySQL 드라이버 사용
  connection: options,
};

// 테스트 환경에서 상세 로깅 설정
if (logger.isTestEnvironment) {
  // 다양한 로그 수준에 대한 로깅 핸들러 설정
  dbConfig.log = {
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message),
    deprecate: (message) => logger.warn(message),
  };

  // 쿼리 후처리 및 식별자 래핑
  dbConfig.postProcessResponse = (result) => result;
  dbConfig.wrapIdentifier = (value, origImpl) => origImpl(value);
}

// Knex.js 데이터베이스 인스턴스 생성
const db = knex(dbConfig);

// 테스트 환경에서 쿼리 로깅
if (logger.isTestEnvironment) {
  db.on("query", (queryData) => {
    logger.logDbQuery(queryData.sql, queryData.bindings);
  });
}

// 데이터베이스 연결 오류 처리
db.on("error", (error) => {
  logger.error("데이터베이스 연결 오류:", error);
});

module.exports = db;
module.exports.options = options;
