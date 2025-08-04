import express, { json, urlencoded } from "express";
import helmet from "helmet";
import "./dotenv.mjs";
import logger from "../utils/logger.mjs";
import { getCorsConfig } from "./cors.mjs";
import { getSecurityConfig } from "./security.mjs";

export const createExpressApp = () => {
  const app = express();

  app.set("trust proxy", true);

  return app;
};

export const setupSecurityMiddleware = (app) => {
  const securityConfig = {
    contentSecurityPolicy: {
    directives: getCSPDirectives(),
    reportOnly: false,
  },

  crossOriginEmbedderPolicy: {
    policy: "require-corp",
  },

  crossOriginOpenerPolicy: {
    policy: "same-origin",
  },

  crossOriginResourcePolicy: {
    policy: "cross-origin",
  },

  dnsPrefetchControl: {
    allow: false,
  },

  frameguard: {
    action: "deny",
  },

  hidePoweredBy: true,

  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },

  ieNoOpen: true,

  noSniff: true,

  originAgentCluster: true,

  permittedCrossDomainPolicies: {
    permittedPolicies: "none",
  },

  referrerPolicy: {
    policy: ["no-referrer", "strict-origin-when-cross-origin"],
  },

  xssFilter: true,
  }
  app.use(helmet(securityConfig));
};

export const setupCorsMiddleware = (app) => {
  const corsConfig = getCorsConfig();
  app.use(corsConfig);
};

export const setupBodyParsing = (app, options = {}) => {
  const { limit = "1mb" } = options;

  app.use(json({ limit }));
  app.use(urlencoded({ extended: true, limit }));
};

export const setupLoggingMiddleware = (app) => {
  app.use((req, res, next) => {
    logger.info(`요청 방식: ${req.method}, 경로: ${req.path}, IP: ${req.ip}`);
    next();
  });
};

export const setupTestLoggingMiddleware = (app) => {
  if (!logger.isTestEnvironment) return;

  app.use((req, res, next) => {
    logger.logRequest(req);

    const originalSend = res.send;
    res.send = (...args) => {
      logger.logResponse(req, res, args[0]);
      return originalSend.apply(res, args);
    };

    next();
  });
};

export const setupErrorHandling = (app) => {
  app.use((err, req, res, next) => {
    logger.error("애플리케이션 오류:", err);

    const isDevelopment = process.env.NODE_ENV === "test";

    res.status(err.status || 500).json({
      message: err.message || "내부 서버 오류",
      ...(isDevelopment && { stack: err.stack }),
    });
  });
};
