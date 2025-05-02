/**
 * Logging utility
 * Provides structured logging capabilities with sensitive data filtering
 */
const winston = require("winston");
const { format, transports } = winston;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

// Filter for sensitive data in logs
const filterSensitiveData = format((info) => {
  // Create a deep copy of the info object to avoid modifying the original
  const filteredInfo = JSON.parse(JSON.stringify(info));

  // Filter out sensitive fields if present in message string
  if (typeof filteredInfo.message === "string") {
    // Mask emails
    filteredInfo.message = filteredInfo.message.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[EMAIL REDACTED]",
    );

    // Mask potential auth tokens
    filteredInfo.message = filteredInfo.message.replace(
      /(token|jwt|auth|api|key)[:=]\s*['"]?\w+['"]?/gi,
      "$1: [REDACTED]",
    );

    // Mask potential password fields
    filteredInfo.message = filteredInfo.message.replace(
      /(password|passwd|pwd)[:=]\s*['"]?\w+['"]?/gi,
      "$1: [REDACTED]",
    );
  }

  // Filter metadata objects recursively
  const filterObject = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    Object.keys(obj).forEach((key) => {
      const lowerKey = key.toLowerCase();

      // Redact sensitive fields
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("key") ||
        lowerKey.includes("auth")
      ) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object") {
        obj[key] = filterObject(obj[key]);
      }
    });

    return obj;
  };

  // Apply filtering to all metadata
  Object.keys(filteredInfo).forEach((key) => {
    if (key !== "level" && key !== "message" && key !== "timestamp") {
      filteredInfo[key] = filterObject(filteredInfo[key]);
    }
  });

  return filteredInfo;
});

// Define logger format
const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  filterSensitiveData(),
  format.printf((info) => {
    // Handle error objects specially
    if (info.error && info.error instanceof Error) {
      return `${info.timestamp} ${info.level}: ${info.message} - ${info.error.stack}`;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
  }),
);

// Create the logger instance
const logger = winston.createLogger({
  level: "info",
  levels,
  format: logFormat,
  transports: [
    // Console transport
    new transports.Console({
      format: format.combine(format.colorize({ all: true })),
    }),
    // File transport for all logs
    new transports.File({
      filename: "logs/combined.log",
    }),
    // Separate file for error logs
    new transports.File({
      filename: "logs/errors.log",
      level: "error",
    }),
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
