# FreeLang 현재 범위와 확장 가능성

> **원칙**: "불가능"과 "미구현"은 다르다. 이 문서는 현재 상태를 솔직하게 기술한다.

---

## 현재 상태 요약

| 도메인 | 현재 상태 | 구현 가능성 |
|--------|-----------|-------------|
| 백엔드 API | ✅ 완성 | — |
| 프론트엔드 (SPA) | 미구현 | ✅ 번들러 제작 시 가능 |
| 모바일 | 미구현 | ✅ WASM 런타임 이식 시 가능 |
| 기계학습 | 미구현 | ✅ 수치 연산 라이브러리 추가 시 가능 |
| 시스템 프로그래밍 | 미구현 | ⚠️ 고수준 추상화 특성상 제한적 |

---

## 프론트엔드

**현재**: 미구현

**기술적 근거**:
- 코드젠은 이미 순수 JS를 출력함
- stdlib은 100% 브라우저 호환 가능한 순수 함수형
- bootstrap.js에 Node.js 내장 모듈 14개 + npm 2개 의존

**구현 경로**:
1. 브라우저용 런타임 분리 (Node.js API 제거)
2. `require` / `module.exports` → ESM으로 변환
3. 번들러 제작 (FreeLang 코드 + 브라우저 런타임 → 단일 `.js`)

**예시 (구현 후 가능)**:
```fl
(defn app []
  (let [count (atom 0)]
    (div
      (button {:onclick (fn [] (swap! count inc))} "클릭")
      (p (str "횟수: " @count)))))
```

---

## 모바일

**현재**: 미구현

**기술적 근거**:
- FreeLang은 Node.js 위에서 실행됨
- Node.js는 WASM으로 컴파일 가능
- WASM은 iOS/Android에서 실행 가능

**구현 경로**:
1. FreeLang 런타임 WASM 컴파일
2. iOS (WKWebView) / Android (WebView) 내장
3. 네이티브 브리지 (카메라, GPS 등) 별도 구현

---

## 기계학습

**현재**: 미구현

**기술적 근거**:
- 행렬 연산, 텐서 라이브러리 없음
- 수치 연산 최적화 없음

**구현 경로**:
1. BLAS/LAPACK 바인딩 추가
2. 또는 순수 FL 행렬 라이브러리 제작
3. GPU는 WebGPU 바인딩으로 접근 가능

**현재도 가능한 것**:
```fl
(defn predict [w1 w2 features]
  (let [score (+ (* w1 (nth features 0))
                 (* w2 (nth features 1)))]
    (if (> score 0.5) "positive" "negative")))
```

---

## 시스템 프로그래밍

**현재**: 부분 지원

**현재도 가능한 것**:
```fl
(file-read "/etc/hosts")
(spawn "git" ["clone" "https://..."])
(env-get "PATH")
```

**제한적인 것** (고수준 추상화 특성상):
- 메모리 직접 접근 — 설계 철학 밖
- 커널/드라이버 — Node.js 위에서 실행되는 한 불가

---

## 의존성 현황 (실측 2026-05-13)

```
Node.js 내장 모듈 (14개) — Node.js 설치 시 포함
  fs · path · os · crypto · http · https · net · tls
  url · querystring · readline · events
  child_process · worker_threads

외부 npm (2개) — 실제 의존성
  better-sqlite3    ← SQLite 드라이버
  mysql2/promise    ← MariaDB 드라이버

Bun 런타임 전용 (1개)
  bun:sqlite        ← Bun용 SQLite
```

**"외부 npm 0개" 주장은 현재 거짓.**
진짜 0개 달성하려면 두 드라이버를 직접 구현해야 함.

---

## 결론

FreeLang은 **백엔드에 완성된 언어**이고, 나머지는 **아직 안 만든 것**이다.

- 프론트엔드 번들러 → 만들면 됨
- 모바일 WASM → 만들면 됨
- npm 0개 → 드라이버 직접 구현하면 됨

한계가 아니라 로드맵이다.
