# freelang-v11 (AFJ Language)

Part of [AFJ Ecosystem](<AFJ_ECOSYSTEM_PROFILE_URL>)

> Building a programming language by building real software.

## About

AFJ Language core and toolchain repository. It provides language definition,
compiler flow, and deterministic verification points for real software projects.

## Validation Status

| Component | Build | Test | Verify | Measure |
|-----------|-------|------|--------|---------|
| Core | ✅ 자동 (워크플로우 존재) | ✅ 자동 (테스트 스크립트) | ✅ 자동 (`verify:*`) | 🔜 계획 필요 |
| Evidence | `.github/workflows/phase-3c-l2-proof.yml` | `npm test` | `PHASE-E0-COMPLETION-REPORT.md` | reports 없음 |

## Related Projects

- Downstream: [AFL-Core-2](https://gogs.dclub.kr/kim/AFL-Core-2)
- Runtime: [freelang-v11-fx2](https://gogs.dclub.kr/kim/freelang-v11-fx2)
- Storage: [afl-db](https://gogs.dclub.kr/kim/afl-db)
- Frontend: [freelang-front](https://gogs.dclub.kr/kim/freelang-front)

## Quick Links

- [getting-started](docs/)
- [architecture](docs/LIBS10_PLAN.md)
- [ai stdlib core v1](docs/STDLIB_CORE_V1.md)
- [language spec](SPEC.airc)
- [latest validation report](reports/latest.md)

## Validation Report

- Build: `.github/workflows/phase-3c-l2-proof.yml`, `phase-c-full.yml`, `phase-c-full-slack.yml`
- Verify: `PHASE-E0-COMPLETION-REPORT.md`
- Measure: 표준화된 `reports/` 항목은 아직 미정

## How to run

```bash
npm run build
npm test
npm run verify:fixed-point
npm run verify:build-deterministic
```


## AI·개발 보조 도구 사용법

FreeLang에는 함수 보조, 문법 검사, 컴파일 검증, VS Code 자동완성이 이미 포함되어 있습니다.

### 1. 실행과 문법 검사

```bash
# 실행
npm run fl -- run hello.fl

# 서버 실행
npm run fl -- serve app/

# REPL
npm run fl -- repl

# 실행하지 않고 문법만 검사
npm run fl -- check hello.fl
```

`check`는 파싱 오류를 파일명·라인·컬럼과 함께 표시하고 소스 위치를 가리킵니다. 실행 오류는 원인, 오류 라인, 소스 문맥, 호출 스택을 함께 출력합니다.

### 2. AI 코드 검증기

AI가 작성한 파일은 실행 전에 `ai-validate`로 검사합니다.

```bash
# 진단만 출력
node scripts/ai-validate.js hello.fl

# 자동 정규화 결과를 stdout으로 출력
node scripts/ai-validate.js hello.fl --fix

# stdin으로 검사
cat hello.fl | node scripts/ai-validate.js --stdin
```

검사 항목에는 `defun → defn`, `== → =`, nil 위험 접근, if 분기, 미정의 함수와 유사 함수 추천, bootstrap 기반 검증이 포함됩니다. 진단은 `L라인 [코드]` 형식으로 표시됩니다.

### 3. FreeLang 안에서 함수 보조 사용

```fl
(suggest-fn "fetcch")       ;; → 유사 함수명 추천
(alias-of "console_log")   ;; → 올바른 이름과 사용법
(help-text "fetcch")       ;; → 오류 원인과 대체 함수 안내
```

인자 순서를 헷갈릴 때는 `smart-map`, `smart-filter`, `smart-get`, `smart-assoc`를 사용하고, 안전한 호출은 `try-call` 또는 `try-call-1`을 사용합니다.

### 4. VS Code 보조

저장소의 `vscode-extension/`은 FreeLang 문법 강조, hover, 함수 자동완성을 제공합니다. VS Code에서 해당 폴더를 확장 개발 폴더로 열어 `.fl` 파일을 편집하면 자동완성 목록과 함수 사용 설명을 사용할 수 있습니다.

상세 AI 사용법은 [AI Quickstart](docs/AI_QUICKSTART.md), 함수·오류 보조 구현은 [stdlib-helpers.ts](src/stdlib-helpers.ts), [cli.ts](src/cli.ts), [ai-validate.js](scripts/ai-validate.js)를 참고합니다.

## Version

`11.7.11` (package metadata)
