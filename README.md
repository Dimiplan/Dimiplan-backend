# Dimiplan Backend

Express.js 기반의 안전하고 확장 가능한 플래너 및 AI 채팅 백엔드 서비스입니다.

## 🌟 주요 기능

- **사용자 관리**: Google OAuth 기반 인증 시스템
- **플래너 시스템**: 암호화된 개인 플래너 및 작업 관리
- **AI 채팅**: OpenRouter API를 통한 다중 AI 모델 지원
- **관리자 패널**: 시스템 모니터링 및 데이터베이스 관리
- **보안**: 전방위 데이터 암호화 및 보안 헤더
- **확장성**: Redis 세션 저장소 및 트랜잭션 지원

## 🛠 기술 스택

- **런타임**: Node.js (Bun 지원)
- **프레임워크**: Express.js
- **데이터베이스**: MySQL + Knex.js ORM
- **세션 저장소**: Redis
- **인증**: Passport.js (Google OAuth 2.0)
- **AI 서비스**: OpenRouter API
- **보안**: Helmet, CORS, Rate Limiting
- **로깅**: Winston
- **코드 품질**: ESLint, Prettier, JSDoc

## 🚀 빠른 시작

### 필수 요구사항

- Node.js 18+ 또는 Bun
- MySQL 8.0+
- Redis 6.0+

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/dimiplan-backend.git
cd dimiplan-backend

# 의존성 설치
bun install
# 또는
npm install
```

### 환경 설정

1. `.env` 파일 생성:

```env
# 서버 설정
NODE_ENV=development
PORT=3000
LOG_LEVEL=verbose

# 데이터베이스
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=dimiplan

# 암호화 키 (안전한 랜덤 값으로 변경 필요)
CRYPTO_MASTER_KEY=your_master_encryption_key
CRYPTO_MASTER_IV=your_master_iv
UID_SALT=your_uid_salt

# 세션 설정
SESSION_SECRET=your_session_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback

# OpenRouter AI
OPENROUTER_API_KEY=your_openrouter_api_key

# 프론트엔드 URL
FRONT_HOST=https://your-frontend-domain.com
```

2. SSL 인증서 설정:

```bash
# keys 디렉토리 생성
mkdir keys

# 개발용 자체 서명 인증서 생성
openssl req -x509 -newkey rsa:4096 -keyout keys/private.pem -out keys/public.pem -days 365 -nodes
```

### 데이터베이스 설정

```sql
-- MySQL 데이터베이스 생성
CREATE DATABASE dimiplan;
USE dimiplan;

-- DB.sql 파일 실행
SOURCE DB.sql;

-- 관리자 필드 추가 (필요시)
-- bun run src/scripts/addAdminField.mjs
```

### 실행

```bash
# 개발 모드
bun run dev

# 프로덕션 모드
bun start

# 자동 Git Pull (개발용)
bun run auto-pull
```

## 📚 API 문서 (상세 정보는: https://admin.dimiplan.com/api-docs 참고)

### 인증 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/auth/google` | Google OAuth 로그인 |
| GET | `/auth/google/callback` | OAuth 콜백 |
| POST | `/auth/login` | 모바일 로그인 |
| GET | `/auth/logout` | 로그아웃 |

### 사용자 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/user/get` | 사용자 정보 조회 |
| POST | `/api/user/update` | 사용자 정보 업데이트 |
| GET | `/api/user/registered` | 등록 상태 확인 |

### 플래너 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/planner/getPlanners` | 플래너 목록 조회 |
| POST | `/api/planner/add` | 플래너 생성 |
| POST | `/api/planner/rename` | 플래너 이름 변경 |
| POST | `/api/planner/delete` | 플래너 삭제 |

### 작업 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/task/get` | 작업 목록 조회 |
| POST | `/api/task/add` | 작업 생성 |
| POST | `/api/task/update` | 작업 수정 |
| POST | `/api/task/delete` | 작업 삭제 |
| POST | `/api/task/complete` | 작업 완료 |

