import logger from "../utils/logger.mjs";

const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-session-id",
  "x-api-key",
  "x-auth-token",
];

const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "key",
  "auth",
  "credential",
  "session",
];

const maskSensitiveHeaders = (headers) => {
  if (!headers || typeof headers !== "object") return headers;

  const maskedHeaders = { ...headers };

  Object.keys(maskedHeaders).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.some((sensitive) => lowerKey.includes(sensitive))) {
      maskedHeaders[key] = "[MASKED]";
    }
  });

  return maskedHeaders;
};

const maskSensitiveData = (data, depth = 0, maxDepth = 5) => {
  if (depth > maxDepth) return "[MAX_DEPTH_REACHED]";

  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, depth + 1, maxDepth));
  }

  const maskedData = {};
  Object.keys(data).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((sensitive) => lowerKey.includes(sensitive))) {
      maskedData[key] = "[MASKED]";
    } else {
      maskedData[key] = maskSensitiveData(data[key], depth + 1, maxDepth);
    }
  });

  return maskedData;
};

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
    ...(process.env.NODE_ENV === "test" && {
      body: maskSensitiveData(req.body),
    }),
  };

  logger.info("들어오는 요청:", requestInfo);
  next();
};

export const responseLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  const originalSend = res.send;
  const originalJson = res.json;

  res.send = (...args) => {
    logResponse(req, res, args[0], startTime);
    return originalSend.apply(res, args);
  };

  res.json = (...args) => {
    logResponse(req, res, args[0], startTime);
    return originalJson.apply(res, args);
  };

  next();
};

const logResponse = (req, res, body, startTime) => {
  const duration = Date.now() - startTime;

  const responseInfo = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    headers: maskSensitiveHeaders(res.getHeaders()),
    ...(process.env.NODE_ENV === "test" &&
      body && {
        bodySize: Buffer.byteLength(JSON.stringify(body), "utf8"),
        body:
          typeof body === "string" && body.length > 1000
            ? `${body.substring(0, 1000)}...[TRUNCATED]`
            : maskSensitiveData(body),
      }),
  };

  if (res.statusCode >= 500) {
    logger.error("응답 (서버 오류):", responseInfo);
  } else if (res.statusCode >= 400) {
    logger.warn("응답 (클라이언트 오류):", responseInfo);
  } else {
    logger.info("응답:", responseInfo);
  }
};

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

export const performanceMonitoringMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - startTime) / 1000000;
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    };

    if (duration > 1000 || Math.abs(memoryDiff.heapUsed) > 10 * 1024 * 1024) {
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
