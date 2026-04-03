# Schema: full_text_search_cache

**목적:** 전문 검색 결과 캐시 (성능 최적화)

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| cache_id | INTEGER PRIMARY KEY | 캐시 ID |
| query_hash | STRING UNIQUE | 쿼리 해시 |
| query | STRING | 원본 검색 쿼리 |
| result_ids | STRING | 결과 document_id (JSON) |
| result_count | INTEGER | 결과 수 |
| created_at | INTEGER | 캐시 생성 시간 |
| expires_at | INTEGER | 캐시 만료 시간 |
| hit_count | INTEGER | 캐시 히트 수 |

## 인덱스

- PRIMARY KEY: cache_id
- UNIQUE: query_hash
- INDEX: expires_at (만료된 캐시 정리)

## 샤딩 전략

- **샤딩 키**: query_hash % 4

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2

## 쿼리 예시

```sql
-- 캐시된 검색 결과 조회
SELECT result_ids FROM full_text_search_cache 
WHERE query_hash = MD5('머신러닝 가이드') AND expires_at > NOW();

-- 캐시 히트율 모니터링
SELECT SUM(hit_count) FROM full_text_search_cache;
```

## 특징

- TTL: 1시간 (자동 만료)
- LRU eviction: 용량 초과 시 최소 사용 캐시 제거
- 조회가 많은 검색 쿼리만 캐시됨

## 성능 개선

```
캐시 미사용: search_index 스캔 (50ms)
캐시 사용: 직접 반환 (5ms)
개선도: 10배 ⬆️
```
