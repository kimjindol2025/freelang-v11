# FreeLang v11 플러그인 가이드

## 개요

FreeLang v11의 플러그인 시스템(Y5)은 **AI 에이전트가 자동으로 플러그인을 발견, 설치, 사용**할 수 있도록 설계되었습니다.

## 플러그인 구조

### 메타 블록 (필수)

```fl
;; plugin: <name>
;; version: <semver>
;; description: <한 줄 설명>
;; depends: <의존성 리스트>
```

### 함수 이름 규약

**네임스페이스**: `<plugin-name>/<function-name>`

```fl
;; ✅ 올바른 네임스페이스
[FUNC auth/generate-token :params [$user-id] ...]
[FUNC auth/verify-token :params [$token] ...]

;; ❌ 잘못된 네임스페이스 (플러그인 이름 누락)
[FUNC generate-token :params [$user-id] ...]
```

JavaScript에서는 자동으로 `/`를 `_`로 변환됩니다:
```javascript
// auth/generate-token → auth_generate_token
const result = await auth_generate_token(userId);
```

## 플러그인 설치 & 발견

### 1단계: 플러그인 발견

AI가 필요한 플러그인을 인식하면:

```fl
(use auth)
```

### 2단계: 자동 탐색 경로 (5단계)

FreeLang은 다음 순서로 플러그인을 찾습니다:

1. `./plugins/<name>.fl` (로컬 프로젝트)
2. `~/.fl/plugins/<name>.fl` (사용자 플러그인)
3. `self/stdlib/<name>.fl` (stdlib)
4. `<name>.fl` (현재 디렉터리)
5. `<name>` (시스템 명령)

### 3단계: 설치

```bash
# 플러그인 설치 (gogs 레지스트리에서)
make install-plugin NAME=auth

# 또는 수동으로
curl https://gogs.dclub.kr/kim/fl-plugins/raw/master/auth.fl > ~/.fl/plugins/auth.fl
```

### 4단계: AI Prompt 자동 동기화

```bash
# AI System Prompt 갱신
make gen-ai-prompt

# 결과: docs/AI_SYSTEM_PROMPT.md에 auth/* 함수 자동 추가
```

## 예시: auth 플러그인

### 설치

```bash
make install-plugin NAME=auth
make gen-ai-prompt
```

### 사용

```fl
(use auth)

;; 토큰 생성
(let [[$token (auth/generate-token "user123" "secret-key" 3600)]]
  (println (str "Token: " $token)))

;; 토큰 검증
(let [[$result (auth/verify-token $token "secret-key")]]
  (if (get $result :valid)
    (println (str "User: " (get $result :user-id)))
    (println (get $result :error))))

;; 토큰 만료 확인
(if (auth/is-token-expired $token)
  (println "Token expired")
  (println "Token valid"))
```

## 플러그인 배포

### 1단계: 플러그인 작성

```fl
;; plugin: myauth
;; version: 1.0.0
;; description: 커스텀 인증
;; depends: crypto

[FUNC myauth/login :params [$user $pass] ...]
[FUNC myauth/logout :params [$user] ...]
```

### 2단계: 배포

```bash
# gogs 레지스트리에 등록
node bootstrap.js run --plugin-publish plugins/myauth.fl

# 또는 CLI 사용
freelang publish plugins/myauth.fl
```

이제 다른 사용자가 설치 가능:
```bash
make install-plugin NAME=myauth
```

## AI 플러그인 발견 흐름

```
AI 코드: (use auth)
         ↓
FreeLang 해석기: (use 'auth)
         ↓
Stage 1 탐색: ~/.fl/plugins/auth.fl 찾음
         ↓
로드 성공
         ↓
AI Prompt 갱신 필요
         ↓
make gen-ai-prompt 실행
         ↓
AI_SYSTEM_PROMPT.md 갱신:
  - auth/generate-token
  - auth/verify-token
  - auth/is-token-expired
  - auth/decode-token
         ↓
다음 AI 세션: (use auth) 즉시 인식
```

## 베스트 프랙티스

### ✅ 좋은 예시

1. **명확한 네임스페이스**
   ```fl
   [FUNC payment/charge :params ...]
   [FUNC payment/refund :params ...]
   ```

2. **일관된 구조**
   ```fl
   ;; 각 함수: 입력 검증 → 처리 → 결과 반환
   [FUNC crypto/hash :params [$data]
     :body (if (nil? $data) 
             {:error "data required"}
             {:hash (sha256 $data)})]
   ```

3. **명확한 메타 정보**
   ```fl
   ;; plugin: jwt-auth
   ;; version: 2.1.0
   ;; description: JWT token generation and verification
   ;; depends: crypto, time
   ;; author: kim@dclub.kr
   ;; license: MIT
   ```

### ❌ 피해야 할 것

1. **전역 함수명** (네임스페이스 누락)
   ```fl
   ;; 이건 안 됨!
   [FUNC generate-token ...]
   ```

2. **예약어 사용** (RESERVED.md 참고)
   ```fl
   ;; 이건 안 됨!
   [FUNC loop/execute ...]
   ```

3. **명확하지 않은 의도**
   ```fl
   ;; 함수의 목적이 불명확
   [FUNC auth/x :params [$y] ...]
   ```

## 문제 해결

### 플러그인을 못 찾는 경우

```bash
# 1. 파일 위치 확인
ls ~/.fl/plugins/auth.fl

# 2. 메타 블록 확인
head -5 ~/.fl/plugins/auth.fl
# 꼭 필요: ;; plugin: auth

# 3. Prompt 재생성
make gen-ai-prompt

# 4. 플러그인 재로드
node bootstrap.js run <your-script.fl>
```

### 함수를 못 찾는 경우

```bash
# AI_SYSTEM_PROMPT.md 확인
grep "auth/" docs/AI_SYSTEM_PROMPT.md

# 없으면 재생성
make gen-ai-prompt
```

## 참고 자료

- [RESERVED.md](../RESERVED.md) — 예약어 목록
- [AI_SYSTEM_PROMPT.md](./AI_SYSTEM_PROMPT.md) — 생성된 AI 프롬프트
- [plugins/](../plugins/) — 예시 플러그인
