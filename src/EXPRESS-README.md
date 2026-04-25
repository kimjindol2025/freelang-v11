# Express.fl — FreeLang v11 웹 프레임워크

FreeLang v11으로 만든 Express.js 스타일 간단한 웹 프레임워크입니다.

## 기능

✅ GET/POST/PUT/PATCH/DELETE 라우팅  
✅ JSON 요청/응답  
✅ 경로 파라미터 (`:id`)  
✅ 쿼리 파라미터 & 헤더 접근  
✅ HTTP 상태 코드 지정  
✅ 미들웨어 체인 (선택사항)  

## 사용법

```lisp
(load "src/express.fl")

;; 핸들러 정의
[FUNC hello :params [$req]
  :body (res-json { :message "Hello!" })
]

;; 라우트 등록
(do
  (app-get "/" "hello")
  (app-listen 3000)
)
```

## API 레퍼런스

### 라우팅

```lisp
(app-get "/path" "handler-name")
(app-post "/path" "handler-name")
(app-put "/path" "handler-name")
(app-patch "/path" "handler-name")
(app-delete "/path" "handler-name")
(app-listen 3000)
```

### 응답

```lisp
(res-json { :key "value" })          ; JSON 응답
(res-send "text")                     ; text/plain 응답
(res-html "<h1>Hello</h1>")          ; text/html 응답
(res-status 201 { :id 123 })         ; 상태 코드 지정
```

### 요청

```lisp
[FUNC handler :params [$req]
  :body (let [
    id (req-param $req "id")            ; 경로 파라미터
    name (req-query $req "name")        ; 쿼리 파라미터
    body (req-body $req)                ; JSON body
    auth (req-header $req "Authorization")  ; 헤더
  ]
    (res-json { :id id :name name })
  )
]
```

## 실행

```bash
cd /root/kim/freelang-v11
node bootstrap.js run src/express-example.fl
```

## 테스트

```bash
# 홈페이지
curl http://localhost:3000/

# 사용자 목록
curl http://localhost:3000/api/users

# 특정 사용자
curl http://localhost:3000/api/users/123

# 사용자 생성
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@example.com"}'

# 사용자 업데이트
curl -X PUT http://localhost:3000/api/users/123 \
  -H "Content-Type: application/json" \
  -d '{"name":"updated"}'

# 사용자 삭제
curl -X DELETE http://localhost:3000/api/users/123
```

## 파일 구조

```
src/
├── express.fl              # 메인 프레임워크
├── express-example.fl      # 사용 예제
└── EXPRESS-README.md       # 이 문서
```

## 주의사항

- 함수명은 **문자열로** 전달 (예: `"hello"` O, `hello` X)
- 핸들러는 `$req` 파라미터 하나만 받음
- JSON 파싱 실패 시 빈 객체 `{}` 반환

## 다음 단계

- [ ] 미들웨어 개선 (인증, CORS, 로깅)
- [ ] 에러 핸들러 (try/catch)
- [ ] 정적 파일 제공
- [ ] WebSocket 지원
