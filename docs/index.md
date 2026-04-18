# FreeLang v9

**AI를 위한, AI에 의한, AI가 쓰고 싶은 언어**

FreeLang v9는 AI가 자연스럽게 생각하는 방식으로 코드를 작성할 수 있는 프로그래밍 언어입니다. S-expression 기반의 명확한 문법과 AI-native 블록들로 인공지능과 인간이 함께 코드를 작성할 수 있습니다.

---

## 🚀 빠른 시작

### 설치
```bash
npm install -g freelang-v9
v9 --version
```

### 첫 번째 프로그램
```lisp
(print "Hello, FreeLang!")

; 함수 정의
(defn greet [name]
  (str "안녕, " name "!"))

(print (greet "World"))
```

### REPL 실행
```bash
v9 repl
```

---

## ✨ 핵심 기능

### 1. AI-Native 블록
AI가 하는 추론, 검색, 기억을 언어 수준에서 지원:

```lisp
; 체계적 추론 (Chain-of-Thought)
(reasoning
  :goal "사용자 인증 구현"
  :steps [
    "토큰 생성 함수 정의"
    "비밀번호 검증 로직"
    "토큰 저장소 준비"
  ])

; 가설 설정 및 검증
(hypothesis
  :claim "HTTP 요청이 3초 이내 완료될 것"
  :test (fn [] (< (measure-time api-call) 3000)))

; 불확실성을 값으로 표현
(maybe 0.95 best-guess)  ; 95% 확신도로 값 표현
```

### 2. S-Expression 문법
Lisp 전통의 명확하고 균일한 문법:

```lisp
(defn calculate [x y]
  (-> x
      (+ y)
      (* 2)
      (- 5)))

(calculate 10 20)  ; → 55
```

### 3. 내장 표준 라이브러리
30개 이상의 모듈로 실무 개발 지원:

- **io**: 파일 읽기/쓰기
- **net**: HTTP 클라이언트/서버
- **db**: SQLite 데이터베이스
- **crypto**: JWT, 암호화
- **time**: 날짜/시간 처리
- **service**: 마이크로서비스 프레임워크
- **test**: 자동 테스트 및 커버리지

### 4. 완전한 생태계
- **vpm**: v9 패키지 관리자
- **FLNext**: 웹 프레임워크 (Express 제거)
- **v9-data**: 데이터 분석 라이브러리
- **Registry**: npm 호환 패키지 서버

---

## 📚 문서

### [언어 기초](./guide/basics.md)
- 문법과 타입
- 함수 정의 및 호출
- 제어 흐름

### [AI 블록 상세](./guide/ai-blocks.md)
- Chain-of-Thought
- Tree-of-Thought
- 반성 (Reflection)
- 자기 개선

### [프레임워크](./guide/frameworks.md)
- FLNext 웹 개발
- v9-data 데이터 분석
- 서비스 및 마이크로서비스

### [API 레퍼런스](./api/stdlib.md)
- 표준 라이브러리 모든 함수
- HTTP, 파일, 데이터베이스
- 테스트 및 모니터링

### [예제](./examples/)
- 웹 애플리케이션
- CLI 도구
- 데이터 처리
- 마이크로서비스

---

## 🎯 왜 FreeLang v9인가?

### 문제: AI와 인간의 사고 방식 불일치
기존 프로그래밍 언어는 AI가 생각하는 방식으로 코드 작성을 방해합니다.

### 해결책: AI-Native 언어 설계
```
기존 언어의 한계:
❌ 추론 과정을 코드로 표현 불가
❌ 불확실성을 값으로 다룰 수 없음
❌ 기억과 상태 관리가 복잡
❌ AI 블록이 언어 수준에서 없음

FreeLang v9의 장점:
✅ 체계적 추론을 [REASON] 블록으로
✅ 확률을 (maybe 0.8 value)로 표현
✅ 장기/단기 메모리 내장
✅ 30개 AI-native 블록 지원
```

---

## 📊 프로덕션 준비 완료

| 항목 | 상태 | 평가 |
|------|------|------|
| **코드 품질** | ✅ | 1,800+ 줄 신규 (Phase 7-12) |
| **테스트** | ✅ | 589/589 PASS (100%) |
| **회귀 테스트** | ✅ | 439/439 PASS (100%) |
| **npm 배포** | ✅ | freelang-v9@9.0.0 public |
| **의존성** | ✅ | express/npm/tsc 모두 제거 |

---

## 🤝 커뮤니티

- [GitHub Discussions](https://github.com/kimjindol2025/freelang-v9/discussions) — 질문과 아이디어
- [GitHub Issues](https://github.com/kimjindol2025/freelang-v9/issues) — 버그 리포트 및 기능 요청
- [블로그](https://blog.dclub.kr) — 기술 기록 및 튜토리얼

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

## 🎉 시작해보기

```bash
npm install -g freelang-v9
v9 repl
```

FreeLang v9로 AI가 원하는 방식으로 코드를 작성하세요!

---

**Made by**: Kim Jindol  
**Version**: v9.0.0  
**Last Updated**: 2026-04-13
