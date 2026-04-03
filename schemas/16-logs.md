# Schema: logs

**목적:** 시스템 로그 기록

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| log_id | INTEGER PRIMARY KEY | 로그 ID |
| level | STRING | 로그 레벨 (INFO/WARN/ERROR) |
| service | STRING | 서비스명 |
| message | STRING | 로그 메시지 (검색 대상) |
| stack_trace | STRING | 스택 트레이스 |
| created_at | INTEGER | 시간 |

## 인덱스

- PRIMARY KEY: log_id
- INDEX: level, created_at (에러 로그 조회)
- INDEX: service
- FULLTEXT INDEX: message

## 샤딩 전략

- **샤딩 키**: service

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 1

## 특징

높은 쓰기 빈도, TTL로 자동 삭제

## 전문 검색 대상

- **message** (로그 메시지)
- **stack_trace** (에러 추적)

**예:** "NullPointerException" 검색
