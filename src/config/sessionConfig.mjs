import { promisify } from "node:util";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { generateSecureToken } from "../utils/crypto.mjs";
import logger from "../utils/logger.mjs";

import "./dotenv.mjs";

const SESSION_SECRET = process.env.SESSION_SECRET || generateSecureToken();

let redisClient;

let redisStore;

export const initRedisClient = async () => {
  if (redisClient) return redisClient;

  redisClient = createClient(6379, "127.0.0.1");

  redisClient.on("error", (err) => {
    logger.error("Redis 클라이언트 오류:", err);
  });

  redisClient.on("connect", () => {
    logger.info("Redis 서버에 연결되었습니다");
  });

  redisClient.getAsync = promisify(redisClient.get).bind(redisClient);
  redisClient.setAsync = promisify(redisClient.set).bind(redisClient);
  redisClient.delAsync = promisify(redisClient.del).bind(redisClient);

  await redisClient
    .connect()
    .catch((err) => {
      logger.error("Redis 연결 실패:", err);
      throw err;
    })
    .then(() => {
      logger.info("Redis 서버에 연결되었습니다");
      redisStore = new RedisStore({
        client: redisClient,
        ttl: 86400,
        prefix: "dimiplan:sess:",
      });
    });

  return redisClient;
};

export const getSessionConfig = async () => {
  await initRedisClient().catch((err) => {
    logger.error("Redis 초기화 실패, 메모리 세션으로 폴백합니다:", err);
    return null;
  });

  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "dimiplan.sid",
    store: redisStore,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 86400000,
    },
  };
};

export const getUserFromSession = (session) => {
  logger.verbose("세션 정보:", session);
  return session?.passport?.user?.id || null;
};

export const closeRedisConnection = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info("Redis 연결이 종료되었습니다");
  }
};
