/**
 * Dimiplan Backend 메인 애플리케이션
 * Express 기반 HTTPS 서버로 사용자 인증, 플래너, AI 서비스를 제공합니다
 *
 * @fileoverview 메인 애플리케이션 진입점
 */

import session from "express-session";
import passport from "passport";
import {
  createExpressApp,
  setupBodyParsing,
  setupCorsMiddleware,
  setupErrorHandling,
  setupLoggingMiddleware,
  setupSecurityMiddleware,
  setupTestLoggingMiddleware,
} from "./src/config/app.mjs";
import {
  createHttpsServer,
  setupProcessHandlers,
} from "./src/config/server.mjs";
import {
  closeRedisConnection,
  getSessionConfig,
} from "./src/config/sessionConfig.mjs";
import adminAuthRouter from "./src/routes/admin/auth.mjs";
import adminRouter from "./src/routes/admin/index.mjs";
import apiRouter from "./src/routes/api/index.mjs";

// 라우터 모듈 불러오기
import authRouter from "./src/routes/auth.mjs";
import logger from "./src/utils/logger.mjs";

/**
 * Express 애플리케이션 인스턴스 생성 및 기본 설정
 */
const app = createExpressApp();

// 미들웨어 설정
setupTestLoggingMiddleware(app);
setupSecurityMiddleware(app);
setupCorsMiddleware(app);
setupBodyParsing(app, { limit: "1mb" });
setupLoggingMiddleware(app);

/**
 * 세션 미들웨어 비동기 초기화
 * Redis 기반 세션 스토어 설정 및 Passport 초기화를 수행합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @returns {Promise<void>}
 * @throws {Error} 세션 설정 실패 시 오류 발생
 */
const initializeSession = async (app) => {
  try {
    const config = await getSessionConfig();
    app.use(session(config));

    // Passport 초기화 (세션 설정 후)
    app.use(passport.initialize());
    app.use(passport.session());

    logger.info("세션 미들웨어가 성공적으로 초기화되었습니다");
  } catch (error) {
    logger.error("세션 초기화 실패:", error);
    throw error;
  }
};

/**
 * 애플리케이션 초기화 함수
 * 세션, 라우터, 오류 처리 등 모든 설정을 초기화합니다
 *
 * @returns {Promise<object>} 초기화된 Express 애플리케이션
 * @throws {Error} 초기화 실패 시 오류 발생
 */
const initializeApp = async () => {
  logger.info("애플리케이션 초기화를 시작합니다...");

  try {
    // 세션 초기화
    await initializeSession(app);

    // 라우트 설정
    app.use("/auth", authRouter);
    app.use("/api", apiRouter);
    app.use("/admin", adminRouter);
    app.use("/admin/auth", adminAuthRouter);

    // 전역 오류 처리 미들웨어 설정
    setupErrorHandling(app);

    logger.info("애플리케이션 초기화가 완료되었습니다");
    return app;
  } catch (error) {
    logger.error("애플리케이션 초기화 실패:", error);
    throw error;
  }
};

/**
 * 애플리케이션 시작 및 서버 생성
 * 초기화 후 HTTPS 서버를 시작하고 프로세스 핸들러를 설정합니다
 */
let server;

(async () => {
  try {
    // 애플리케이션 초기화
    const initializedApp = await initializeApp();

    // HTTPS 서버 생성 및 시작
    server = await createHttpsServer(initializedApp);

    // 프로세스 신호 처리 설정
    setupProcessHandlers(server, async () => {
      logger.info("정리 작업을 시작합니다...");
      await closeRedisConnection();
      logger.info("정리 작업이 완료되었습니다");
    });

    logger.info("Dimiplan Backend 서버가 성공적으로 시작되었습니다");
  } catch (error) {
    logger.error("서버 시작 실패:", error);
    process.exit(1);
  }
})();

export default app;
