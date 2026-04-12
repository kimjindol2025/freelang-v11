# FreeLang v9 Web App — 고정 에러 코드 체계

**목표**: 모든 SaaS가 동일한 에러 코드 사용 → 클라이언트가 일관된 처리

---

## 에러 코드 구조

### 형식: `CATEGORY_SPECIFIC`

```
AUTH_MISSING_HEADER       (인증 관련)
PERM_DENIED               (권한 관련)
VAL_REQUIRED              (검증 관련)
STATE_INVALID_TRANSITION  (상태 전이 관련)
RES_NOT_FOUND             (리소스 관련)
BIZ_INVALID_OPERATION     (비즈니스 로직 관련)
```

---

## 전체 에러 코드 목록

### 1. 인증 (AUTH_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `AUTH_MISSING_HEADER` | 401 | Missing Authorization header | Authorization 헤더 없음 |
| `AUTH_INVALID_FORMAT` | 401 | Invalid Authorization header format | Bearer 형식 아님 |
| `AUTH_INVALID_TOKEN` | 401 | Invalid or expired token | JWT 검증 실패 또는 만료 |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | 로그인 정보 불일치 |
| `AUTH_USER_DISABLED` | 401 | User account is disabled | 계정 비활성화됨 |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired | 토큰 만료 |

### 2. 권한 (PERM_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `PERM_DENIED` | 403 | Permission denied | 리소스 접근 불가 |
| `PERM_INSUFFICIENT_ROLE` | 403 | Insufficient role privileges | 역할 권한 부족 |
| `PERM_RESOURCE_OWNER_ONLY` | 403 | Only resource owner can access | 자신 리소스만 접근 가능 |
| `PERM_ADMIN_ONLY` | 403 | Admin access required | 관리자 전용 |

### 3. 검증 (VAL_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `VAL_REQUIRED` | 400 | Required field missing | 필수 필드 누락 |
| `VAL_INVALID_FORMAT` | 400 | Invalid format | 형식 오류 (이메일, 날짜 등) |
| `VAL_OUT_OF_RANGE` | 400 | Value out of range | 범위 초과 |
| `VAL_INVALID_ENUM` | 400 | Invalid enum value | 허용되지 않은 값 |
| `VAL_DUPLICATE` | 409 | Value already exists | 중복 값 |
| `VAL_FILE_TOO_LARGE` | 400 | File too large | 파일 크기 초과 |
| `VAL_INVALID_FILE_TYPE` | 400 | Invalid file type | 파일 형식 오류 |

### 4. 상태 전이 (STATE_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `STATE_INVALID_TRANSITION` | 409 | Invalid state transition | 허용되지 않은 상태 전이 |
| `STATE_INVALID_FOR_ROLE` | 403 | Role cannot perform this transition | 역할에 따른 전이 불가 |
| `STATE_RESOURCE_LOCKED` | 409 | Resource is locked for this operation | 리소스가 전이 불가 상태 |

### 5. 리소스 (RES_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `RES_NOT_FOUND` | 404 | Resource not found | 리소스 없음 |
| `RES_ALREADY_EXISTS` | 409 | Resource already exists | 리소스 중복 |
| `RES_IN_USE` | 409 | Resource is in use | 삭제 불가 (다른 리소스에서 사용) |
| `RES_DELETED` | 410 | Resource has been deleted | 리소스가 삭제됨 |

### 6. 비즈니스 로직 (BIZ_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `BIZ_INVALID_OPERATION` | 409 | Operation not allowed at this time | 현재 상태에서 불가 |
| `BIZ_INSUFFICIENT_DATA` | 400 | Insufficient data to complete operation | 필수 데이터 부족 |
| `BIZ_PRECONDITION_FAILED` | 400 | Precondition failed | 전제 조건 미충족 |
| `BIZ_QUOTA_EXCEEDED` | 429 | Quota exceeded | 할당량 초과 |

### 7. 시스템 (SYS_*)

