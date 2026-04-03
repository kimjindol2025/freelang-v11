# Schema: hashtags

**목적:** 해시태그 트렌딩 (소셜 미디어)

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| hashtag_id | INTEGER PRIMARY KEY | 해시태그 ID |
| tag | STRING NOT NULL UNIQUE | 해시태그 (검색 대상) |
| post_count | INTEGER | 사용된 게시물 수 |
| trending_rank | INTEGER | 트렌드 순위 |
| daily_count | INTEGER | 오늘 사용 수 |
| created_at | INTEGER | 생성 시간 |
| updated_at | INTEGER | 마지막 업데이트 |

## 인덱스

- PRIMARY KEY: hashtag_id
- UNIQUE: tag
- INDEX: trending_rank (트렌드 조회)
- INDEX: daily_count DESC (인기순)
- FULLTEXT INDEX: tag

## 샤딩 전략

- **샤딩 키**: tag (Hash-based)

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2

## 쿼리 예시

```sql
-- 트렌딩 해시태그
SELECT tag, daily_count FROM hashtags 
ORDER BY daily_count DESC LIMIT 10;

-- 해시태그 자동완성
SELECT tag FROM hashtags WHERE tag LIKE '#검색%' LIMIT 5;
```

## 전문 검색 대상

- **tag** (해시태그 문자열)
