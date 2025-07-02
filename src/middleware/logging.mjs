/**
 * 로깅 미들웨어 모듈
 * 요청/응답 로깅 및 보안 정보 필터링을 담당합니다
 *
 * @fileoverview 로깅 미들웨어 및 보안 필터링 유틸리티
 */

import logger from "../utils/logger.mjs";

/**
 * 민감한 정보를 포함할 수 있는 헤더 목록
 * 로그에서 마스킹 처리할 헤더들을 정의합니다
 *
 * @type {string[]}
 */
const SENSITIVE_HEADERS = [
    "authorization",
    "cookie",
    "set-cookie",
    "x-session-id",
    "x-api-key",
    "x-auth-token",
];

/**
 * 민감한 정보를 포함할 수 있는 필드 목록
 * 요청/응답 본문에서 마스킹 처리할 필드들을 정의합니다
 *
 * @type {string[]}
 */
const SENSITIVE_FIELDS = [
    "password",
    "token",
    "secret",
    "key",
    "auth",
    "credential",
    "session",
];

/**
 * 헤더에서 민감한 정보를 마스킹합니다
 *
 * @param {object} headers - 원본 헤더 객체
 * @returns {object} 마스킹된 헤더 객체
 * @example
 * const safeHeaders = maskSensitiveHeaders(req.headers);
 */
const maskSensitiveHeaders = (headers) => {
    if (!headers || typeof headers !== "object") return headers;

    const maskedHeaders = { ...headers };

    Object.keys(maskedHeaders).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (
            SENSITIVE_HEADERS.some((sensitive) => lowerKey.includes(sensitive))
        ) {
            maskedHeaders[key] = "[MASKED]";
        }
    });

    return maskedHeaders;
};

/**
 * 객체에서 민감한 정보를 재귀적으로 마스킹합니다
 *
 * @param {any} data - 마스킹할 데이터
 * @param {number} [depth=0] - 현재 재귀 깊이
 * @param {number} [maxDepth=5] - 최대 재귀 깊이
 * @returns {any} 마스킹된 데이터
 */
const maskSensitiveData = (data, depth = 0, maxDepth = 5) => {
    // 재귀 깊이 제한
    if (depth > maxDepth) return "[MAX_DEPTH_REACHED]";

    if (!data || typeof data !== "object") return data;

    // 배열 처리
    if (Array.isArray(data)) {
        return data.map((item) => maskSensitiveData(item, depth + 1, maxDepth));
    }

    // 객체 처리
    const maskedData = {};
    Object.keys(data).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (
            SENSITIVE_FIELDS.some((sensitive) => lowerKey.includes(sensitive))
        ) {
            maskedData[key] = "[MASKED]";
        } else {
            maskedData[key] = maskSensitiveData(data[key], depth + 1, maxDepth);
        }
    });

    return maskedData;
};

/**
 * 요청 로깅 미들웨어
 * 들어오는 요청의 기본 정보를 안전하게 로그에 기록합니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {void}
 */
export const requestLoggingMiddleware = (req, res, next) => {
    const requestInfo = {
        method: req.method,
        url: req.url,
        path: req.path,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        timestamp: new Date().toISOString(),
        headers: maskSensitiveHeaders(req.headers),
        query: maskSensitiveData(req.query),
        // body는 크기가 클 수 있으므로 개발 환경에서만 로깅
        ...(process.env.NODE_ENV === "test" && {
            body: maskSensitiveData(req.body),
        }),
    };

    logger.info("들어오는 요청:", requestInfo);
    next();
};

/**
 * 응답 로깅 미들웨어
 * 나가는 응답의 기본 정보를 안전하게 로그에 기록합니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {void}
 */
export const responseLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();

    // 원본 응답 메서드 백업
    const originalSend = res.send;
    const originalJson = res.json;

    // send 메서드 오버라이드
    /**
     * @param body
     * @returns {Response}
     */
    res.send = (...args) => {
        logResponse(req, res, args[0], startTime);
        return originalSend.apply(res, args);
    };

    // json 메서드 오버라이드
    /**
     * @param body
     * @returns {Response}
     */
    res.json = (...args) => {
        logResponse(req, res, args[0], startTime);
        return originalJson.apply(res, args);
    };

    next();
};

/**
 * 응답 정보를 로그에 기록하는 내부 함수
 *
 * @private
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {any} body - 응답 본문
 * @param {number} startTime - 요청 시작 시간
 * @returns {void}
 */
const logResponse = (req, res, body, startTime) => {
    const duration = Date.now() - startTime;

    const responseInfo = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        headers: maskSensitiveHeaders(res.getHeaders()),
        // 응답 본문은 테스트 환경에서만 로깅 (크기 제한)
        ...(process.env.NODE_ENV === "test" &&
            body && {
                bodySize: Buffer.byteLength(JSON.stringify(body), "utf8"),
                body:
                    typeof body === "string" && body.length > 1000
                        ? `${body.substring(0, 1000)}...[TRUNCATED]`
                        : maskSensitiveData(body),
            }),
    };

    // 상태 코드에 따른 로그 레벨 결정
    if (res.statusCode >= 500) {
        logger.error("응답 (서버 오류):", responseInfo);
    } else if (res.statusCode >= 400) {
        logger.warn("응답 (클라이언트 오류):", responseInfo);
    } else {
        logger.info("응답:", responseInfo);
    }
};

/**
 * 오류 로깅 미들웨어
 * 처리되지 않은 오류를 안전하게 로그에 기록합니다
 *
 * @middleware
 * @param {Error} err - 발생한 오류 객체
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {void}
 */
export const errorLoggingMiddleware = (err, req, res, next) => {
    const errorInfo = {
        message: err.message,
        stack: err.stack,
        status: err.status || err.statusCode || 500,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        timestamp: new Date().toISOString(),
        headers: maskSensitiveHeaders(req.headers),
        body: maskSensitiveData(req.body),
    };

    logger.error("미들웨어 오류:", errorInfo);
    next(err);
};

/**
 * 성능 모니터링 미들웨어
 * 요청 처리 시간과 메모리 사용량을 모니터링합니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {void}
 */
export const performanceMonitoringMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    res.on("finish", () => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();

        const duration = Number(endTime - startTime) / 1000000; // 나노초를 밀리초로 변환
        const memoryDiff = {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        };

        // 느린 요청이나 메모리 사용량이 많은 요청만 로깅
        if (
            duration > 1000 ||
            Math.abs(memoryDiff.heapUsed) > 10 * 1024 * 1024
        ) {
            // 1초 초과 또는 10MB 초과
            logger.warn("성능 경고:", {
                method: req.method,
                url: req.url,
                duration: `${duration.toFixed(2)}ms`,
                memoryDiff,
                statusCode: res.statusCode,
            });
        }
    });

    next();
};
