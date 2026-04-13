# FreeLang v9 표준 라이브러리 (stdlib)

FreeLang v9는 실무 개발에 필요한 30개 이상의 표준 모듈을 포함합니다.

## 모듈 목록

### 핵심 (Core)
- **core** - 기본 함수 (map, filter, reduce, etc.)
- **types** - 타입 검사 및 변환
- **collections** - 벡터, 맵, 리스트 조작

### 파일 I/O
- **file** - 파일 읽기/쓰기
- **path** - 경로 조작
- **fs** - 파일시스템 (디렉토리, 권한)

### 네트워킹
- **net** - 소켓 통신
- **http** - HTTP 클라이언트/서버
- **ws** - WebSocket 지원

### 데이터베이스
- **db** - SQLite 쿼리
- **sql** - SQL 빌더
- **migration** - 마이그레이션 관리

### 암호화 & 보안
- **crypto** - 해싱, 암호화
- **jwt** - JWT 토큰
- **auth** - 인증 헬퍼

### 날짜/시간
- **time** - 시간 조작
- **date** - 날짜 처리
- **timezone** - 시간대 변환

### 데이터 분석
- **table** - 데이터프레임 조작
- **stats** - 통계 계산
- **plot** - 시각화 (ASCII/SVG)

### 테스트 & 모니터링
- **test** - 테스트 프레임워크
- **coverage** - 커버리지 측정
- **observe** - 메트릭/로깅/모니터링

### 마이크로서비스
- **service** - 서비스 정의
- **queue** - 메시지 큐
- **circuit** - Circuit Breaker
- **rpc** - RPC 통신

### 웹 프레임워크
- **flnext** - 웹 프레임워크
- **middleware** - 미들웨어 패턴
- **validation** - 입력 검증

### AI 기능
- **ai-core** - AI 블록
- **memory** - 메모리 관리
- **reasoning** - 추론 도구

---

## 주요 함수 예제

### file 모듈
```lisp
(file/read "path/to/file.txt")
(file/write "path/to/file.txt" "content")
(file/exists? "path/to/file.txt")
(file/delete "path/to/file.txt")
```

### http 모듈
```lisp
(http/get "https://api.example.com/users")
(http/post "https://api.example.com/users"
  {:body {...} :headers {...}})
(http/server {:port 3000 :routes [...]})
```

### db 모듈
```lisp
(db/open "sqlite:app.db")
(db/query "SELECT * FROM users WHERE id = ?" [1])
(db/execute "INSERT INTO users (name) VALUES (?)" ["John"])
```

### stats 모듈
```lisp
(stats/mean [1 2 3 4 5])        ; → 3
(stats/median [1 2 3 4 5])      ; → 3
(stats/stddev [1 2 3 4 5])      ; → √2
(stats/correlation x-values y-values)
```

### test 모듈
```lisp
(deftest "should add numbers"
  (assert (= (+ 1 2) 3)))

(run-tests)
(get-coverage)
```

---

## 모듈 import

```lisp
; 전체 모듈 import
(import http)
(http/get "...")

; 특정 함수만 import
(import [file :only [read write]])

; 별칭 사용
(import [http :as h])
(h/get "...")
```

---

## 다음 단계

- [언어 기초](../guide/basics.md)
- [프레임워크](../guide/frameworks.md)
- [예제](../examples/)

---

**상세 API 문서**: https://github.com/kimjindol2025/freelang-v9/tree/master/docs/api
