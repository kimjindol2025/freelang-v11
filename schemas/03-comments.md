# Schema: comments

**목적:** 게시물 댓글 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| comment_id | INTEGER PRIMARY KEY | 댓글 ID |
| post_id | INTEGER NOT NULL | 게시물 ID (FK) |
| user_id | INTEGER NOT NULL | 작성자 ID (FK) |
| content | STRING NOT NULL | 댓글 내용 (검색 대상) |
| parent_comment_id | INTEGER | 부모 댓글 ID (대댓글용) |
| likes_count | INTEGER | 좋아요 수 |
| created_at | INTEGER | 생성 시간 |
| is_deleted | BOOLEAN | 삭제 여부 (soft delete) |

## 인덱스

- PRIMARY KEY: comment_id
- FOREIGN KEY: post_id, user_id
- INDEX: post_id, created_at (게시물별 댓글 조회)
- INDEX: user_id (사용자 댓글 조회)
- FULLTEXT INDEX: content

## 샤딩 전략

- **샤딩 키**: post_id (게시물별로 댓글 분산)
- **샤드 분배**: 게시물 샤드와 동일

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2

## 쿼리 예시

```sql
SELECT * FROM comments WHERE post_id = 500 ORDER BY created_at;
SELECT * FROM comments WHERE content LIKE '%버그%' AND is_deleted = false;
```

## 전문 검색 대상

- **content** (댓글 내용)

**특징:** 계층형 댓글 지원 (parent_comment_id)
