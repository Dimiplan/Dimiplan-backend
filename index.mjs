import { spawn } from "bun";
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

import authRouter from "./src/routes/auth.mjs";
import logger from "./src/utils/logger.mjs";

const app = createExpressApp();

setupTestLoggingMiddleware(app);
setupSecurityMiddleware(app);
setupCorsMiddleware(app);
setupBodyParsing(app, { limit: "1mb" });
setupLoggingMiddleware(app);

const initializeSession = async (app) => {
  try {
    const config = await getSessionConfig();
    app.use(session(config));

    app.use(passport.initialize());
    app.use(passport.session());

    logger.info("세션 미들웨어가 성공적으로 초기화되었습니다");
  } catch (error) {
    logger.error("세션 초기화 실패:", error);
    throw error;
  }
};

const initializeApp = async () => {
  logger.info("애플리케이션 초기화를 시작합니다...");

  try {
    await initializeSession(app);

    app.use("/auth", authRouter);
    app.use("/auth/admin", adminAuthRouter);

    app.use("/api", apiRouter);
    app.use("/admin", adminRouter);

    setupErrorHandling(app);

    logger.info("애플리케이션 초기화가 완료되었습니다");
    return app;
  } catch (error) {
    logger.error("애플리케이션 초기화 실패:", error);
    throw error;
  }
};

let server;

(async () => {
  try {
    const initializedApp = await initializeApp();

    server = await createHttpsServer(initializedApp);

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
