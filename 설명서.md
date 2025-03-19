# (f)는 프론트엔드 host를 의미함.
# /auth
## [Redirect] /auth/google
- 구글 로그인 페이지.
- 로그인 후 유저가 가입되어있으면, (f)로 redirect시키고, 아니면 (f)/signup으로 redirect시킴.
## [Redirect] /auth/logout
- 로그아웃을 시키고 (f)로 redirect됨.
- - -
# /api
## /api/user
### [POST] /api/user/updateme
- query로 name(str), grade(1\~3), class(1\~6), email(str), profile_image(str)을 지원함.
- 만약 전부 유효한 값이 아니면 **400 Bad Request**를 반환함.
- 하나라도 update된다면 **200 Updated**를 반환함.
### [GET] /api/user/registered
- 비로그인시 **401 Not authenticated**를 반환함.
- 로그인시시 {registered: true|false}를 반환함.
### [GET] /api/user/whoami
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
- 비로그인시 **401 Not authenticated**를 반환함.
- 미가입시 **403 Not registered**를 반환함.
- 없는 사용자일 시 **404 User not found**를 반환함.
