# Schema: order_items

**목적:** 주문 항목 (상품별 상세)

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| order_item_id | INTEGER PRIMARY KEY | 주문 항목 ID |
| order_id | INTEGER NOT NULL | 주문 ID |
| product_id | INTEGER NOT NULL | 상품 ID |
| quantity | INTEGER | 수량 |
| unit_price | DECIMAL | 단가 |
| subtotal | DECIMAL | 소계 |

## 인덱스

- PRIMARY KEY: order_item_id
- FOREIGN KEY: order_id, product_id

## 샤딩 전략

- **샤딩 키**: order_id (주문과 동일)

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3
