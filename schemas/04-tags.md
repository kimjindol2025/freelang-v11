# Schema: tags

**목적:** 게시물 태그 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| tag_id | INTEGER PRIMARY KEY | 태그 ID |
| tag_name | STRING NOT NULL UNIQUE | 태그명 (검색 대상) |
| description | STRING | 태그 설명 |
| post_count | INTEGER | 게시물 수 |
| created_at | INTEGER | 생성 시간 |

## 인덱스

- PRIMARY KEY: tag_id
- UNIQUE: tag_name
- INDEX: post_count DESC (인기 태그)

## 샤딩 전략

- **샤딩 키**: tag_name (Hash-based)
- **샤드 분배**: Hash(tag_name) % 4

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3

## 쿼리 예시

```sql
SELECT * FROM tags WHERE tag_name = 'Python' ORDER BY post_count DESC;
SELECT TOP 10 * FROM tags ORDER BY post_count DESC;
```

## 전문 검색 대상

- **tag_name** (태그명)
- **description** (태그 설명)

**사용 사례:** 자동완성, 트렌딩 태그
