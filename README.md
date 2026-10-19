# FreeLang v11

> **상태: v11 완료 (v11.1.0-node-free)**
>
> [완료 기록](docs/V11_COMPLETE.md)

FreeLang 네이티브 컴파일러와 런타임의 기준 저장소입니다. 완료 검증에서 stage 2·3·4 고정점, 네이티브 시험과 감사, DB 및 HTTP 런타임을 확인했습니다.

- 고정점: `bd271beee58ebeadf123907d3469cd158546f44142c2af734bcff02acc3f236e`
- 고정점 변경 이유: TASK 9-4에서 FreeLang `http-get`·`http-post` 정의를 내장 호출보다 우선하고 `http-get`의 C 런타임 이름 충돌을 분리함. 씨앗은 유지.
- HTTP v0.1: [사용법·제한](lib/http/README.md), HTTPS 미지원.
- 실행 경로에 Node 0 / JS 0 / AFJ 0, 옛 파일은 `legacy/`에 보관.
- 전체 시험 41/41, 감사 44/44

프로젝트별 도구와 시험은 FreeLang Tools CLI의 프로젝트 어댑터를 사용합니다. 옛 Node·npm·bootstrap 실행 안내는 현재 기본 실행법이 아니며, 과거 방식 기록은 `legacy/`를 참고하세요.
