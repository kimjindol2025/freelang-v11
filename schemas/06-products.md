# Schema: products

**목적:** 이커머스 상품 정보

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| product_id | INTEGER PRIMARY KEY | 상품 ID |
| sku | STRING UNIQUE | 상품 코드 |
| product_name | STRING NOT NULL | 상품명 (검색 대상) |
| description | STRING | 상품 설명 (검색 대상) |
| category_id | INTEGER | 카테고리 ID |
| price | DECIMAL | 가격 |
| stock | INTEGER | 재고 수 |
| rating | FLOAT | 평점 |
| image_url | STRING | 상품 이미지 |
| created_at | INTEGER | 등록 시간 |

## 인덱스

- PRIMARY KEY: product_id
- UNIQUE: sku
- INDEX: category_id (카테고리별 조회)
- INDEX: price (가격 범위 검색)
- FULLTEXT INDEX: product_name, description

## 샤딩 전략

- **샤딩 키**: category_id
- **샤드 분배**: 카테고리별로 분산

## 복제 설정

- **복제 방식**: Synchronous (재고 정확성 중요)
- **복제 계수**: 3

## 쿼리 예시

```sql
SELECT * FROM products WHERE category_id = 5 AND price BETWEEN 10000 AND 50000;
SELECT * FROM products WHERE product_name LIKE '%노트북%' ORDER BY rating DESC;
```

## 전문 검색 대상

- **product_name** (상품명) - 높은 가중치
- **description** (상품 설명)

**예:** "울트라북 저전력" 검색 → 이름과 설명에서 검색
