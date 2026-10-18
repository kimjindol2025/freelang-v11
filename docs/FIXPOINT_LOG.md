# v11 Fixpoint Log

2026-10-15, 작업 위치 `/tmp/v11-selfhost-recheck-seed.D38cUQ`: 출발점은 `bin/cgc-bin-x86_64-backup`이었고, `ir_err`의 마지막 `false`가 2번 출력에서 누락되어 2번과 3번이 달랐다. 새 x86 불씨 `bin/cgc-bin-x86_64-seed-v11`의 SHA-256은 `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2`, 2번·3번·4번 지문은 각각 `c7a81a61436a70a9912c2e8c6278d85cc453503be549af8457a6930583440604`, `c7a81a61436a70a9912c2e8c6278d85cc453503be549af8457a6930583440604`, `c7a81a61436a70a9912c2e8c6278d85cc453503be549af8457a6930583440604`, `CMP_2_3_EXIT=0`, `CMP_3_4_EXIT=0`, 반칙 검사 `NODE_EXEC_COUNT=0`, `NPM_EXEC_COUNT=0`, `TS_EXEC_COUNT=0`, `JS_EXEC_COUNT=0`, `FX_OR_AFJ_OPENAT_COUNT=0`이다. 처음부터 다시 돌리는 명령어: `ROOT=/home/kim/kim/tmp/v11-source-audit-20260929/server25-freelang-v11; SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"; B=$(mktemp -d /tmp/v11-selfhost-recheck.XXXXXX); cp -a "$ROOT/." "$B/repo"; R="$B/repo/runtime"; mkdir -p "$B/bin" "$B/trace"; INBIN="$SEED"; for N in 1 2 3; do OUT="$B/result-$((N+1)).c"; (cd "$B/repo" && /usr/bin/strace -f -e trace=execve,openat -o "$B/trace/step$N-to-$((N+1)).log" env -i PATH=/nonexistent "$INBIN" self/cgc-main.fl "$OUT"); if [ "$N" -lt 3 ]; then env -i PATH=/usr/bin:/bin /usr/bin/strace -f -e trace=execve,openat -o "$B/trace/build-$((N+1)).log" gcc -Wall -Wextra -I "$R" -o "$B/bin/translator-$((N+1))" "$OUT" "$R/core.c" "$R/collection.c" "$R/io.c" "$R/math.c" "$R/error.c" "$R/process.c" "$R/json.c" "$R/cgc-bridge.c" -lm; INBIN="$B/bin/translator-$((N+1))"; fi; done; sha256sum "$B/result-2.c" "$B/result-3.c" "$B/result-4.c"`.

