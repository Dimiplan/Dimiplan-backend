/**
 * 보안 설정 모듈
 * HTTP 보안 헤더 및 애플리케이션 보안 정책을 관리합니다
 *
 * @fileoverview 보안 헤더 및 정책 설정 관리
 */

import "./dotenv.mjs";

/**
 * Content Security Policy(CSP) 지시문을 정의합니다
 * XSS 공격 방지를 위한 콘텐츠 보안 정책을 설정합니다
 *
 * @returns {object} CSP 지시문 객체
 */
const getCSPDirectives = () => ({
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // 인라인 스크립트 허용 (필요시)
    styleSrc: ["'self'", "'unsafe-inline'"], // 인라인 스타일 허용
    imgSrc: ["'self'", "data:", "https:"], // 이미지 소스 허용
    connectSrc: ["'self'"], // AJAX, WebSocket 등 연결 허용
    fontSrc: ["'self'", "data:", "https:"], // 폰트 소스 허용
    baseUri: ["'self'"], // base 태그에서 사용할 수 있는 URL
    objectSrc: ["'none'"], // object, embed, applet 태그 차단
    frameSrc: ["'none'"], // iframe 차단
    mediaSrc: ["'self'"], // 미디어 소스 허용
    manifestSrc: ["'self'"], // 웹 앱 매니페스트 허용
});

/**
 * Helmet 보안 설정을 생성합니다
 * 다양한 보안 헤더를 자동으로 설정합니다
 *
 * @returns {object} Helmet 설정 객체
 * @example
 * const securityConfig = getSecurityConfig();
 * app.use(helmet(securityConfig));
 */
export const getSecurityConfig = () => ({
    // Content Security Policy 설정
    contentSecurityPolicy: {
        directives: getCSPDirectives(),
        reportOnly: false, // 위반 시 차단 (true면 보고만)
    },

    // Cross-Origin-Embedder-Policy 설정
    crossOriginEmbedderPolicy: {
        policy: "require-corp",
    },

    // Cross-Origin-Opener-Policy 설정
    crossOriginOpenerPolicy: {
        policy: "same-origin",
    },

    // Cross-Origin-Resource-Policy 설정
    crossOriginResourcePolicy: {
        policy: "cross-origin",
    },

    // DNS Prefetch Control
    dnsPrefetchControl: {
        allow: false,
    },

    // Frameguard (X-Frame-Options)
    frameguard: {
        action: "deny", // 모든 iframe 차단
    },

    // Hide Powered-By Header
    hidePoweredBy: true,

    // HTTP Strict Transport Security
    hsts: {
        maxAge: 31536000, // 1년
        includeSubDomains: true,
        preload: true,
    },

    // IE No Open
    ieNoOpen: true,

    // No Sniff (X-Content-Type-Options)
    noSniff: true,

    // Origin Agent Cluster
    originAgentCluster: true,

    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: {
        permittedPolicies: "none",
    },

    // Referrer Policy
    referrerPolicy: {
        policy: ["no-referrer", "strict-origin-when-cross-origin"],
    },

    // X-XSS-Protection
    xssFilter: true,
});

/**
 * 개발 환경용 완화된 보안 설정을 생성합니다
 * 개발 편의성을 위해 일부 보안 정책을 완화합니다
 *
 * @returns {object} 개발용 Helmet 설정 객체
 */
export const getDevSecurityConfig = () => {
    const baseConfig = getSecurityConfig();

    return {
        ...baseConfig,
        // 개발 환경에서는 CSP 완화
        contentSecurityPolicy: {
            directives: {
                ...getCSPDirectives(),
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // eval 허용
                connectSrc: ["'self'", "ws:", "wss:"], // WebSocket 허용
            },
            reportOnly: true, // 위반 시 차단하지 않고 보고만
        },

        // HSTS 비활성화 (HTTP 개발 환경)
        hsts: false,
    };
};

/**
 * 환경에 따른 적절한 보안 설정을 반환합니다
 *
 * @returns {object} 환경별 보안 설정 객체
 * @example
 * const config = getEnvironmentSecurityConfig();
 * app.use(helmet(config));
 */
export const getEnvironmentSecurityConfig = () => {
    const isDevelopment = process.env.NODE_ENV === "test";
    return isDevelopment ? getDevSecurityConfig() : getSecurityConfig();
};
