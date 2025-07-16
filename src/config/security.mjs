import "./dotenv.mjs";

const getCSPDirectives = () => ({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", "data:", "https:"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: ["'none'"],
  mediaSrc: ["'self'"],
  manifestSrc: ["'self'"],
});

export const getSecurityConfig = () => ({
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
});