2026-10-17, 8-2에서 `self/cgc-main.fl`에 `case` 코드 생성과 `shell_env`, `throw` 연결을 넣은 뒤 2·3·4를 다시 돌렸다. 직전 지문 `c7a81a61436a70a9912c2e8c6278d85cc453503be549af8457a6930583440604`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
150217ae91e718dbeb0a9e140edd4a7f320289392ef6bb046508de403f8fba16  /tmp/v11-selfhost-8-2.nwp979/result-2.c
150217ae91e718dbeb0a9e140edd4a7f320289392ef6bb046508de403f8fba16  /tmp/v11-selfhost-8-2.nwp979/result-3.c
150217ae91e718dbeb0a9e140edd4a7f320289392ef6bb046508de403f8fba16  /tmp/v11-selfhost-8-2.nwp979/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-4에서 `self/cgc-main.fl`에 괄호·문자열 균형 검사를 넣었다. 깨진 소스는 `[CGC-ERR]`를 찍고 종료 코드 1로 끝난다. 직전 지문 `150217ae91e718dbeb0a9e140edd4a7f320289392ef6bb046508de403f8fba16`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
9b8605ffd55e0a3681a6e3b152dd20b13c3c9ebd89621505a900a04cfbe63332  /tmp/v11-selfhost-8-4.fJNTWL/result-2.c
9b8605ffd55e0a3681a6e3b152dd20b13c3c9ebd89621505a900a04cfbe63332  /tmp/v11-selfhost-8-4.fJNTWL/result-3.c
9b8605ffd55e0a3681a6e3b152dd20b13c3c9ebd89621505a900a04cfbe63332  /tmp/v11-selfhost-8-4.fJNTWL/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-5에서 `self/cgc-main.fl`에 `not=` 코드 생성을 넣었다. bootstrap의 `!=`와 같이 `fl_neq`로 내보낸다. 직전 지문 `9b8605ffd55e0a3681a6e3b152dd20b13c3c9ebd89621505a900a04cfbe63332`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
3f899b8e1a02f53b3f092af7f3c8e4bd405d7771ec8f9f060aba198986c080c7  /tmp/v11-selfhost-8-5.Qx0G5k/result-2.c
3f899b8e1a02f53b3f092af7f3c8e4bd405d7771ec8f9f060aba198986c080c7  /tmp/v11-selfhost-8-5.Qx0G5k/result-3.c
3f899b8e1a02f53b3f092af7f3c8e4bd405d7771ec8f9f060aba198986c080c7  /tmp/v11-selfhost-8-5.Qx0G5k/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-6에서 `self/cgc-main.fl`에 `now_iso`와 `text` 호출, 함수 매개변수 등록, 심볼 캡처를 넣었다. 런타임에 `fl_str_to_num`, `fl_concat`, `fl_now_iso`, `fl_text`를 넣었다. 직전 지문 `3f899b8e1a02f53b3f092af7f3c8e4bd405d7771ec8f9f060aba198986c080c7`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
d2db9cb297664369688b138cd0c86243e52a320751ec35296eb6febba278144a  /tmp/v11-selfhost-8-6.24uGIZ/result-2.c
d2db9cb297664369688b138cd0c86243e52a320751ec35296eb6febba278144a  /tmp/v11-selfhost-8-6.24uGIZ/result-3.c
d2db9cb297664369688b138cd0c86243e52a320751ec35296eb6febba278144a  /tmp/v11-selfhost-8-6.24uGIZ/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-7에서 `self/cgc-main.fl`에 Map 캡처, `json-parse` 값, `str-join`을 넣었다. 런타임에 str-split, str-trim, sort, dir-list, 술어, mapcat 등을 넣었다. 직전 지문 `d2db9cb297664369688b138cd0c86243e52a320751ec35296eb6febba278144a`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
e5362bf4d4e4cdf797f84805515a19d2ced2187f7f5d85ca65655b421de91121  /tmp/v11-selfhost-8-7b.WaFmza/result-2.c
e5362bf4d4e4cdf797f84805515a19d2ced2187f7f5d85ca65655b421de91121  /tmp/v11-selfhost-8-7b.WaFmza/result-3.c
e5362bf4d4e4cdf797f84805515a19d2ced2187f7f5d85ca65655b421de91121  /tmp/v11-selfhost-8-7b.WaFmza/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-8에서 `process_spawn`, capability, `git_*`, `http_get`을 cgc와 런타임에 넣었다. 직전 지문 `e5362bf4d4e4cdf797f84805515a19d2ced2187f7f5d85ca65655b421de91121`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
ff5f21a2fce40a645c143ab1590ae406be3ba76960a9968aa9cefd6a55b9d4fc  /tmp/v11-selfhost-8-8.DE2StU/result-2.c
ff5f21a2fce40a645c143ab1590ae406be3ba76960a9968aa9cefd6a55b9d4fc  /tmp/v11-selfhost-8-8.DE2StU/result-3.c
ff5f21a2fce40a645c143ab1590ae406be3ba76960a9968aa9cefd6a55b9d4fc  /tmp/v11-selfhost-8-8.DE2StU/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-9에서 cgc에 `try` 번역과 중첩 람다 캡처를 넣었다. json-parse 실패는 throw 한다. 직전 지문 `ff5f21a2fce40a645c143ab1590ae406be3ba76960a9968aa9cefd6a55b9d4fc`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
a743861153052a3f1dd2ec868eb8c77d4f24672bcaadf415822502bd96e0fa17  /tmp/v11-selfhost-8-9.inH4JS/result-2.c
a743861153052a3f1dd2ec868eb8c77d4f24672bcaadf415822502bd96e0fa17  /tmp/v11-selfhost-8-9.inH4JS/result-3.c
a743861153052a3f1dd2ec868eb8c77d4f24672bcaadf415822502bd96e0fa17  /tmp/v11-selfhost-8-9.inH4JS/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-10에서 json-parse/file-write 반환, evidence-manifest 파일 목록, 알 수 없는 IR은 [CGC-ERR] 후 중단, ir-validate 실패 중단을 넣었다. 직전 지문 `a743861153052a3f1dd2ec868eb8c77d4f24672bcaadf415822502bd96e0fa17`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667  /tmp/v11-selfhost-8-10.QAddvz/result-2.c
b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667  /tmp/v11-selfhost-8-10.QAddvz/result-3.c
b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667  /tmp/v11-selfhost-8-10.QAddvz/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-12에서 template-string 번역, try 밖 catch는 컴파일러가 [CGC-ERR] 후 중단, 미지 kind도 컴파일러 중단을 넣었다. 직전 지문 `b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667`에서 아래 지문으로 바뀌었다. 2번과 3번이 같아서 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.Lc0RN4/result-2.c
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.Lc0RN4/result-3.c
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.Lc0RN4/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-17, 8-13에서 마지막 값 출력은 fl-cgc-run이 생성 C만 감싸게 했고 cgc-main.fl은 8-12와 같다. 고정점 재실행 지문도 같다. 불씨 교체 없음.

