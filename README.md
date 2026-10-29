# FreeLang v11

> **상태: v11 완료 (v11.1.0-node-free)**
>
> [완료 기록](docs/V11_COMPLETE.md)

FreeLang 네이티브 컴파일러와 런타임의 기준 저장소입니다. 완료 검증에서 stage 2·3·4 고정점, 네이티브 시험과 감사, DB 및 HTTP 런타임을 확인했습니다.

- 고정점: `1114b23942fc8239ad78e32a47df79c12f519310101dca25d600b723403efc32`
- 고정점 변경 이유: TASK 9-11 loopback 서버 소켓 연결 및 고정 시드 호환 처리. [고정점 이력](docs/V11_COMPLETE.md).
- 시험·실행 증거 v0.1: [시험 API](lib/test/README.md) · [증거·가림 계약](lib/evidence/README.md).
- 문자열·정규식 v0.1: [문자열 계약](lib/str/README.md) · [정규식 문법·단계 제한](lib/regex/README.md).
- 파일·폴더 v0.1: [API·오류·원자적 쓰기 계약](lib/fs/README.md).
- HTTP v0.1: [사용법·제한](lib/http/README.md), HTTPS 미지원.
- 실행 경로에 Node 0 / JS 0 / AFJ 0, 옛 파일은 `legacy/`에 보관.
- 전체 시험 41/41, 감사 44/44

프로젝트별 도구와 시험은 FreeLang Tools CLI의 프로젝트 어댑터를 사용합니다. 옛 Node·npm·bootstrap 실행 안내는 현재 기본 실행법이 아니며, 과거 방식 기록은 `legacy/`를 참고하세요.
