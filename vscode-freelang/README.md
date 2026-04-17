# FreeLang v11 — VSCode Extension

`.fl` 파일을 위한 VSCode 확장:

- ✨ **Syntax highlighting** — 블록 매크로, 함수, `$변수`, 키워드, 숫자 등
- ✅ **저장 시 자동 문법 검사** — `bootstrap.js check` 실행, 에러를 에디터에 표시
- 🚀 **상태바 표시** — `.fl` 파일 열면 우측 하단에 FreeLang 아이콘

## 설치 (로컬 개발)

```bash
# 1. freelang-v11 루트에서 확장 심볼릭 링크
cd ~/.vscode/extensions
ln -s /path/to/freelang-v11/vscode-freelang vscode-freelang

# 2. VSCode 재시작
```

또는 `code --install-extension` 으로 설치.

## 설정

```jsonc
// settings.json
{
  "freelang.lsp.enabled": true,
  "freelang.bootstrapPath": "/absolute/path/to/bootstrap.js"
}
```

`bootstrapPath`가 비어있으면 워크스페이스 루트의 `bootstrap.js`를 자동 탐지합니다.

## 하이라이팅 범위

| 요소 | 예시 |
|------|------|
| 블록 매크로 | `[FUNC]`, `[LAYOUT]`, `[COMPONENT]`, `[IMPORT]`, `[COT]`, `[AGENT]` 등 |
| 특수 형식 | `defn`, `define`, `let`, `if`, `cond`, `do`, `fn`, `try`, `catch` |
| DB 함수 | `db_query`, `db_insert`, `db_update`, `db_delete_row`, `db_exec` |
| 서버 함수 | `server_get/post/put/delete`, `server_json`, `server_html`, `server_start` |
| 인증 함수 | `auth_jwt_sign/verify/expired`, `auth_hash_password`, `auth_verify_password` |
| 코어 | `println`, `str`, `concat`, `get`, `first`, `map`, `reduce`, `now_unix` 등 |
| 키워드 | `:key` (맵 키, params) |
| 변수 | `$var` (달러 접두사) |
| 주석 | `; ...`, `;; ...`, `#\| ... \|#` |

## 추후 계획

- [ ] LSP stdio 브리지 연결 (자동완성, 호버, 정의로 이동)
- [ ] 저장 시 `fmt` 자동 실행 (옵션)
- [ ] Snippet (자주 쓰는 패턴)
- [ ] Marketplace 배포

현재는 최소한의 에디터 경험만 제공하지만, 맨눈 편집보다는 훨씬 낫습니다.
