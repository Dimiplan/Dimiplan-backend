---
hidden: true
noIndex: true
---

# README

## Dimiplan API Documentation

## https://dimiplan-1.gitbook.io/dimiplan - 상세 정보는 링크 참조

### 인증 API

#### 구글 로그인

- **Endpoint**: `/auth/google`
- **Method**: GET
- **Description**: 구글 로그인 페이지로 리다이렉트됩니다.
- **Redirect**:
  - 로그인 성공 후 사용자가 가입되어 있으면 프론트엔드 메인 페이지(`FRONT_HOST`)로 리다이렉트
  - 로그인 성공 후 사용자가 가입되어 있지 않으면 회원가입 페이지(`FRONT_HOST/signup`)로 리다이렉트

#### 구글 로그인 콜백

- **Endpoint**: `/auth/google/callback`
- **Method**: GET
- **Description**: 구글 로그인 후 콜백 처리를 담당합니다.
- **Redirect**:
  - 로그인 실패 시 로그인 실패 페이지(`FRONT_HOST/login/fail`)로 리다이렉트
  - 로그인 성공 & 가입된 사용자면 메인 페이지(`FRONT_HOST`)로 리다이렉트
  - 로그인 성공 & 미가입 사용자면 회원가입 페이지(`FRONT_HOST/signup`)로 리다이렉트

#### 로그아웃

- **Endpoint**: `/auth/logout`
- **Method**: GET
- **Description**: 로그아웃을 처리합니다.
- **Response**:
  - 200 OK: `{ "message": "Logged out" }`

#### 사용자 로그인(모바일)

- **Endpoint**: `/auth/login`
- **Method**: POST
- **Description**: 사용자 ID로 직접 로그인 (모바일용용)
- **Request Body**:

  ```json
  {
    "userId": "사용자 ID"
  }
  ```

- **Response**:
  - 200 OK: `{ "message": "로그인 성공" }`
  - 400 Bad Request: `{ "message": "사용자 ID가 필요합니다." }`
  - 404 Not Found: `{ "message": "사용자를 찾을 수 없습니다." }`
  - 500 Internal Server Error: `{ "message": "로그인 처리 중 오류가 발생했습니다." }` 또는 `{ "message": "서버 오류가 발생했습니다." }`

### 사용자 API

#### 사용자 정보 업데이트

- **Endpoint**: `/api/user/updateme`
- **Method**: POST
- **Description**: 현재 로그인된 사용자의 정보를 업데이트합니다.
- **Authentication**: 필요
- **Request Body**:

  ```json
  {
    "name": "사용자 이름(15글자 이하)",
    "grade": "학년(1~3)",
    "class": "반(1~6)",
    "email": "이메일",
    "profile_image": "프로필 이미지 URL"
  }
  ```

  - 모든 필드는 선택적입니다. 필요한 필드만 포함하면 됩니다.
  - 하나 이상의 필드가 필요합니다.

- **Response**:
  - 200 OK: `{ "message": "Updated" }`
  - 400 Bad Request: `{ "message": "Bad request" }` - 유효하지 않은 입력값 또는 업데이트할 필드가 없을 경우
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 500 Internal Server Error: `{ "message": "Internal server error" }`

#### 사용자 등록 여부 확인

- **Endpoint**: `/api/user/registered`
- **Method**: GET
- **Description**: 현재 로그인된 사용자의 등록 여부를 확인합니다.
- **Authentication**: 필요
- **Response**:
  - 200 OK: `{ "registered": true|false }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`

#### 사용자 정보 조회

- **Endpoint**: `/api/user/whoami`
- **Method**: GET
- **Description**: 현재 로그인된 사용자의 정보를 조회합니다.
- **Authentication**: 필요
- **Response**:

  - 200 OK:

    ```json
    {
      "id": "구글 계정 ID(str)",
      "name": "이름(str)",
      "grade": "학년(1~3 int)",
      "class": "반(1~6 int)",
      "email": "이메일(str)",
      "profile_image": "프로필 사진 URL(str)"
    }
    ```

  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 404 Not Found: `{ "message": "User not found" }`

