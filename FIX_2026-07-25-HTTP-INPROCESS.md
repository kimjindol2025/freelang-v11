# FIX — freelang-v11 HTTP-INPROCESS-001 (2026-07-25)

## 증상
동기 `http_*`가 요청마다 `spawnSync("node", ["-e", …])` → 콜당 ~100–150ms+.

## 원인
`src/stdlib-http.ts` `nodeHttpRequest`가 자식 Node 프로세스로 HTTP를 수행.

## 수정
- 상주 `worker_threads` + `MessageChannel` + `Atomics.wait` + `receiveMessageOnPort`
- 반환 계약 유지: `{:status,:body,:error?}`, 기본 timeout 10s
- `worker.unref()`로 idle CLI 종료 가능
- 테스트: `src/__tests__/http-inprocess.test.ts`
- 측정: `scripts/measure-http-inprocess.js` (esbuild API)

## 검증
```bash
npm run build
node scripts/measure-http-inprocess.js
# median_ms ~0.5, pass: true (<10ms)

npm test -- --testPathPattern=http-inprocess --forceExit
# 3 passed
```

## 주의
메인 스레드 `Atomics.wait`는 이벤트 루프를 막음 → **같은 프로세스** HTTP 서버로의 동기 호출은 데드락. 별도 프로세스(afl-db 등)는 OK.
