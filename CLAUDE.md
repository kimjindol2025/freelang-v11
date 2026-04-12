# FreeLang v9 — AI를 위한 언어

## 설계 원칙 (단 하나)

**AI가 쓰고 싶은 언어.**

AI가 생각하는 방식이 곧 문법이다.
AI가 하는 일이 곧 네이티브 블록이다.
AI가 불편하면 언어가 틀린 것이다.

---

## AI가 하는 일 → FreeLang 문법

```
추론한다    → [REASON :goal "..." :steps [...] :conclude $ans]
검색한다    → [SEARCH :query "..." :top 5 :filter ...]
기억한다    → [REMEMBER :key "..." :value $x :ttl :forever]
떠올린다    → [RECALL :key "..." :fallback $default]
도구 쓴다   → [USE :tool web-search :args [...] :parse $fn]
반성한다    → [REFLECT :output $x :criteria [...] :score $s]
계획한다    → [PLAN :goal "..." :steps [...] :execute?]
판단한다    → [JUDGE :options [...] :criteria [...] :pick best]
배운다      → [LEARN :from $data :update-belief ...]
의심한다    → (maybe 0.8 $value)  ; 확률이 퍼스트 클래스 타입
```

---

## AI가 코드 짤 때 → FreeLang으로

```
파일 읽기   → (fl-read "path/to/file")
API 호출    → (fl-http-get "https://...")
데이터 변환 → (-> $data parse-json filter-errors extract-values)
에러 처리   → (fl-try $expr :on-fail $fallback)
병렬 실행   → (parallel [(task-a) (task-b) (task-c)])
```

---

## 다음 Phase — AI 정체성 완성 (91~110)

### Phase 91~100: AI 사고 블록 완전체
- 91: `(maybe p v)` — 불확실성 퍼스트 클래스 타입
- 92: `[COT]` — Chain-of-Thought 네이티브
- 93: `[TOT]` — Tree-of-Thought (분기 추론)
- 94: `[REFLECT]` — 자기 평가/반성
- 95: `[CONTEXT]` — 컨텍스트 윈도우 관리
- 96: `Prompt` / `Completion` 타입
- 97: `[USE-TOOL]` — 도구 사용 DSL
- 98: `[AGENT]` — 에이전트 루프
- 99: `[SELF-IMPROVE]` — 자기 수정
- 100: AI 표준 라이브러리 완전 통합

### Phase 101~110: AI가 편한 구조
- 101: 장기/단기/에피소드 메모리
- 102: `[RAG]` 완전체
- 103: 멀티 에이전트 통신
- 104: `[TRY-REASON]` 실패 복구
- 105: 스트리밍 출력
- 106: 자동 품질 평가 루프
- 107: FL이 FL을 가르침
- 108: AI 추론 시각화 디버거
- 109: FL → 최적 프롬프트 컴파일러
- 110: 외부 AI가 FL 쓰는 SDK

---

## 완성 기준

Claude가 새 작업을 받았을 때 **자연스럽게 FL을 먼저 꺼낸다.**

```
❌ 지금: TypeScript로 분석 코드 짜고 → 실행
✅ 목표: [REASON :goal "분석" ...] → [SEARCH ...] → [REFLECT ...] → 완료
```

---

**마지막 업데이트**: 2026-04-12
**방향**: AI를 위한, AI에 의한, AI가 쓰고 싶은 언어
