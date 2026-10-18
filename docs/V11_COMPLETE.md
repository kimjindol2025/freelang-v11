# FreeLang v11 완료 기록

- 고정점: stage 2 = stage 3 = stage 4, `e0eb4960665102ae806a243cbfe2c169b0794ecfb2a9a97aae514564e58b8010`
- 시드 SHA-256: `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2`
- MAIN 실행 줄: NODE 0 / JS 0 / AFJ 0
- 측정 도구 SHA-256: `fed5fa7db902e6eb1e72d0215ca76c31dc6da37ae110e89c565df1a4530618ca`
- 검증: 전체 시험 41/41, 감사 44/44, v11 단위시험 4/4, E2E 4/4, DB 10/10, HTTP 6/6

## 남은 사항

- `legacy/`에는 사용하지 않는 옛 JS 도구가 보관되어 있습니다.
- 도구 저장소에는 프로젝트 설정에 따라 실행되는 선택 경로 npm 호출 3줄이 남아 있습니다.
- `fl-repl`과 `fl-serve`는 네이티브 런타임에서 아직 지원되지 않습니다.
