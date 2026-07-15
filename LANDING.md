# freelang-v11 Landing

**Part of AFJ Ecosystem** | [Profile](https://gogs.dclub.kr/kim)

- **Mission:** Building a programming language by building real software.
- **Role:** Language Core
- **State:** Active

## At a Glance

- AFJ language model and compiler pipeline (v11)
- Deterministic verification-oriented toolchain
- Native executable path, runtime observability, and AI-native development support

## Why it exists

`freelang-v11` is the anchor of the AFJ stack. All higher layers (runtime, DB, and frontend) consume its language contracts and verification semantics.

## Validation Snapshot

- Build: `phase-3c-l2-proof.yml`, `phase-c-full.yml`
- Test: `npm test`
- Verify: `verify:fixed-point`, `verify:build-deterministic`
- Measure: to be standardized into `reports/`

## Quick Start

```bash
npm install
npm run build
npm test
npm run verify:fixed-point
```

## For Visitors

- Use this repo to understand the language and compiler contracts.
- Cross-check runtime compatibility and execution assumptions with Core/DB/Frontend.
- Follow changelog for incremental verification depth.

## Links

- [Project README](./README.md)
- [Architecture](docs/LIBS10_PLAN.md)
- [Language Spec](SPEC.airc)
- [Latest completion report](PHASE-E0-COMPLETION-REPORT.md)
