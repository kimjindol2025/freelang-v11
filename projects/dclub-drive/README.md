# dclub-drive — 자주권 파일 드라이브 (Phase Y2)

Google Drive 의존 없이 사용자별 파일/폴더 트리 + 권한 + 공유 링크 SaaS.
files-store + permissions + share_links 3 테이블, 외부 npm 0.

## 라우트

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/health` | - | 상태 |
| POST | `/drive/upload` | Bearer | 파일/폴더 생성 |
| GET | `/drive/download?path=` | Bearer | 다운로드 (owner OR 권한 부여 OR share) |
| GET | `/drive/list?path=` | Bearer | 디렉터리 list |
| GET | `/drive/list?shared=1` | Bearer | 본인이 공유받은 항목 |
| POST | `/drive/share` | Bearer (owner) | 공유 토큰 발급 |
| POST | `/drive/perms/grant` | Bearer (owner) | 명시 사용자 권한 부여 |
| GET | `/share/:token` | - | 공유 링크 다운로드 |

## 권한 모델

- **owner**: 파일을 만든 사용자 — 모든 작업
- **writer**: 명시 부여 — 읽기 + 쓰기
- **reader**: 명시 부여 — 읽기만
- **share token**: 무인증 다운로드 (만료 ttl 또는 영구)

## E2E 검증

```bash
bash projects/dclub-drive/tests/smoke-drive.sh
```

14 케이스 — health, 무인증 401, 폴더/파일 업로드, owner 다운로드, 타인 403,
권한 부여 후 다운로드, share 발급/사용/만료 토큰 404, list 본인/공유, 중복 409.
