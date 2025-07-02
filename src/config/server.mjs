/**
 * 서버 설정 및 초기화 모듈
 * HTTPS 서버 생성, SSL 설정, 프로세스 관리를 담당합니다
 *
 * @fileoverview 서버 초기화 및 생명주기 관리
 */

import { readFileSync } from "node:fs";
import { createServer } from "https";
import logger from "../utils/logger.mjs";
import "./dotenv.mjs";

/**
 * SSL 인증서 설정을 로드합니다
 *
 * @returns {object} SSL 옵션 객체
 * @throws {Error} 인증서 파일을 읽을 수 없는 경우 오류 발생
 * @example
 * const sslOptions = loadSSLOptions();
 * const server = createServer(sslOptions, app);
 */
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

/**
 * HTTPS 서버를 생성하고 시작합니다
 *
 * @param {object} app - Express 애플리케이션 인스턴스
 * @param {object} options - 서버 설정 옵션
 * @param {number} [options.port] - 서버 포트 (기본값: 환경변수 PORT)
 * @param {object} [options.sslOptions] - SSL 설정 (기본값: 자동 로드)
 * @returns {Promise<object>} 생성된 서버 인스턴스
 * @example
 * const server = await createHttpsServer(app, { port: 3000 });
 */
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

/**
 * 서버의 정상 종료(graceful shutdown)를 처리합니다
 *
 * @param {object} server - HTTP/HTTPS 서버 인스턴스
 * @param {object} options - 종료 설정 옵션
 * @param {number} [options.timeout=30000] - 강제 종료까지의 대기 시간 (밀리초)
 * @returns {Promise<void>}
 * @example
 * process.on('SIGTERM', () => gracefulShutdown(server));
 */
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

/**
 * 프로세스 신호 처리기를 설정합니다
 * SIGTERM, SIGINT 등의 신호에 대한 정상 종료 처리를 설정합니다
 *
 * @param {object} server - HTTP/HTTPS 서버 인스턴스
 * @param {Function} [cleanup] - 추가 정리 작업 함수
 * @returns {void}
 * @example
 * setupProcessHandlers(server, async () => {
 *   await closeDatabase();
 *   await closeRedisConnection();
 * });
 */
export const setupProcessHandlers = (server, cleanup) => {
  /**
   *
   * @param signal
   */
  const handleShutdown = async (signal) => {
    logger.info(`${signal} 신호 수신, 안전하게 서버 종료 중`);

    try {
      // 사용자 정의 정리 작업 실행
      if (cleanup && typeof cleanup === "function") {
        await cleanup();
      }

      // 서버 정상 종료
      await gracefulShutdown(server);
      process.exit(0);
    } catch (error) {
      logger.error("종료 중 오류 발생:", error);
      process.exit(1);
    }
  };

  // 프로세스 종료 신호 처리
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));

  // 처리되지 않은 Promise 거부 처리
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("처리되지 않은 Promise 거부:", reason);
    logger.error("Promise:", promise);
  });

  // 처리되지 않은 예외 처리
  process.on("uncaughtException", (error) => {
    logger.error("처리되지 않은 예외:", error);
    process.exit(1);
  });
};
