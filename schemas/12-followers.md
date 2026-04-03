# Schema: followers

**목적:** 사용자 팔로우 관계

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| follower_id | INTEGER NOT NULL | 팔로우하는 사용자 ID |
| following_id | INTEGER NOT NULL | 팔로우하는 대상 사용자 ID |
| created_at | INTEGER | 팔로우 시간 |

## 인덱스

- PRIMARY KEY: (follower_id, following_id)
- INDEX: follower_id (내 팔로우)
- INDEX: following_id (나를 팔로우)

## 샤딩 전략

- **샤딩 키**: follower_id

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2
