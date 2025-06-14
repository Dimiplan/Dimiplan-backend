/**
 * Express 애플리케이션 설정 모듈
 * 미들웨어 설정, 보안 헤더, CORS 등 앱 기본 설정을 담당합니다
 *
 * @fileoverview Express 앱 초기화 및 기본 설정
 */

import express, { json, urlencoded } from "express";
import helmet from "helmet";
import "./dotenv.mjs";
import { getCorsConfig } from "./cors.mjs";
import { getSecurityConfig } from "./security.mjs";
import logger from "../utils/logger.mjs";

/**
 * Express 애플리케이션 인스턴스를 생성하고 기본 설정을 적용합니다
 *
 * @returns {object} 설정된 Express 애플리케이션 인스턴스
 * @example
 * const app = createExpressApp();
 */
export const createExpressApp = () => {
  const app = express();

  // 프록시 신뢰 설정 (로드 밸런서 환경)
  app.set("trust proxy", true);

  return app;
};

/**
 * 보안 관련 미들웨어를 설정합니다
 * Helmet을 사용하여 보안 HTTP 헤더를 자동으로 설정합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @returns {void}
 */
export const setupSecurityMiddleware = (app) => {
  const securityConfig = getSecurityConfig();
  app.use(helmet(securityConfig));
};

/**
 * CORS 미들웨어를 설정합니다
 * 도메인별 접근 제어 및 인증 정보 처리를 설정합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @returns {void}
 */
export const setupCorsMiddleware = (app) => {
  const corsConfig = getCorsConfig();
  app.use(corsConfig);
};

/**
 * 요청 본문 파싱 미들웨어를 설정합니다
 * JSON 및 URL 인코딩된 데이터의 크기 제한을 포함합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @param {object} options - 파싱 설정 옵션
 * @param {string} [options.limit="1mb"] - 요청 본문 크기 제한
 * @returns {void}
 */
export const setupBodyParsing = (app, options = {}) => {
  const { limit = "1mb" } = options;

  app.use(json({ limit }));
  app.use(urlencoded({ extended: true, limit }));
};

/**
 * 기본 로깅 미들웨어를 설정합니다
 * 모든 요청에 대한 기본 정보를 로그에 기록합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @returns {void}
 */
export const setupLoggingMiddleware = (app) => {
  app.use((req, res, next) => {
    logger.info(`요청 방식: ${req.method}, 경로: ${req.path}, IP: ${req.ip}`);
    next();
  });
};

/**
 * 테스트 환경용 상세 로깅 미들웨어를 설정합니다
 * 요청/응답 내용을 상세히 로그에 기록합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @returns {void}
 */
export const setupTestLoggingMiddleware = (app) => {
  if (!logger.isTestEnvironment) return;

  app.use((req, res, next) => {
    logger.logRequest(req);

    const originalSend = res.send;
    /**
     * 응답 본문을 로그에 기록하는 send 메서드
     * @param body
     * @returns {Response}
     */
    res.send = function (body) {
      logger.logResponse(req, res, body);
      return originalSend.apply(res, arguments);
    };

    next();
  });
};

/**
 * 전역 오류 처리 미들웨어를 설정합니다
 * 처리되지 않은 오류를 캐치하고 적절한 응답을 반환합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @returns {void}
 */
export const setupErrorHandling = (app) => {
  app.use((err, req, res, next) => {
    logger.error("애플리케이션 오류:", err);

    // 개발 환경에서는 상세 오류 정보 제공
    const isDevelopment = process.env.NODE_ENV === "test";

    res.status(err.status || 500).json({
      message: err.message || "내부 서버 오류",
      ...(isDevelopment && { stack: err.stack }),
    });
  });
};
