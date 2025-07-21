import winston, { addColors, createLogger } from "winston";

const { format, transports } = winston;

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import "../config/dotenv.mjs";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  verbose: "cyan",
};

addColors(colors);

const safeStringify = (obj) => {
  if (!obj) return String(obj);

  if (typeof obj !== "object") return String(obj);

  const cache = new Set();

  const replacer = (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        return "[순환 참조]";
      }
      cache.add(value);

      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

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

const logDir = join(process.cwd(), "logs");

try {
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true, mode: 0o755 });
  }
} catch (err) {
  console.error(`로그 디렉토리 생성 실패: ${err.message}`);
}

const isTestEnvironment = process.env.NODE_ENV === "test";

const logLevel = process.env.LOG_LEVEL;

export const logger = createLogger({
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
      filename: join(logDir, "combined.log"),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new transports.File({
      filename: join(logDir, "errors.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

export default {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  verbose: (message, meta = {}) => logger.verbose(message, meta),

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
  isTestEnvironment,
};