### 플랜 API

#### 루트 폴더 생성

- **Endpoint**: `/api/plan/createRootFolder`
- **Method**: POST
- **Description**: 사용자의 루트 폴더를 생성합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Response**:
  - 201 Created: `{ "message": "Root folder created" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 409 Conflict: `{ "message": "Root folder already exists" }`

#### 폴더 추가

- **Endpoint**: `/api/plan/addFolder`
- **Method**: POST
- **Description**: 새 폴더를 추가합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Request Body**:

  ```json
  {
    "name": "폴더 이름",
    "from": "상위 폴더 ID(-1 또는 폴더 ID)"
  }
  ```

  - 참고: 폴더 이름은 "Root", "root", "new", "all"일 수 없으며, ".pn"으로 끝날 수 없습니다.

- **Response**:
  - 200 OK: (성공적으로 생성됨)
  - 400 Bad Request: `{ "message": "Name and from are required" }` 또는 `{ "message": "Invalid folder name" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Folder not found" }` - 상위 폴더가 존재하지 않을 경우

#### 플래너 추가

- **Endpoint**: `/api/plan/addPlanner`
- **Method**: POST
- **Description**: 새 플래너를 추가합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Request Body**:

  ```json
  {
    "name": "플래너 이름",
    "isDaily": 0 또는 1,
    "from": "폴더 ID"
  }
  ```

- **Response**:
  - 201 Created: `{ "message": "Planner added successfully" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Folder not found" }`
  - 409 Conflict: `{ "message": "Same planner already exists" }`

#### 계획 추가

- **Endpoint**: `/api/plan/addPlan`
- **Method**: POST
- **Description**: 새 계획을 추가합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Request Body**:

  ```json
  {
    "contents": "계획 내용",
    "priority": "우선순위 (숫자)",
    "from": "플래너 ID",
    "startDate": "시작일 (YYYY-MM-DD, 선택적)",
    "dueDate": "마감일 (YYYY-MM-DD, 선택적)"
  }
  ```

- **Response**:
  - 201 Created: `{ "message": "Plan added successfully" }`
  - 400 Bad Request: `{ "message": "Contents and from are required" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Planner not found" }`

#### 계획 삭제

- **Endpoint**: `/api/plan/deletePlan`
- **Method**: POST
- **Description**: 계획을 삭제합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Request Body**:

  ```json
  {
    "id": "계획 ID"
  }
  ```

- **Response**:
  - 200 OK: `{ "message": "Plan deleted successfully" }`
  - 400 Bad Request: `{ "message": "Id is required" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`

#### 계획 완료 처리

- **Endpoint**: `/api/plan/completePlan`
- **Method**: POST
- **Description**: 계획을 완료 처리합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Request Body**:

  ```json
  {
    "id": "계획 ID"
  }
  ```

- **Response**:
  - 200 OK: `{ "message": "Plan completed successfully" }`
  - 400 Bad Request: `{ "message": "Id is required" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`

#### 모든 계획 조회

- **Endpoint**: `/api/plan/getEveryPlan`
- **Method**: GET
- **Description**: 사용자의 모든 계획을 조회합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Response**:
  - 200 OK: 계획 목록 배열
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Plan not found" }`

#### 플래너 내 계획 조회

- **Endpoint**: `/api/plan/getPlanInPlanner`
- **Method**: GET
- **Description**: 특정 플래너 내의 계획을 조회합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Query Parameters**:
  - `id`: 플래너 ID
- **Response**:
  - 200 OK: 계획 목록 배열 (우선순위 및 ID로 정렬됨)
  - 400 Bad Request: `{ "message": "Id is required" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Planner not found" }`

#### 플래너 정보 조회

- **Endpoint**: `/api/plan/getPlannerInfoByID`
- **Method**: GET
- **Description**: 특정 플래너의 정보를 조회합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Query Parameters**:
  - `id`: 플래너 ID
- **Response**:
  - 200 OK: 플래너 정보 객체
  - 400 Bad Request: `{ "message": "Bad Request" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Planner not found" }`
  - 500 Internal Server Error: `{ "message": "Error retrieving planner", "error": "오류 메시지" }`

#### 폴더 내 플래너 조회

- **Endpoint**: `/api/plan/getPlannersInFolder`
- **Method**: GET
- **Description**: 특정 폴더 내의 플래너 목록을 조회합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Query Parameters**:
  - `id`: 폴더 ID\
    또는
  - `from`: 상위 폴더 ID
  - `name`: 폴더 이름
- **Response**:
  - 200 OK: 플래너 목록 배열 (isDaily 및 ID로 정렬됨)
  - 400 Bad Request: `{ "message": "Id or (from + name) is required" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Planner not found" }`
  - 500 Internal Server Error: `{ "message": "Error retrieving folder", "error": "오류 메시지" }` 또는 `{ "message": "Error retrieving planners", "error": "오류 메시지" }`

#### 폴더 내 하위 폴더 조회

- **Endpoint**: `/api/plan/getFoldersInFolder`
- **Method**: GET
- **Description**: 특정 폴더 내의 하위 폴더 목록을 조회합니다.
- **Authentication**: 필요 & 등록된 사용자만 가능
- **Query Parameters**:
  - `id`: 폴더 ID\
    또는
  - `from`: 상위 폴더 ID
  - `name`: 폴더 이름
- **Response**:
  - 200 OK: 폴더 목록 배열 (ID로 정렬됨)
  - 400 Bad Request: `{ "message": "Id or (from + name) is required" }`
  - 401 Unauthorized: `{ "message": "Not authenticated" }`
  - 403 Forbidden: `{ "message": "Not registered" }`
  - 404 Not Found: `{ "message": "Folders not found" }`
  - 500 Internal Server Error: `{ "message": "Error retrieving folders", "error": "오류 메시지" }`

### 데이터 스키마

#### User 스키마

```
{
  id: string,           // 구글 계정 ID
  name: string | null,  // 사용자 이름
  grade: number | null, // 학년 (1-3)
  class: number | null, // 반 (1-6)
  email: string,        // 이메일
  profile_image: string // 프로필 이미지 URL
}
```

#### Folder 스키마

```
{
  owner: string, // 사용자 ID
  id: number,    // 폴더 ID
  from: number,  // 상위 폴더 ID (-1은 최상위)
  name: string   // 폴더 이름
}
```

#### Planner 스키마

```
{
  owner: string,  // 사용자 ID
  id: number,     // 플래너 ID
  from: number,   // 소속 폴더 ID
  isDaily: number, // 일일 플래너 여부 (0 또는 1)
  name: string    // 플래너 이름
}
```

#### Plan 스키마

```
{
  owner: string,     // 사용자 ID
  startDate: date,   // 시작일
  dueDate: date,     // 마감일
  contents: string,  // 계획 내용
  from: number,      // 소속 플래너 ID
  isCompleted: number, // 완료 여부 (0 또는 1)
  id: number,        // 계획 ID
  priority: number   // 우선순위
}
```

### 개발 정보

#### 환경 변수

프로젝트를 실행하려면 다음 환경 변수가 필요합니다:

- `DB_HOST`: 데이터베이스 호스트
- `DB_PORT`: 데이터베이스 포트
- `DB_USER`: 데이터베이스 사용자
- `DB_PASS`: 데이터베이스 비밀번호
- `DB_NAME`: 데이터베이스 이름
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `SESSION_SECRET`: 세션 암호화 키
- `FRONT_HOST`: 프론트엔드 호스트 URL

#### 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```
