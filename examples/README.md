# FreeLang v11 예제 모음

| 파일 | 설명 |
|------|------|
| `hello.fl` | 최소 Hello World |
| `simple-intent.fl` | Intent 블록 기본 |
| `pipeline-demo.fl` | 파이프라인 데모 |
| `ai-agent.fl` | AI 에이전트 |
| `macro-dsl.fl` | 매크로 DSL |
| `mini-server.fl` | 최소 HTTP 서버 |
| `http-server.fl` | HTTP 서버 기본 |
| `api-server.fl` | API 서버 |
| `full-server.fl` | 풀스택 서버 |
| `server-check.fl` | 서버 상태 체크 |
| **`sqlite-prod-crud.fl`** ⭐ | **프로덕션 SQLite CRUD 참조 (외부 저장소 링크)** |

## ⭐ sqlite-prod-crud.fl

v11으로 구현한 **99.9%+ 프로덕션 수준** SQLite 앱의 참조 파일입니다.

- **실체**: https://gogs.dclub.kr/kim/freelang-v11-sqlite-crud
- **테스트**: 42개 보안 테스트 PASS
- **기능**: JWT + 2FA + 비밀번호 재설정 + Rate Limit + CSP + 감사로그 + 토큰 순환
- **재사용 헬퍼**: 21개 (escape-html, rate-check, require-auth 등)

v11으로 프로덕션 앱을 만들 때 이 저장소를 템플릿으로 사용하세요.