```text
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.lO4jHZ/result-2.c
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.lO4jHZ/result-3.c
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.lO4jHZ/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```


2026-10-17, 8-11에서 cgc-main.fl은 바꾸지 않고 고정점만 다시 돌렸다. 지문은 8-10과 같고 불씨 `bin/cgc-bin-x86_64-seed-v11`은 교체하지 않았다.

```text
b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667  /tmp/v11-selfhost-8-11.MNaI1v/result-2.c
b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667  /tmp/v11-selfhost-8-11.MNaI1v/result-3.c
b57a72adff53c0fd6d1a06d84a86ab833e38f8ee3695f5a59929ca2a76491667  /tmp/v11-selfhost-8-11.MNaI1v/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-14에서 throw 미처리 출력 형식·`process_argv`·bound template rewrite는 runtime/`fl-cgc-run`에만 넣었고 `cgc-main.fl`은 8-12/8-13과 같다. 고정점 재실행 지문도 같다. 불씨 교체 없음.

```text
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.VHDrCf/result-2.c
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.VHDrCf/result-3.c
ca531292a0a57c74f1c4dddfb95a1b24402ac4c7168a7fb3fab8ce9f539bcc4a  /tmp/v11-selfhost-8-12.VHDrCf/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-15에서 template bound는 cgc-main.fl `fl_template_bound` + runtime, `is=`/`deftest`/`try-call`/`trace_effects`를 cgc·runtime에 넣었다. 불씨 교체 없음. 2번과 3번이 같다.

