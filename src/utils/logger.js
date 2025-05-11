/**
 * 로깅 유틸리티
 * 민감한 데이터 필터링과 구조화된 로깅 기능 제공
 */
const winston = require("winston");
const { format, transports } = winston;
const fs = require("fs");
const path = require("path");
require("../config/dotenv"); // 환경 변수 로드

// 로그 레벨 정의
const levels = {
  error: 0, // 치명적인 오류
  warn: 1, // 경고성 메시지
  info: 2, // 일반 정보
  verbose: 3, // 상세 로깅 (테스트 환경용)
};

// 각 레벨별 색상 정의
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  verbose: "cyan",
};

winston.addColors(colors);

/**
 * 안전한 JSON 직렬화 함수
 * 순환 참조 및 복잡한 객체 처리
 *
 * @param {Object} obj - 직렬화할 객체
 * @returns {string} 직렬화된 JSON 문자열
 */
const safeStringify = (obj) => {
  if (!obj) return String(obj);

  // 원시 타입 처리
  if (typeof obj !== "object") return String(obj);

  // 순환 참조 방지를 위한 캐시
  const cache = new Set();

  // 순환 참조 및 복잡한 객체 처리를 위한 대체자 함수
  const replacer = (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        return "[순환 참조]";
      }
      cache.add(value);

      // 오류 객체 특별 처리
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      // 복잡한 시스템 객체 필터링
      if (
        value.constructor &&
        ["Socket", "IncomingMessage", "ServerResponse", "HTTPParser"].includes(
          value.constructor.name,
        )
      ) {
        return `[${value.constructor.name}]`;
      }
    }
    return value;
  };

  try {
    return JSON.stringify(obj, replacer);
  } catch (error) {
    return `[직렬화 불가 객체: ${error.message}]`;
  }
};

// 로그 디렉토리 정의
const logDir = path.join(process.cwd(), "logs");

// 로그 디렉토리 생성
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });
  }
} catch (err) {
  console.error(`로그 디렉토리 생성 실패: ${err.message}`);
}

// 테스트 환경 확인
const isTestEnvironment = process.env.NODE_ENV === "test";

// 로그 레벨 설정
const logLevel = isTestEnvironment
  ? "verbose"
  : process.env.LOG_LEVEL || "info";

// 로거 생성
const logger = winston.createLogger({
  level: logLevel,
  levels,
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const restString = Object.keys(rest).length
        ? ` ${safeStringify(rest)}`
        : "";
      return `${timestamp} ${level}: ${message}${restString}`;
    }),
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const restString = Object.keys(rest).length
            ? ` ${safeStringify(rest)}`
            : "";
          return `${timestamp} ${level}: ${message}${restString}`;
        }),
      ),
    }),
    new transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logDir, "errors.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// 외부 노출 로깅 함수
module.exports = {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  verbose: (message, meta = {}) => logger.verbose(message, meta),

  // 테스트 환경용 추가 로깅 함수
  logRequest: (req) => {
    if (isTestEnvironment) {
      logger.verbose(`요청: ${req.method} ${req.url}`, {
        headers: req.headers,
        body: req.body,
        query: req.query,
        ip: req.ip,
      });
    }
  },
  logResponse: (req, res, body) => {
    if (isTestEnvironment) {
      logger.verbose(`응답: ${req.method} ${req.url} [${res.statusCode}]`, {
        headers: res.getHeaders(),
        body: body,
      });
    }
  },
  logDbQuery: (query, bindings) => {
    if (isTestEnvironment) {
      logger.verbose(`DB QUERY`, {
        sql: query,
        bindings: bindings,
      });
    }
  },
  // 기타 유틸리티
  isTestEnvironment,
  stream: {
    write: (message) => logger.verbose(message.trim()),
  },
};
