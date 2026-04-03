# Schema: orders

**목적:** 주문 정보 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| order_id | INTEGER PRIMARY KEY | 주문 ID |
| user_id | INTEGER NOT NULL | 구매자 ID |
| order_number | STRING UNIQUE | 주문 번호 (검색 대상) |
| total_price | DECIMAL | 총액 |
| status | STRING | 주문 상태 (PENDING/PAID/SHIPPED/DELIVERED) |
| shipping_address | STRING | 배송 주소 (검색 대상) |
| created_at | INTEGER | 주문 시간 |
| shipped_at | INTEGER | 배송 시간 |
| delivered_at | INTEGER | 배달 시간 |

## 인덱스

- PRIMARY KEY: order_id
- UNIQUE: order_number
- INDEX: user_id, created_at (사용자별 주문)
- INDEX: status (상태별 조회)
- FULLTEXT INDEX: order_number, shipping_address

## 샤딩 전략

- **샤딩 키**: user_id

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3

## 쿼리 예시

```sql
SELECT * FROM orders WHERE user_id = 100 ORDER BY created_at DESC;
SELECT * FROM orders WHERE status = 'SHIPPED' AND created_at > 1704067200;
```

## 전문 검색 대상

- **order_number** (주문 번호)
- **shipping_address** (배송 주소)
