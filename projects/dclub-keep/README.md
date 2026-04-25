# dclub-keep — 자주권 메모 (Phase Y4)

Google Keep 의존 없이 빠른 메모 + FTS5 한글 검색 SaaS.
Phase Y 4SaaS 묶음의 마지막 — 가장 간단·빠른 출시 데모.

## 데이터 모델

- `notes(id, owner, title, content, color, pinned, ts)` — owner별 인덱스
- `notes_fts` — FTS5 가상 테이블, AFTER INSERT/UPDATE/DELETE 트리거로 자동 동기화

## FTS5 owner 격리

검색 쿼리: `notes_fts MATCH ? AND n.owner=? ORDER BY rank LIMIT 50`. 다른 사용자 메모는 매칭되지 않음.

## 라우트

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 상태 |
| GET | `/` | 다크 메모 그리드 SSR |
| POST | `/notes` | 생성 (Bearer) |
| GET | `/notes` | 본인 목록 |
| GET | `/notes/search?q=` | FTS5 검색 |
| GET/PUT/DELETE | `/notes/:id` | 단건 |

## E2E 검증

```bash
bash projects/dclub-keep/tests/smoke-keep.sh
```

15 케이스 — 무인증 401 · 격리 · FTS5 한글/영어 검색 · 타인 격리 · pinned 토글 ·
SSR (anonymous + Bearer) · DELETE.
