# Schema: messages

**목적:** 사용자 메시지 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| message_id | INTEGER PRIMARY KEY | 메시지 ID |
| sender_id | INTEGER NOT NULL | 발신자 ID |
| receiver_id | INTEGER NOT NULL | 수신자 ID |
| subject | STRING | 제목 (검색 대상) |
| content | STRING | 내용 (검색 대상) |
| is_read | BOOLEAN | 읽음 여부 |
| created_at | INTEGER | 발송 시간 |

## 인덱스

- PRIMARY KEY: message_id
- INDEX: receiver_id, is_read (읽지 않은 메시지)
- INDEX: sender_id, created_at
- FULLTEXT INDEX: subject, content

## 샤딩 전략

- **샤딩 키**: receiver_id

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3

## 전문 검색 대상

- **subject** (제목)
- **content** (내용)
