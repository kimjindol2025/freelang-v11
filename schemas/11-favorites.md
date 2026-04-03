# Schema: favorites

**목적:** 사용자 찜 목록

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| favorite_id | INTEGER PRIMARY KEY | 찜 ID |
| user_id | INTEGER NOT NULL | 사용자 ID |
| product_id | INTEGER NOT NULL | 상품 ID |
| created_at | INTEGER | 추가 시간 |

## 인덱스

- PRIMARY KEY: favorite_id
- UNIQUE: (user_id, product_id)
- INDEX: user_id (사용자 찜 목록)

## 샤딩 전략

- **샤딩 키**: user_id

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2
