# FreeLang v11

> **상태: v11 완료 (v11.1.0-node-free)**
>
> [완료 기록](docs/V11_COMPLETE.md)

FreeLang 네이티브 컴파일러와 런타임의 기준 저장소입니다. 완료 검증에서 stage 2·3·4 고정점, 네이티브 시험과 감사, DB 및 HTTP 런타임을 확인했습니다.

- 고정점: `3018a00633794c56ba2544db36f2f866446c55cf3c82f5605691690dfffe6d94`
- 고정점 변경 이유: TASK 9-5의 로드된 파일 API 우선 호출과 `dir-list` C 이름 충돌 분리. 기존 내장 호출과 씨앗은 유지.
- 파일·폴더 v0.1: [API·오류·원자적 쓰기 계약](lib/fs/README.md).
- HTTP v0.1: [사용법·제한](lib/http/README.md), HTTPS 미지원.
- 실행 경로에 Node 0 / JS 0 / AFJ 0, 옛 파일은 `legacy/`에 보관.
- 전체 시험 41/41, 감사 44/44

프로젝트별 도구와 시험은 FreeLang Tools CLI의 프로젝트 어댑터를 사용합니다. 옛 Node·npm·bootstrap 실행 안내는 현재 기본 실행법이 아니며, 과거 방식 기록은 `legacy/`를 참고하세요.
