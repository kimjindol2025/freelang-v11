# Schema: posts

**목적:** 사용자 게시물 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| post_id | INTEGER PRIMARY KEY | 게시물 ID |
| user_id | INTEGER NOT NULL | 작성자 ID (FK) |
| title | STRING NOT NULL | 제목 (검색 대상) |
| content | STRING NOT NULL | 본문 (검색 대상) |
| tags | STRING | 태그 (쉼표 구분) |
| likes_count | INTEGER | 좋아요 수 |
| comments_count | INTEGER | 댓글 수 |
| created_at | INTEGER | 생성 시간 |
| updated_at | INTEGER | 수정 시간 |
| is_published | BOOLEAN | 발행 여부 |

## 인덱스

- PRIMARY KEY: post_id
- FOREIGN KEY: user_id
- INDEX: user_id, created_at (사용자별 조회)
- INDEX: is_published, created_at (최신 게시물)
- FULLTEXT INDEX: title, content (전문 검색)

## 샤딩 전략

- **샤딩 키**: user_id (게시물은 작성자별로 분산)
- **샤드 분배**: 동일 사용자의 게시물은 같은 샤드

## 복제 설정

- **복제 방식**: Asynchronous (처리량 중요)
- **복제 계수**: 2 (Master + 1 Slave)

## 쿼리 예시

```sql
SELECT * FROM posts WHERE user_id = 100 ORDER BY created_at DESC;
SELECT * FROM posts WHERE title LIKE '%AI%' AND is_published = true;
SELECT COUNT(*) FROM posts WHERE created_at > 1704067200;
```

## 전문 검색 대상

- **title** (게시물 제목) - 높은 가중치
- **content** (게시물 본문) - 낮은 가중치
- **tags** (태그)

**예:** "머신러닝" 검색 → title, content, tags 모두 검색
