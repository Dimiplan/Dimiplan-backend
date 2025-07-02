/**
 * 로깅 유틸리티
 * 민감한 데이터 필터링과 구조화된 로깅 기능 제공
 *
 * @fileoverview Winston 기반 로깅 시스템 및 보안 필터링
 */
import winston, { addColors, createLogger } from "winston";

const { format, transports } = winston;

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import "../config/dotenv.mjs"; // 환경 변수 로드

/**
 * 로그 레벨 정의
 * Winston 로거에서 사용할 로그 레벨들을 정의합니다
 *
 * @type {object}
 * @property {number} error - 치명적인 오류 (0)
 * @property {number} warn - 경고성 메시지 (1)
 * @property {number} info - 일반 정보 (2)
 * @property {number} verbose - 상세 로깅, 테스트 환경용 (3)
 */
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
};

/**
 * 각 로그 레벨별 콘솔 색상 정의
 * 콘솔 출력 시 가독성을 높이기 위한 색상 설정
 *
 * @type {object}
 */
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    verbose: "cyan",
};

addColors(colors);

/**
 * 안전한 JSON 직렬화 함수
 * 순환 참조 및 복잡한 객체 처리를 위한 안전한 직렬화
 *
 * @param {any} obj - 직렬화할 객체
 * @returns {string} 직렬화된 JSON 문자열
 * @example
 * const result = safeStringify({ circular: obj });
 */
const safeStringify = (obj) => {
    if (!obj) return String(obj);

    // 원시 타입 처리
    if (typeof obj !== "object") return String(obj);

    // 순환 참조 방지를 위한 캐시
    const cache = new Set();

    // 순환 참조 및 복잡한 객체 처리를 위한 대체자 함수
    /**
     * @param key
     * @param value
     * @returns {any}
     */
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
                [
                    "Socket",
                    "IncomingMessage",
                    "ServerResponse",
                    "HTTPParser",
                ].includes(value.constructor.name)
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
const logDir = join(process.cwd(), "logs");

// 로그 디렉토리 생성
try {
    if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true, mode: 0o755 });
    }
} catch (err) {
    console.error(`로그 디렉토리 생성 실패: ${err.message}`);
}

// 테스트 환경 확인
const isTestEnvironment = process.env.NODE_ENV === "test";

// 로그 레벨 설정
const logLevel = process.env.LOG_LEVEL;

// 로거 생성
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
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new transports.File({
            filename: join(logDir, "errors.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exitOnError: false,
});

// 외부 노출 로깅 함수
export default {
    /**
     *
     * @param message
     * @param meta
     * @returns {void}
     */
    error: (message, meta = {}) => logger.error(message, meta),
    /**
     *
     * @param message
     * @param meta
     * @returns {void}
     */
    warn: (message, meta = {}) => logger.warn(message, meta),
    /**
     *
     * @param message
     * @param meta
     * @returns {void}
     */
    info: (message, meta = {}) => logger.info(message, meta),
    /**
     *
     * @param message
     * @param meta
     * @returns {void}
     */
    verbose: (message, meta = {}) => logger.verbose(message, meta),

    // 테스트 환경용 추가 로깅 함수
    /**
     *
     * @param req
     */
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
    /**
     *
     * @param req
     * @param res
     * @param body
     */
    logResponse: (req, res, body) => {
        if (isTestEnvironment) {
            logger.verbose(
                `응답: ${req.method} ${req.url} [${res.statusCode}]`,
                {
                    headers: res.getHeaders(),
                    body: body,
                },
            );
        }
    },
    /**
     *
     * @param query
     * @param bindings
     */
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
        /**
         *
         * @param message
         * @returns {void}
         */
        write: (message) => logger.verbose(message.trim()),
    },
};
