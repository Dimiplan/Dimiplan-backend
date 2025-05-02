/**
 * Logging utility
 * Provides structured logging capabilities with sensitive data filtering
 */
const winston = require("winston");
const { format, transports } = winston;
const fs = require("fs");
const path = require("path");
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

// Filter for sensitive data in logs - simplified for reliability
const filterSensitiveData = format((info) => {
  try {
    // Start with a shallow copy of the info object
    const filteredInfo = { ...info };

    // Ensure message is a string
    if (typeof filteredInfo.message !== "string") {
      if (filteredInfo.message === undefined) {
        filteredInfo.message = "";
      } else if (typeof filteredInfo.message === "object") {
        try {
          filteredInfo.message = safeStringify(filteredInfo.message);
        } catch (e) {
          filteredInfo.message = "[Complex object]";
        }
      } else {
        filteredInfo.message = String(filteredInfo.message);
      }
    }

    // Mask sensitive data in message strings
    if (filteredInfo.message) {
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

    return filteredInfo;
  } catch (error) {
    // Fallback if filtering fails
    return {
      level: info.level || "error",
      message: `Error in log filtering: ${error.message}`,
    };
  }
});

// Define log directory
const logDir = path.join(process.cwd(), "logs");

// Create logs directory if it doesn't exist
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });
  }
} catch (err) {
  console.error(`Failed to create logs directory: ${err.message}`);
}

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

// Create console formatter with colors
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf((info) => {
    if (info.error && info.error instanceof Error) {
      return `${info.timestamp} ${info.level}: ${info.message} - ${info.error.stack}`;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
  }),
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info", // Use environment variable or default to info
  levels,
  format: logFormat,
  transports: [
    // Console transport with colors
    new transports.Console({
      format: consoleFormat,
    }),

    // File transport for all logs - with explicit flags
    new transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      options: { flags: "a" }, // Append flag
    }),

    // Separate file for error logs - with explicit flags
    new transports.File({
      filename: path.join(logDir, "errors.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      options: { flags: "a" }, // Append flag
    }),
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

// Simple direct logging function
module.exports = {
  error: (message, meta = {}) => {
    try {
      logger.error(message, meta);
    } catch (err) {
      console.error(`Failed to log error: ${err.message}`);
      console.error(
        `Original message: ${typeof message === "object" ? JSON.stringify(message) : message}`,
      );
    }
  },
  warn: (message, meta = {}) => {
    try {
      logger.warn(message, meta);
    } catch (err) {
      console.error(`Failed to log warning: ${err.message}`);
    }
  },
  info: (message, meta = {}) => {
    try {
      logger.info(message, meta);
    } catch (err) {
      console.error(`Failed to log info: ${err.message}`);
    }
  },
  http: (message, meta = {}) => {
    try {
      logger.http(message, meta);
    } catch (err) {
      console.error(`Failed to log HTTP: ${err.message}`);
    }
  },
  debug: (message, meta = {}) => {
    try {
      logger.debug(message, meta);
    } catch (err) {
      console.error(`Failed to log debug: ${err.message}`);
    }
  },
  stream: logger.stream,
};
