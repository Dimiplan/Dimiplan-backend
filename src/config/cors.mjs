import cors from "cors";
import "./dotenv.mjs";

const ALLOWED_DOMAINS = ["dimiplan.com", "dimiplan.workers.dev"];

const validateOrigin = (origin, callback) => {
  if (origin === "null" || !origin) {
    return callback(null, true);
  }

  const isAllowed = ALLOWED_DOMAINS.some(
    (domain) => origin.endsWith(`.${domain}`) || origin === `https://${domain}`,
  );

  if (isAllowed) {
    callback(null, true);
  } else {
    callback(
      new Error(`CORS 정책에 의해 허용되지 않은 요청: ${origin}`),
      false,
    );
  }
};

export const getCorsOptions = () => ({
  origin: validateOrigin,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id"],
  exposedHeaders: ["x-session-id"],
  maxAge: 86400,
  optionsSuccessStatus: 200,
});

export const getCorsConfig = () => {
  const options = getCorsOptions();
  return cors(options);
};

export const getCustomCorsConfig = (customOptions = {}) => {
  const defaultOptions = getCorsOptions();
  const mergedOptions = { ...defaultOptions, ...customOptions };
  return cors(mergedOptions);
};