| 코드 | HTTP | 메시지 | 상황 |
|------|------|--------|------|
| `SYS_INTERNAL_ERROR` | 500 | Internal server error | 서버 오류 |
| `SYS_INVALID_REQUEST` | 400 | Invalid request format | 요청 형식 오류 |
| `SYS_SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | 서비스 불가 |

---

## 응답 형식

### 에러 응답

```json
{
  "success": 0,
  "code": "AUTH_INVALID_TOKEN",
  "message": "Invalid or expired token",
  "details": {
    "field": "Authorization",
    "expected": "Bearer <token>"
  }
}
```

### 성공 응답

```json
{
  "success": 1,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

---

## FreeLang v9 구현

### core/constants.fl

```lisp
[FUNC get_error_codes [] {
  ; 인증
  "AUTH_MISSING_HEADER": 401,
  "AUTH_INVALID_FORMAT": 401,
  "AUTH_INVALID_TOKEN": 401,
  "AUTH_INVALID_CREDENTIALS": 401,
  "AUTH_USER_DISABLED": 401,
  "AUTH_TOKEN_EXPIRED": 401,

  ; 권한
  "PERM_DENIED": 403,
  "PERM_INSUFFICIENT_ROLE": 403,
  "PERM_RESOURCE_OWNER_ONLY": 403,
  "PERM_ADMIN_ONLY": 403,

  ; 검증
  "VAL_REQUIRED": 400,
  "VAL_INVALID_FORMAT": 400,
  "VAL_OUT_OF_RANGE": 400,
  "VAL_INVALID_ENUM": 400,
  "VAL_DUPLICATE": 409,
  "VAL_FILE_TOO_LARGE": 400,
  "VAL_INVALID_FILE_TYPE": 400,

  ; 상태 전이
  "STATE_INVALID_TRANSITION": 409,
  "STATE_INVALID_FOR_ROLE": 403,
  "STATE_RESOURCE_LOCKED": 409,

  ; 리소스
  "RES_NOT_FOUND": 404,
  "RES_ALREADY_EXISTS": 409,
  "RES_IN_USE": 409,
  "RES_DELETED": 410,

  ; 비즈니스
  "BIZ_INVALID_OPERATION": 409,
  "BIZ_INSUFFICIENT_DATA": 400,
  "BIZ_PRECONDITION_FAILED": 400,
  "BIZ_QUOTA_EXCEEDED": 429,

  ; 시스템
  "SYS_INTERNAL_ERROR": 500,
  "SYS_INVALID_REQUEST": 400,
  "SYS_SERVICE_UNAVAILABLE": 503
}]

[FUNC get_error_message [$code]
  :body (let [[$messages {
    "AUTH_MISSING_HEADER": "Missing Authorization header",
    "AUTH_INVALID_FORMAT": "Invalid Authorization header format",
    "AUTH_INVALID_TOKEN": "Invalid or expired token",
    ; ... 모든 코드의 메시지
  }]]
    (get $messages $code)
  )
]

[FUNC response_error_by_code
  :params [$code $custom_message $details]
  :body (let [[$http_code (get (get_error_codes) $code)]
              [$message (if $custom_message $custom_message (get_error_message $code))]]
    (do
      (server_status $http_code)
      (server_json {
        "success": 0,
        "code": $code,
        "message": $message,
        "details": $details
      })
    )
  )
]
```

---

## 사용 예시

### 로그인 핸들러

```lisp
[FUNC handle_login [$req $db_path $jwt_secret]
  :body (let [[$body (extract_json (server_req_body $req))]
              [$email (get $body "email")]
              [$password (get $body "password")]]

    ; 검증
    (if (not $email)
      (response_error_by_code "VAL_REQUIRED" "email field is required" nil)

      ; DB 조회
      (let [[$users (db_query $db_path "SELECT * FROM users WHERE email = ? AND is_active = 1" [$email])]]
        (if (not (> (length $users) 0))
          (response_error_by_code "AUTH_INVALID_CREDENTIALS" nil nil)

          ; 비밀번호 검증
          (let [[$user (first $users)]]
            (if (not (auth_verify_password $password (get $user "password_hash")))
              (response_error_by_code "AUTH_INVALID_CREDENTIALS" nil nil)

              ; JWT 발급
              (let [[$token (auth_jwt_sign {"user_id": (get $user "id")} $jwt_secret 86400)]]
                (server_json {
                  "success": 1,
                  "token": $token,
                  "user": (get $user "id")
                })
              )
            )
          )
        )
      )
    )
  )
]
```

---

## 클라이언트 처리 예시 (JavaScript)

```javascript
async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!data.success) {
    switch (data.code) {
      case 'VAL_REQUIRED':
        alert('이메일과 비밀번호를 입력하세요');
        break;
      case 'AUTH_INVALID_CREDENTIALS':
        alert('이메일 또는 비밀번호가 잘못되었습니다');
        break;
      case 'AUTH_USER_DISABLED':
        alert('계정이 비활성화되었습니다');
        break;
      case 'SYS_INTERNAL_ERROR':
        alert('서버 오류가 발생했습니다');
        break;
      default:
        alert(`오류: ${data.message}`);
    }
  } else {
    localStorage.setItem('token', data.token);
    window.location.href = '/dashboard';
  }
}
```

---

## 마이그레이션 가이드

### Field Ops SaaS 기존 코드 → 새 코드

**Before**:
```lisp
(server_status 401 {"success": 0, "code": "UNAUTHORIZED", "error": "Invalid token"})
```

**After**:
```lisp
(response_error_by_code "AUTH_INVALID_TOKEN" nil nil)
```

**모든 에러 응답을 표준화함으로써:**
- ✅ 클라이언트 코드 단순화
- ✅ 모든 SaaS에서 동일한 처리
- ✅ 에러 추적 용이
- ✅ 문서화 자동화 가능
