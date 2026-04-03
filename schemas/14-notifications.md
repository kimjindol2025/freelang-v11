# Schema: notifications

**목적:** 사용자 알림 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| notification_id | INTEGER PRIMARY KEY | 알림 ID |
| user_id | INTEGER NOT NULL | 수신자 ID |
| type | STRING | 알림 타입 (COMMENT/LIKE/FOLLOW) |
| message | STRING | 알림 메시지 (검색 대상) |
| related_user_id | INTEGER | 관련 사용자 ID |
| related_post_id | INTEGER | 관련 게시물 ID |
| is_read | BOOLEAN | 읽음 여부 |
| created_at | INTEGER | 생성 시간 |

## 인덱스

- PRIMARY KEY: notification_id
- INDEX: user_id, is_read
- INDEX: user_id, created_at

## 샤딩 전략

- **샤딩 키**: user_id

## 복제 설정

- **복제 방식**: Asynchronous
- **복제 계수**: 2

## 특징

실시간 알림, 높은 쓰기 빈도
