# Schema: inventory

**목적:** 상품 재고 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| inventory_id | INTEGER PRIMARY KEY | 재고 ID |
| product_id | INTEGER NOT NULL UNIQUE | 상품 ID |
| stock | INTEGER | 현재 재고 |
| reserved | INTEGER | 예약된 재고 |
| available | INTEGER | 판매 가능 |
| warehouse_id | INTEGER | 창고 ID |
| updated_at | INTEGER | 업데이트 시간 |

## 인덱스

- PRIMARY KEY: inventory_id
- UNIQUE: product_id
- INDEX: warehouse_id

## 샤딩 전략

- **샤딩 키**: warehouse_id (창고별 분산)

## 복제 설정

- **복제 방식**: Synchronous (정합성 중요)
- **복제 계수**: 3

## 특징

실시간 재고 추적 (높은 쓰기 빈도)