### AI 채팅 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/ai/getRoomList` | 채팅방 목록 |
| POST | `/api/ai/addRoom` | 채팅방 생성 |
| GET | `/api/ai/getChatInRoom` | 채팅 메시지 조회 |
| POST | `/api/ai/auto` | 자동 AI 응답 |
| POST | `/api/ai/custom` | 수동 AI 모델 선택 |

## 🔐 보안 기능

### 데이터 암호화
- **사용자 데이터**: AES-256-CBC 암호화
- **사용자 ID**: SHA3-256 해싱 + 솔트
- **세션**: Redis 기반 안전한 저장

### 보안 헤더
- Content Security Policy (CSP)
- X-Frame-Options
- HTTP Strict Transport Security (HSTS)
- X-Content-Type-Options

### 요청 제한
- IP 기반 Rate Limiting
- 로그인 시도 제한
- 요청 크기 제한

## 🏗 프로젝트 구조

```
src/
├── config/          # 설정 파일
│   ├── app.mjs       # Express 앱 설정
│   ├── db.mjs        # 데이터베이스 설정
│   ├── sessionConfig.mjs # 세션 설정
│   └── ...
├── middleware/      # 미들웨어
│   ├── auth.mjs      # 인증 미들웨어
│   ├── security.mjs  # 보안 미들웨어
│   └── ...
├── models/          # 데이터 모델
│   ├── user.mjs      # 사용자 모델
│   ├── planner.mjs   # 플래너 모델
│   └── ...
├── routes/          # API 라우터
│   ├── auth.mjs      # 인증 라우터
│   └── api/          # API 라우터
├── services/        # 비즈니스 로직
├── utils/           # 유틸리티 함수
│   ├── crypto.mjs    # 암호화 유틸
│   ├── logger.mjs    # 로깅 유틸
│   └── ...
└── scripts/         # 관리 스크립트
```

## 🛠 개발 명령어

```bash
# 개발 서버 실행 (파일 감시)
bun run dev

# 코드 린팅
bun run lint

# 코드 포맷팅
bun run lint:fix

# API 문서 생성
bun run docs

# 문서 재생성
bun run docs:clean
```

## 🔍 모니터링 및 로깅

### 로그 레벨
- `error`: 치명적 오류
- `warn`: 경고 메시지
- `info`: 일반 정보
- `verbose`: 상세 로깅 (개발용)

### 로그 파일
- `logs/combined.log`: 모든 로그
- `logs/errors.log`: 오류 로그만

### 관리자 패널
- 시스템 상태 모니터링
- 데이터베이스 관리
- 로그 파일 조회
- AI 사용량 모니터링

## 🚀 배포

### 프로덕션 환경 변수
```env
NODE_ENV=production
LOG_LEVEL=info

# 강력한 암호화 키 설정
CRYPTO_MASTER_KEY=<64자 랜덤 문자열>
CRYPTO_MASTER_IV=<64자 랜덤 문자열>
UID_SALT=<64자 랜덤 문자열>
SESSION_SECRET=<64자 랜덤 문자열>
```

### SSL 인증서
프로덕션에서는 Let's Encrypt 또는 유효한 SSL 인증서를 사용하세요.

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### 코드 스타일
- ESLint + Prettier 설정 준수
- JSDoc 주석 작성 필수
- 보안 가이드라인 준수

## 📄 라이선스

This project is licensed under the ISC License.

## ⚠️ 중요 보안 노트

- 프로덕션 환경에서는 모든 암호화 키를 안전하게 관리하세요
- 환경 변수를 통해 민감한 정보를 관리하세요
- 정기적으로 의존성을 업데이트하세요
- SSL/TLS 인증서를 적절히 설정하세요

## 🆘 지원

문제가 발생하면 [Issues](https://github.com/your-org/dimiplan-backend/issues)를 통해 보고해 주세요.
