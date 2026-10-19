# FreeLang v11 완료 기록

- 고정점: stage 2 = stage 3 = stage 4, `b530b16ddf8f8cb2450686976a874d869ff919a153cb6b1f2ab13a7662333567`
- 고정점 변경 이유: TASK 9-6 문자열 API 호출 우선순위·C 심볼 분리 및 공통 모듈 중복 로드 방지. 씨앗은 유지.
- 시드 SHA-256: `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2`
- 실행 경로에 Node 0 / JS 0 / AFJ 0, 옛 파일은 `legacy/`에 보관.
- 측정 도구 SHA-256: `fed5fa7db902e6eb1e72d0215ca76c31dc6da37ae110e89c565df1a4530618ca`
- 검증: 전체 시험 41/41, 감사 44/44, v11 단위시험 4/4, E2E 4/4, DB 10/10, HTTP 6/6

## 고정점 이력 (TASK 9-6, git log / git show 대조)

해시는 커밋 ID가 아니라 stage2·3·4 생성 C 파일의 SHA-256이다.

| 고정점 SHA-256 | 변경 커밋 | 변경 이유 |
|---|---|---|
| `dd5528735a6a2beb16aea40b7b09954817caa2e39b25b91b78c1e1c545f7ee3f` | `58b87d03` + `76beea62` (기록 갱신 `9abae716`) | char-from-byte 코드 생성, 로드된 JSON API 우선 호출 및 FUNC 전방 선언 반영 |
| `bd271beee58ebeadf123907d3469cd158546f44142c2af734bcff02acc3f236e` | `3ca12e64` | HTTP 공개 함수 우선 호출과 http-get C 심볼 분리 |
| `3018a00633794c56ba2544db36f2f866446c55cf3c82f5605691690dfffe6d94` | `c95f3012` | FS 공개 함수 우선 호출과 dir-list C 심볼 분리, 모듈 없는 기존 내장 호출 유지 |
| `b530b16ddf8f8cb2450686976a874d869ff919a153cb6b1f2ab13a7662333567` | `cf5d682c` (`lib: str and regex v0.1`) | 문자열 API 우선 호출·내부 기본 함수·C 심볼 분리, 정규화한 모듈 경로의 중복 확장 방지 |

`git log -- self/cgc-main.fl docs/V11_COMPLETE.md`와 각 커밋의 실제 차이를
대조했다. `dd552873…`의 기록 갱신 커밋 자체는 컴파일러 변경 커밋이 아니다.
TASK 9-6은 보존한 씨앗으로 현재 컴파일러를 부트스트랩한 뒤 stage2·3·4를
만들어 SHA-256 일치와 두 CMP 종료값 0을 확인했다. 런타임 씨앗 교체는 없다.

## TASK 9-6 검증

TASK 9-6 검증: 문자열 35/35, 정규식 67/67, 기존 문자열 내장 6/6,
모듈 통합 4/4, 기존 41/41, 감사 44/44, 8영역·HTTP·FS 통과.
완료된 두 execve 추적에서 Node 0·JS 0. 심층 검증 TRUSTED/종료값 0.
기존 AFJ 전용 capability probe의 PARTIAL 제한은 전체 기능 검증 완료로 해석하지 않는다.

## 남은 사항

- `legacy/`에는 사용하지 않는 옛 JS 도구가 보관되어 있습니다.
- 도구 저장소에는 프로젝트 설정에 따라 실행되는 선택 경로 npm 호출 3줄이 남아 있습니다.
- `fl-repl`과 `fl-serve`는 네이티브 런타임에서 아직 지원되지 않습니다.
