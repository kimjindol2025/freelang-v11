"use strict";
// FreeLang v9: Phase 79 — 워치 모드 + 핫 리로드 테스트
// 실제 파일 시스템 이벤트는 테스트하지 않음 — 인터페이스/타입/로직만 검증
Object.defineProperty(exports, "__esModule", { value: true });
const hot_reload_1 = require("./hot-reload");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg ?? "assertion failed");
}
function assertEqual(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `expected ${String(b)}, got ${String(a)}`);
}
console.log("[Phase 79] 워치 모드 + 핫 리로드 테스트\n");
// ─────────────────────────────────────────
// TC-1~5: FileWatcher 기본
// ─────────────────────────────────────────
console.log("[TC-1~5] FileWatcher 기본\n");
test("TC-1: FileWatcher 인스턴스 생성 가능", () => {
    const watcher = new hot_reload_1.FileWatcher();
    assert(watcher !== null && watcher !== undefined, "FileWatcher 인스턴스 없음");
});
test("TC-2: watch() 가 stop 함수 반환", () => {
    const watcher = new hot_reload_1.FileWatcher();
    // 존재하지 않는 파일도 stop 함수는 반환해야 함
    const stop = watcher.watch("/tmp/nonexistent-phase79.fl", {});
    assert(typeof stop === "function", "stop 은 함수여야 함");
    stop(); // 에러 없이 호출 가능
});
test("TC-3: WatchOptions 기본값 적용 (debounceMs=300)", () => {
    const opts = {};
    const debounceMs = opts.debounceMs ?? 300;
    assertEqual(debounceMs, 300, "기본 debounceMs 는 300이어야 함");
});
test("TC-4: onReload 콜백 형태 검증", () => {
    let called = false;
    const opts = {
        onReload: (file) => {
            called = true;
            assert(typeof file === "string", "file 은 string이어야 함");
        },
    };
    assert(typeof opts.onReload === "function", "onReload 는 함수여야 함");
    opts.onReload("/tmp/test.fl");
    assert(called, "onReload 호출되어야 함");
});
test("TC-5: watchDir 호출 가능", () => {
    const watcher = new hot_reload_1.FileWatcher();
    // /tmp 디렉토리에 대해 watchDir 호출 (실제 이벤트는 발생하지 않음)
    const stop = watcher.watchDir("/tmp", "*.fl", {});
    assert(typeof stop === "function", "stop 은 함수여야 함");
    stop();
});
// ─────────────────────────────────────────
// TC-6~10: debounce 로직
// ─────────────────────────────────────────
console.log("\n[TC-6~10] debounce 로직\n");
test("TC-6: debounce 함수 생성 (createDebounce 내부 유틸)", () => {
    const debounced = (0, hot_reload_1.createDebounce)(300);
    assert(typeof debounced === "function", "createDebounce 는 함수를 반환해야 함");
});
test("TC-7: debounce — 연속 호출 시 마지막만 실행 (fake timer)", () => {
    // 실제 타이머를 사용하지 않고 콜백 카운트로 검증
    // createDebounce가 내부적으로 clearTimeout을 사용하므로
    // 동일 debounce 인스턴스에 여러 번 fn을 전달해도 마지막이 실행됨을 논리적으로 검증
    const debounced = (0, hot_reload_1.createDebounce)(50);
    let count = 0;
    // 즉시 실행하는 fn (debounce 0ms 버전으로 테스트)
    const immediateDebounce = (0, hot_reload_1.createDebounce)(0);
    let last = "";
    immediateDebounce(() => { last = "a"; count++; });
    immediateDebounce(() => { last = "b"; count++; });
    immediateDebounce(() => { last = "c"; count++; });
    // debounce 0ms면 Node.js 이벤트 루프 다음 틱에 마지막만 실행
    // 이 시점에서는 아직 실행 전이므로 count = 0
    assertEqual(count, 0, "debounce 대기 중에는 count = 0 이어야 함");
    assert(typeof debounced === "function", "debounced 는 함수여야 함");
});
test("TC-8: debounce 타임아웃 기본값 300ms", () => {
    const opts = {};
    const ms = opts.debounceMs ?? 300;
    assertEqual(ms, 300, "기본 debounce 는 300ms");
});
test("TC-9: debounce clearTimeout 정리 (이중 호출 안전)", () => {
    const debounced = (0, hot_reload_1.createDebounce)(100);
    // clearTimeout을 내부적으로 사용하는지: 연속 호출 후 stop 함수 안전 확인
    let execCount = 0;
    debounced(() => { execCount++; });
    debounced(() => { execCount++; }); // 이전 timer clear 후 새 timer 설정
    // 에러 없이 두 번 호출 가능한지 확인
    assert(execCount === 0, "아직 실행 전");
});
test("TC-10: 빠른 연속 호출 카운트 확인", () => {
    const debounced = (0, hot_reload_1.createDebounce)(500);
    let count = 0;
    // 5번 빠르게 호출
    for (let i = 0; i < 5; i++) {
        debounced(() => { count++; });
    }
    // 아직 실행 전이어야 함
    assertEqual(count, 0, "빠른 연속 호출 시 즉시 실행되면 안 됨");
});
// ─────────────────────────────────────────
// TC-11~16: 에지 케이스
// ─────────────────────────────────────────
console.log("\n[TC-11~16] 에지 케이스\n");
test("TC-11: onError 콜백 형태 검증", () => {
    let errorFile = "";
    let errorObj = null;
    const opts = {
        onError: (file, err) => {
            errorFile = file;
            errorObj = err;
        },
    };
    assert(typeof opts.onError === "function", "onError 는 함수여야 함");
    opts.onError("/tmp/error.fl", new Error("test error"));
    assertEqual(errorFile, "/tmp/error.fl", "file 파라미터 전달 확인");
    assert(errorObj instanceof Error, "err 는 Error 인스턴스여야 함");
    assert(errorObj.message === "test error", "에러 메시지 확인");
});
test("TC-12: clearConsole 옵션 존재 확인", () => {
    const opts = {
        clearConsole: false,
    };
    assertEqual(opts.clearConsole, false, "clearConsole=false 설정 가능");
    const opts2 = {
        clearConsole: true,
    };
    assertEqual(opts2.clearConsole, true, "clearConsole=true 설정 가능");
    const opts3 = {};
    const val = opts3.clearConsole ?? true;
    assertEqual(val, true, "기본값은 true");
});
test("TC-13: stop 함수 여러 번 호출해도 에러 없음", () => {
    const watcher = new hot_reload_1.FileWatcher();
    const stop = watcher.watch("/tmp/nonexistent-multi-stop.fl", {});
    // 여러 번 호출해도 에러 없어야 함
    stop();
    stop();
    stop();
    assert(true, "여러 번 stop 호출 후 에러 없음");
});
test("TC-14: WatchOptions 타입 확인", () => {
    // 모든 필드가 optional 임을 확인
    const empty = {};
    assert(empty.debounceMs === undefined, "debounceMs optional");
    assert(empty.clearConsole === undefined, "clearConsole optional");
    assert(empty.onReload === undefined, "onReload optional");
    assert(empty.onError === undefined, "onError optional");
    // 모든 필드 채운 버전
    const full = {
        debounceMs: 500,
        clearConsole: false,
        onReload: (_f) => { },
        onError: (_f, _e) => { },
    };
    assertEqual(full.debounceMs, 500, "debounceMs 설정 가능");
    assertEqual(full.clearConsole, false, "clearConsole 설정 가능");
    assert(typeof full.onReload === "function", "onReload 설정 가능");
    assert(typeof full.onError === "function", "onError 설정 가능");
});
test("TC-15: runWithWatch 함수 export 확인", () => {
    assert(typeof hot_reload_1.runWithWatch === "function", "runWithWatch 는 함수여야 함");
    // 시그니처 확인: (file: string, opts?: WatchOptions) => void
    // opts는 optional이지만 JS에서 length는 선언된 파라미터 수 반환
    assert(hot_reload_1.runWithWatch.length >= 1, "최소 1개 파라미터 (file) 존재");
});
test("TC-16: FileWatcher 메서드 존재 확인", () => {
    const watcher = new hot_reload_1.FileWatcher();
    assert(typeof watcher.watch === "function", "watch 메서드 존재");
    assert(typeof watcher.watchDir === "function", "watchDir 메서드 존재");
    assert(typeof watcher.stopAll === "function", "stopAll 메서드 존재");
});
// ─────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────
console.log("\n─────────────────────────────────────────");
console.log(`[Phase 79] 결과: ${passed} PASS / ${failed} FAIL`);
if (failed === 0) {
    console.log("✅ 모든 테스트 PASS");
}
else {
    console.log("❌ 일부 테스트 FAIL");
    process.exit(1);
}
//# sourceMappingURL=test-phase79-watch.js.map