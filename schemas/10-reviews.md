# Schema: reviews

**목적:** 상품 리뷰 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| review_id | INTEGER PRIMARY KEY | 리뷰 ID |
| product_id | INTEGER NOT NULL | 상품 ID |
| user_id | INTEGER NOT NULL | 작성자 ID |
| rating | INTEGER | 평점 (1-5) |
| title | STRING | 리뷰 제목 (검색 대상) |
| content | STRING | 리뷰 내용 (검색 대상) |
| helpful_count | INTEGER | 도움이 됨 수 |
| created_at | INTEGER | 작성 시간 |

## 인덱스

- PRIMARY KEY: review_id
- FOREIGN KEY: product_id, user_id
- INDEX: product_id, rating (평점순)
- FULLTEXT INDEX: title, content

## 샤딩 전략

- **샤딩 키**: product_id

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2

## 전문 검색 대상

- **title** (리뷰 제목)
- **content** (리뷰 내용)
