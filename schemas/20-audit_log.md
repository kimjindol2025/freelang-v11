# Schema: audit_log

**목적:** 감사 로그 (규정 준수, 추적)

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| audit_id | INTEGER PRIMARY KEY | 감사 로그 ID |
| user_id | INTEGER | 사용자 ID |
| action | STRING | 작업 타입 (CREATE/READ/UPDATE/DELETE) |
| resource_type | STRING | 리소스 타입 (검색 대상) |
| resource_id | INTEGER | 리소스 ID |
| old_value | STRING | 변경 전 값 |
| new_value | STRING | 변경 후 값 |
| change_reason | STRING | 변경 이유 (검색 대상) |
| ip_address | STRING | IP 주소 |
| created_at | INTEGER | 시간 |

## 인덱스

- PRIMARY KEY: audit_id
- INDEX: user_id, created_at (사용자별 활동)
- INDEX: resource_type, resource_id (리소스 히스토리)
- FULLTEXT INDEX: change_reason

## 샤딩 전략

- **샤딩 키**: user_id

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3

## 쿼리 예시

```sql
-- 사용자 활동 추적
SELECT * FROM audit_log WHERE user_id = 100 
ORDER BY created_at DESC;

-- 특정 리소스 변경 이력
SELECT * FROM audit_log WHERE resource_type = 'PRODUCT' 
AND resource_id = 500 ORDER BY created_at;

-- 감사 검색
SELECT * FROM audit_log WHERE change_reason LIKE '%삭제%';
```

## 특징

- Immutable (수정 불가)
- 장기 보관 (7년+)
- GDPR/CCPA 준수

## 전문 검색 대상

- **resource_type** (리소스 타입)
- **change_reason** (변경 이유)
