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

## Version

`11.7.11` (package metadata)
