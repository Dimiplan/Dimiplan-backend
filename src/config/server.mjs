import { readFileSync } from "node:fs";
import { createServer } from "https";
import logger from "../utils/logger.mjs";
import "./dotenv.mjs";

export const loadSSLOptions = () => {
  try {
    return {
      key: readFileSync("./keys/private.pem"),
      cert: readFileSync("./keys/public.pem"),
    };
  } catch (error) {
    logger.error("SSL 인증서 로드 실패:", error);
    throw new Error(
      "SSL 인증서를 찾을 수 없습니다. keys/ 디렉토리를 확인해주세요.",
    );
  }
};

export const createHttpsServer = async (app, options = {}) => {
  const { port = process.env.PORT || 3000, sslOptions = loadSSLOptions() } =
    options;

  return new Promise((resolve, reject) => {
    try {
      const server = createServer(sslOptions, app);

      server.listen(port, () => {
        logger.info(`HTTPS 서버가 ${port} 포트에서 실행 중입니다`);
        resolve(server);
      });

      server.on("error", (error) => {
        logger.error("서버 시작 오류:", error);
        reject(error);
      });
    } catch (error) {
      logger.error("서버 생성 오류:", error);
      reject(error);
    }
  });
};

export const gracefulShutdown = async (server, options = {}) => {
  const { timeout = 30000 } = options;

  logger.info("서버 정상 종료를 시작합니다...");

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logger.warn(`${timeout}ms 후 강제 종료합니다`);
      process.exit(1);
    }, timeout);

    server.close(() => {
      clearTimeout(timer);
      logger.info("서버가 안전하게 종료되었습니다");
      resolve();
    });
  });
};

export const setupProcessHandlers = (server, cleanup) => {
  const handleShutdown = async (signal) => {
    logger.info(`${signal} 신호 수신, 안전하게 서버 종료 중`);

    try {
      if (cleanup && typeof cleanup === "function") {
        await cleanup();
      }

      await gracefulShutdown(server);
      process.exit(0);
    } catch (error) {
      logger.error("종료 중 오류 발생:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("처리되지 않은 Promise 거부:", reason);
    logger.error("Promise:", promise);
  });

  process.on("uncaughtException", (error) => {
    logger.error("처리되지 않은 예외:", error);
    process.exit(1);
  });
};
