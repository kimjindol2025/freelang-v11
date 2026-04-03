# Schema: users

**목적:** 사용자 정보 관리

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | INTEGER PRIMARY KEY | 사용자 고유 ID |
| username | STRING NOT NULL UNIQUE | 사용자명 |
| email | STRING NOT NULL UNIQUE | 이메일 주소 |
| password_hash | STRING NOT NULL | 비밀번호 해시 |
| full_name | STRING | 실명 |
| bio | STRING | 자기소개 (검색 대상) |
| avatar_url | STRING | 프로필 사진 URL |
| created_at | INTEGER | 생성 시간 |
| updated_at | INTEGER | 수정 시간 |
| is_active | BOOLEAN | 활성 여부 |

## 인덱스

- PRIMARY KEY: user_id
- UNIQUE: username, email
- INDEX: created_at (정렬용)
- INDEX: is_active (필터링용)

## 샤딩 전략

- **샤딩 키**: user_id (Range-based)
- **샤드 분배**: Shard 0-2 (user_id % 3)

## 복제 설정

- **복제 방식**: Synchronous (durability 중요)
- **복제 계수**: 3 (Master + 2 Slave)
- **Hot Standby**: 활성화 (읽기 가능)

## 쿼리 예시

```sql
SELECT * FROM users WHERE user_id = 100;
SELECT * FROM users WHERE username = 'alice';
SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC;
```

## 전문 검색 대상

- bio (자기소개)
- full_name (실명)

**예:** "프로덕션 엔지니어" 검색 → bio 필드 검색
