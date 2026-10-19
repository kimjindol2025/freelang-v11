# FreeLang v11

> **상태: v11 완료 (v11.1.0-node-free)**
>
> [완료 기록](docs/V11_COMPLETE.md)

FreeLang 네이티브 컴파일러와 런타임의 기준 저장소입니다. 완료 검증에서 stage 2·3·4 고정점, 네이티브 시험과 감사, DB 및 HTTP 런타임을 확인했습니다.

- 고정점: `dd5528735a6a2beb16aea40b7b09954817caa2e39b25b91b78c1e1c545f7ee3f`
- 고정점 변경 이유: 바이트 함수(`char-from-byte`) 추가와 FreeLang JSON 함수의 전방 선언 반영.
- 실행 경로에 Node 0 / JS 0 / AFJ 0, 옛 파일은 `legacy/`에 보관.
- 전체 시험 41/41, 감사 44/44

프로젝트별 도구와 시험은 FreeLang Tools CLI의 프로젝트 어댑터를 사용합니다. 옛 Node·npm·bootstrap 실행 안내는 현재 기본 실행법이 아니며, 과거 방식 기록은 `legacy/`를 참고하세요.
