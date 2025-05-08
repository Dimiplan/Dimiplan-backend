const knex = require("knex");
require("./dotenv"); // Load environment variables
const logger = require("../utils/logger");

const options = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

// DB 쿼리 로깅을 위한 설정 추가
const dbConfig = {
  client: "mysql",
  connection: options,
};

// 테스트 환경에서는 쿼리 로깅 활성화
if (logger.isTestEnvironment) {
  dbConfig.log = {
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message),
    deprecate: (message) => logger.warn(message),
    debug: (message) => logger.debug(message),
  };

  // 모든 쿼리를 로깅하기 위한 이벤트 핸들러 추가
  dbConfig.postProcessResponse = (result, queryContext) => {
    return result;
  };

  dbConfig.wrapIdentifier = (value, origImpl, queryContext) => {
    return origImpl(value);
  };
}

const db = knex(dbConfig);

// 테스트 환경에서 모든 쿼리 로깅
if (logger.isTestEnvironment) {
  db.on("query", (queryData) => {
    logger.logDbQuery(queryData.sql, queryData.bindings);
  });
}

module.exports = db;
module.exports.options = options;
