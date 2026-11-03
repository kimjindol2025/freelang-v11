# FreeLang v11

> **AI가 코드를 쓰고, 검증하고, 재실행하기 쉽게 설계된 Lisp 계열 프로그래밍 언어**

FreeLang v11(별칭: AFJ Language)은 S-expression 문법을 사용하는 프로그래밍 언어입니다.  
불변 데이터와 결정론적 실행을 기본으로 하며, AI 에이전트가 안정적으로 코드를 다룰 수 있도록 설계되었습니다.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-v11%20complete-brightgreen)](docs/V11_COMPLETE.md)

---

## 특징

- **Lisp 스타일 S-expression 문법** — 간결하고 일관된 표현
- **결정론적 실행** — 같은 입력은 항상 같은 결과 (SHA-256으로 검증 가능)
- **불변 데이터** — 값의 변경을 최소화하여 예측 가능성 향상
- **명시적 I/O 제어** — 파일·네트워크 접근을 권한 기반으로 관리
- **자가 호스팅** — 컴파일러가 자기 자신을 컴파일하고 고정점을 검증
- **네이티브 컴파일** — C로 변환하여 단일 실행 파일 생성 가능

## 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/kimjindol2025/freelang-v11.git
cd freelang-v11

# 의존성 설치 (필요 시)
npm install
```

### Hello World

```lisp
(println "Hello, FreeLang!")
```

### 함수 정의와 재귀

```lisp
(defn factorial [n]
  (if (<= n 1)
    1
    (* n (factorial (- n 1)))))

(println (factorial 5))  ; → 120
```

### 컬렉션 처리

```lisp
(map (fn [x] (* x 2)) [1 2 3])     ; → [2 4 6]
(filter (fn [x] (> x 1)) [1 2 3])  ; → [2 3]
(reduce + 0 [1 2 3 4 5])           ; → 15
```

## 왜 FreeLang인가?

| 일반 언어 | FreeLang |
|-----------|----------|
| AI가 코드를 쓰면 결과가 불안정할 수 있음 | 결정론적 실행으로 결과 재현 가능 |
| 부작용이 많아 검증이 어려움 | 불변성과 명시적 I/O로 검증 용이 |
| 컴파일러 신뢰 문제 | 자가 호스팅 + 고정점 검증 |

AI 에이전트가 코드를 생성·수정·실행하는 환경에서 **예측 가능성과 검증 가능성**을 우선으로 설계했습니다.

## 아키텍처

```
Layer 5: Experiments  ← 실험적 기능 (wisdom, predict, evolve)
Layer 4: Core         ← 언어 핵심 (parser, interpreter, type-check)
Layer 3: Extensions   ← 도메인 기능 (web, db, http, agent)
Layer 2: StdLib       ← 표준 라이브러리 (string, list, map, file, json)
Layer 1: Temporary    ← 임시/호환성 계층
```

## 관련 프로젝트

| 프로젝트 | 설명 |
|----------|------|
| [freelang-v11](https://github.com/kimjindol2025/freelang-v11) | 언어 코어 및 컴파일러 (이 저장소) |
| freelang-script | 스크립트 실행 프로필 |
| freelang-mcp | MCP 연동 도구 |
| freelang-tools | 개발 CLI 및 테스트 러너 |

## 문서

- [완료 기록 (V11_COMPLETE)](docs/V11_COMPLETE.md)
- [사용 가이드](https://github.com/kimjindol2025/freelang-v11) (문법·권한·패턴 정리)
- [문자열/정규식](lib/str/README.md)
- [파일 시스템](lib/fs/README.md)
- [HTTP](lib/http/README.md)

## 현재 상태

- **버전**: v11.1.0-node-free
- **고정점 검증**: Stage 2·3·4 일치
- **테스트**: 41/41 통과
- **감사**: 44/44 통과
- **네이티브 경로**: Node.js / JavaScript 의존 제거 진행 중

## 라이선스

[MIT License](LICENSE)

---

**FreeLang** — AI가 안심하고 쓸 수 있는 언어.