```text
a46596785841282007a3faff797bde95542810a776a2e3faf2aac54cf2dd0e7d  /tmp/v11-selfhost-8-15.p7aMNu/result-2.c
a46596785841282007a3faff797bde95542810a776a2e3faf2aac54cf2dd0e7d  /tmp/v11-selfhost-8-15.p7aMNu/result-3.c
a46596785841282007a3faff797bde95542810a776a2e3faf2aac54cf2dd0e7d  /tmp/v11-selfhost-8-15.p7aMNu/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-16에서 사용자 프로그램 last-value wrap을 generate-c로 옮기고(`cgc-main.fl` 자기 자신은 감싸지 않음), python 후처리를 없앴다. `trace_effects` 빈 껍데기는 뺐다. 불씨 교체 없음. 2번과 3번이 같다.

```text
60de5c5ef88d84ba0d605badbdb4af5c88483c90d50b7a32c9c673b48605af0a  /tmp/v11-selfhost-8-16.KVl0Lx/result-2.c
60de5c5ef88d84ba0d605badbdb4af5c88483c90d50b7a32c9c673b48605af0a  /tmp/v11-selfhost-8-16.KVl0Lx/result-3.c
60de5c5ef88d84ba0d605badbdb4af5c88483c90d50b7a32c9c673b48605af0a  /tmp/v11-selfhost-8-16.KVl0Lx/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-17에서 last-value wrap은 `--print-last` 명령줄만 따른다. 파일 이름 분기를 뺐다. 불씨 교체 없음. 2번과 3번이 같다.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-17.zLUt3O/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-17.zLUt3O/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-17.zLUt3O/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-18에서 cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17과 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-18.M0csTf/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-18.M0csTf/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-18.M0csTf/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-19에서 cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17/8-18과 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-19.tsu35f/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-19.tsu35f/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-19.tsu35f/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-20에서 cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-20.x0trw6/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-20.x0trw6/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-20.x0trw6/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-21에서 cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-21.iGX1gv/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-21.iGX1gv/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-21.iGX1gv/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-22에서 runtime/process.c의 process_spawn이 stdout·stderr를 select로 같이 비운다. cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.AjJznQ/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.AjJznQ/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.AjJznQ/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-23에서 cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.UQlLJH/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.UQlLJH/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.UQlLJH/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-24에서 cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.ArsBf0/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.ArsBf0/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-22.ArsBf0/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-25에서 runtime/collection.c에 `fl_vec_rest`와 `drop_while`을 넣었다. cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다(생성 C는 cgc-main.fl에서만 바뀜). 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-25.TXSNQb/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-25.TXSNQb/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-25.TXSNQb/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-26에서 runtime/math.c에 `fl_fn_p`를 넣었다(`fn_p`와 같이 `v.tag==FL_FN`). cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-26.M2TnB9/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-26.M2TnB9/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-26.M2TnB9/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-27에서 runtime/collection.c에 `fl_sort_by`를 넣었다(키 함수로 벡터 정렬). cgc-main.fl은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-27.cBW5dz/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-27.cBW5dz/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-27.cBW5dz/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-28에서 cgc-main.fl과 runtime은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-28.ZFPJ4u/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-28.ZFPJ4u/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-28.ZFPJ4u/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-29에서 cgc-main.fl과 runtime은 바꾸지 않았다. fl-cgc-run이 a.out을 `$TOOLS_ROOT` cwd에서 실행한다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-29.yvRzC7/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-29.yvRzC7/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-29.yvRzC7/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-30에서 cgc-main.fl과 runtime은 바꾸지 않았다. 작업 저장소 `fl-cgc-run`은 8-29와 같다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-30.Lsg0IN/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-30.Lsg0IN/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-30.Lsg0IN/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```

2026-10-18, 8-31에서 cgc-main.fl과 runtime은 바꾸지 않았다. 고정점 재실행 지문은 8-17부터와 같다. 불씨 교체 없음.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-31.F4xhid/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-31.F4xhid/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  /tmp/v11-selfhost-8-31.F4xhid/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
JS_EXEC_COUNT=0
TS_EXEC_COUNT=0
FX_OR_AFJ_OPENAT_COUNT=0
```


2026-10-18, 8-32a evidence follow-up. No source/runtime or seed file changed. The seeded strace run was blocked by sandbox ptrace restrictions; independent direct executions (without syscall tracing) produced identical result-2/3/4 hashes and both cmp exits 0. Strace-based syscall counts are therefore unavailable for this run. Evidence: <tmp>/fl-8-32/out/fixpoint.log and <tmp>/fl-8-32/fixpoint/direct.log. Status: PARTIAL.

```text
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  <tmp>/fl-8-32/fixpoint/result-2.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  <tmp>/fl-8-32/fixpoint/result-3.c
70ac32640723267361729e2056baa72dcbe6190e067068a3a20e0484c108c552  <tmp>/fl-8-32/fixpoint/result-4.c
CMP_2_3_EXIT=0
CMP_3_4_EXIT=0
```
