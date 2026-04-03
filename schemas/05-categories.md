# Schema: categories

**목적:** 게시물 카테고리 계층 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| category_id | INTEGER PRIMARY KEY | 카테고리 ID |
| parent_id | INTEGER | 부모 카테고리 ID |
| category_name | STRING NOT NULL UNIQUE | 카테고리명 (검색 대상) |
| description | STRING | 설명 |
| post_count | INTEGER | 게시물 수 |
| level | INTEGER | 계층 깊이 |

## 인덱스

- PRIMARY KEY: category_id
- UNIQUE: category_name
- INDEX: parent_id (계층 조회)

## 샤딩 전략

- **샤딩 키**: category_id (Range-based)

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3

## 쿼리 예시

```sql
SELECT * FROM categories WHERE parent_id = 1;
SELECT * FROM categories WHERE level <= 2 ORDER BY category_name;
```

## 전문 검색 대상

- **category_name** (카테고리명)

**특징:** 계층형 구조 (트리 구조)
