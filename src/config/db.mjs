import knex from "knex";
import "./dotenv.mjs";
import logger from "../utils/logger.mjs";

export const options = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const dbConfig = {
  client: "mysql",
  connection: options,
};

if (logger.isTestEnvironment) {
  dbConfig.log = {
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message),
    deprecate: (message) => logger.warn(message),
  };
  dbConfig.postProcessResponse = (result) => result;
  dbConfig.wrapIdentifier = (value, origImpl) => origImpl(value);
}

export const db = knex(dbConfig);

if (logger.isTestEnvironment) {
  db.on("query", (queryData) => {
    logger.logDbQuery(queryData.sql, queryData.bindings);
  });
}

db.on("error", (error) => {
  logger.error("데이터베이스 연결 오류:", error);
});

export default db;
