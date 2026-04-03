# Schema: sessions

**목적:** 사용자 로그인 세션 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| session_id | STRING PRIMARY KEY | 세션 ID |
| user_id | INTEGER NOT NULL | 사용자 ID |
| ip_address | STRING | IP 주소 |
| user_agent | STRING | 브라우저 정보 |
| token | STRING | 토큰 (검색 대상) |
| created_at | INTEGER | 생성 시간 |
| expires_at | INTEGER | 만료 시간 |
| is_active | BOOLEAN | 활성 여부 |

## 인덱스

- PRIMARY KEY: session_id
- INDEX: user_id (사용자 세션)
- INDEX: expires_at (만료된 세션 정리)

## 샤딩 전략

- **샤딩 키**: user_id

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2

## 특징

TTL (자동 만료) 지원
