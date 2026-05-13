# FreeLang — 프로젝트 목표

작성일: 2026-05-13

---

## 목표 (단 하나)

**`./freelang hello.fl` 이 Node.js 없이 실행된다.**

이게 달성되기 전까지 완료는 없다.

---

## 길 (4단계, 순서 고정)

### Stage 1 — Level 3 부트스트랩
`self/all.fl`이 자기 자신을 컴파일할 수 있어야 한다.

지금 실패 원인: `read_string_iter` 재귀 → 스택 오버플로우  
수정: 루프로 전환 (TCO)

검증:
```bash
node self/all.fl.out.js self/all.fl /tmp/all2.js
# 에러 없이 완료
```

### Stage 2 — C 코드젠
`self/codegen.fl`이 C 코드를 뱉는다.

검증:
```bash
node self/all.fl.out.js hello.fl hello.c
gcc hello.c runtime.c -o hello
./hello
```

### Stage 3 — 최소 C 런타임
`runtime.c` — 500줄 이하.  
파일 읽기 + stdout + 메모리. 그게 전부.

### Stage 4 — Node 없이 실행
```bash
./freelang hello.fl
# Node.js 없이 동작
```

---

## 규칙

1. Stage 순서를 건너뛰지 않는다
2. 검증 통과 전에 완료 선언하지 않는다
3. 목표와 무관한 기능을 추가하지 않는다
4. 코드는 줄인다 — 많을수록 실수가 늘어난다

---

## 현재 상태

| Stage | 상태 | 막힌 지점 |
|-------|------|----------|
| 1 | ❌ | read_string_iter 스택 오버플로우 |
| 2 | ❌ | Stage 1 선행 필요 |
| 3 | ❌ | Stage 2 선행 필요 |
| 4 | ❌ | Stage 3 선행 필요 |

---

## 하지 않는 것

- 새 stdlib 함수 추가
- HTTP 서버 기능 확장
- 블로그용 기능 구현
- Phase 이름 붙이기
- 완료 선언 후 다음으로 넘어가기
