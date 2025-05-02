/**
 * Logging utility
 * Provides structured logging capabilities with sensitive data filtering
 */
const winston = require("winston");
const { format, transports } = winston;
require("../config/dotenv"); // Load environment variables

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

/**
 * Safe JSON stringify that handles circular references
 * @param {Object} obj - Object to stringify
 * @returns {String} - JSON string
 */
const safeStringify = (obj) => {
  if (!obj) return String(obj);

  // Handle primitive types
  if (typeof obj !== "object") return String(obj);

  // Create a cache to store already processed objects
  const cache = new Set();

  // Custom replacer function to handle circular references
  const replacer = (key, value) => {
    // If value is an object and not null
    if (typeof value === "object" && value !== null) {
      // Skip circular references
      if (cache.has(value)) {
        return "[Circular Reference]";
      }
      cache.add(value);

      // Handle Error objects specially
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      // Skip complex objects like sockets, streams, etc.
      if (
        value.constructor &&
        ["Socket", "IncomingMessage", "ServerResponse", "HTTPParser"].includes(
          value.constructor.name,
        )
      ) {
        return `[${value.constructor.name}]`;
      }
    }
    return value;
  };

  try {
    return JSON.stringify(obj, replacer);
  } catch (error) {
    return `[Object Not Serializable: ${error.message}]`;
  }
};

// Filter for sensitive data in logs
const filterSensitiveData = format((info) => {
  try {
    // Handle simple string messages directly
    if (typeof info === "string") {
      return { message: info };
    }

    // Create a safe copy of the info object
    let filteredInfo;

    if (typeof info === "object") {
      // Use safe stringify and re-parse to create a deep copy without circular references
      try {
        filteredInfo = JSON.parse(safeStringify(info));
      } catch {
        // If parsing fails, create a new object with just the message
        filteredInfo = {
          level: info.level,
          message:
            typeof info.message === "string"
              ? info.message
              : "Non-serializable log message",
        };
      }
    } else {
      // For non-objects
      filteredInfo = { message: String(info) };
    }

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
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

      const filtered = {};

      Object.keys(obj).forEach((key) => {
        const lowerKey = key.toLowerCase();

        // Skip non-serializable properties
        if (
          key === "_events" ||
          key === "_eventsCount" ||
          key === "_readableState"
        ) {
          return;
        }

        // Redact sensitive fields
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("key") ||
          lowerKey.includes("auth")
        ) {
          filtered[key] = "[REDACTED]";
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          // Handle Error objects
          if (obj[key] instanceof Error) {
            filtered[key] = {
              name: obj[key].name,
              message: obj[key].message,
              stack: obj[key].stack,
            };
          } else {
            // Recursively filter nested objects
            filtered[key] = filterObject(obj[key]);
          }
        } else {
          filtered[key] = obj[key];
        }
      });

      return filtered;
    };

    // Apply filtering to all metadata
    Object.keys(filteredInfo).forEach((key) => {
      if (key !== "level" && key !== "message" && key !== "timestamp") {
        filteredInfo[key] = filterObject(filteredInfo[key]);
      }
    });

    return filteredInfo;
  } catch (error) {
    // Fallback if filtering fails
    return {
      level: info.level || "error",
      message: `Error in log filtering: ${error.message}`,
      original_message:
        typeof info.message === "string" ? info.message : "[Complex Object]",
    };
  }
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

// Make sure logs directory exists
const fs = require("fs");
const path = require("path");
const logDir = "logs";

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info", // Use environment variable or default to info
  levels,
  format: logFormat,
  transports: [
    // Console transport
    new transports.Console({
      format: format.combine(format.colorize({ all: true })),
    }),
    // File transport for all logs
    new transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for error logs
    new transports.File({
      filename: path.join(logDir, "errors.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

// Safe logging wrappers
const safeLog = (level, message, meta = {}) => {
  try {
    if (typeof message === "object" && message !== null) {
      // If message is an object, stringify it
      logger[level](JSON.stringify(message), meta);
    } else {
      logger[level](message, meta);
    }
  } catch (err) {
    console.error(`Failed to log message: ${err.message}`);
    console.error(
      `Original message: ${typeof message === "object" ? "[Object]" : message}`,
    );
  }
};

// Export safe logging methods with appropriate level check
module.exports = {
  error: (message, meta = {}) => safeLog("error", message, meta),
  warn: (message, meta = {}) => safeLog("warn", message, meta),
  info: (message, meta = {}) => safeLog("info", message, meta),
  http: (message, meta = {}) => safeLog("http", message, meta),
  debug: (message, meta = {}) => safeLog("debug", message, meta),
  stream: logger.stream,
};
