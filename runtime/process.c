#include "runtime.h"
#include "internal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <signal.h>

FLValue _fl_process_getcwd(void) {
    char buf[4096];
    if (!getcwd(buf, sizeof(buf))) return fl_nil();
    return fl_str_val(buf);
}
FLValue _fl_process_chdir(FLValue path) { return fl_bool(chdir(_strval(path)) == 0); }
FLValue _fl_process_pid(void)  { return fl_int((int64_t)getpid()); }
FLValue _fl_process_ppid(void) { return fl_int((int64_t)getppid()); }
FLValue _fl_process_kill(FLValue pid) { return fl_bool(kill((pid_t)pid.i, SIGTERM) == 0); }
FLValue _fl_process_exists(FLValue pid) { return fl_bool(kill((pid_t)pid.i, 0) == 0); }
FLValue _fl_process_wait(FLValue pid) {
    int status = 0;
    pid_t r = waitpid((pid_t)pid.i, &status, 0);
    return r < 0 ? fl_int(-1) : fl_int((int64_t)WEXITSTATUS(status));
}

/* popen으로 출력 캡처 — process-run */
FLValue _fl_process_run(FLValue cmd) {
    FILE* f = popen(_strval(cmd), "r");
    if (!f) return fl_nil();
    size_t sz = 0, cap = 4096;
    char* buf = malloc(cap);
    buf[0] = '\0';
    char tmp[1024];
    while (fgets(tmp, sizeof(tmp), f)) {
        size_t n = strlen(tmp);
        if (sz + n + 1 > cap) { cap = (sz + n + 1) * 2; buf = realloc(buf, cap); }
        memcpy(buf + sz, tmp, n); sz += n; buf[sz] = '\0';
    }
    pclose(f);
    FLValue r = fl_str_val(buf); free(buf); return r;
}

/* args 배열을 공백으로 join 후 popen */
FLValue _fl_process_run_args(FLValue cmd, FLValue args) {
    char full[8192];
    snprintf(full, sizeof(full), "%s", _strval(cmd));
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            strncat(full, " ", sizeof(full) - strlen(full) - 1);
            strncat(full, _strval(v->data[i]), sizeof(full) - strlen(full) - 1);
        }
    }
    return _fl_process_run(fl_str_val(full));
}

/* system()으로 상속 stdio 실행 */
FLValue _fl_run_inherit(FLValue cmd) {
    int r = system(_strval(cmd));
    return fl_int((int64_t)(r >= 0 ? WEXITSTATUS(r) : -1));
}

/* process-exec: 현재 프로세스를 cmd로 교체 (execvp) */
FLValue _fl_process_exec(FLValue cmd) {
    char buf[4096]; strncpy(buf, _strval(cmd), sizeof(buf)-1); buf[4095]='\0';
    char* argv[256]; int argc = 0;
    char* tok = strtok(buf, " \t");
    while (tok && argc < 255) { argv[argc++] = tok; tok = strtok(NULL, " \t"); }
    argv[argc] = NULL;
    execvp(argv[0], argv);
    return fl_int(-1); /* execvp 실패 시만 도달 */
}

FLValue _fl_process_exec_args(FLValue cmd, FLValue args) {
    char full[8192]; snprintf(full, sizeof(full), "%s", _strval(cmd));
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            strncat(full, " ", sizeof(full)-strlen(full)-1);
            strncat(full, _strval(v->data[i]), sizeof(full)-strlen(full)-1);
        }
    }
    return _fl_process_exec(fl_str_val(full));
}

/* fork + exec → 자식 PID 반환 */
FLValue _fl_process_spawn(FLValue cmd, FLValue args) {
    char full[8192]; snprintf(full, sizeof(full), "%s", _strval(cmd));
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            strncat(full, " ", sizeof(full)-strlen(full)-1);
            strncat(full, _strval(v->data[i]), sizeof(full)-strlen(full)-1);
        }
    }
    pid_t pid = fork();
    if (pid < 0) return fl_int(-1);
    if (pid == 0) { /* 자식 */
        _fl_process_exec(fl_str_val(full));
        _exit(1);
    }
    return fl_int((int64_t)pid);
}

/* ── try/catch 런타임 ── */
extern FLTryFrame fl_try_stack[FL_TRY_MAX];
extern int fl_try_top;

/* ── 병렬 실행 ── */
#include <sys/wait.h>

/* fl_run_parallel(fns, timeout_ms)
 * fns: FL fn 배열 — 각각 fork해서 실행
 * timeout_ms: 0이면 무제한
 * 반환: 각 fn 결과의 배열 (실패 시 nil) */
FLValue fl_run_parallel(FLValue fns, FLValue timeout_ms) {
    if (fns.tag != FL_VECTOR) return fl_vec_new();
    FLVector *v = (FLVector *)fns.obj;
    uint32_t n = v->len;
    if (n == 0) return fl_vec_new();

    /* 각 자식의 결과 파일 경로 */
    char **result_paths = malloc(n * sizeof(char *));
    pid_t *pids = malloc(n * sizeof(pid_t));

    for (uint32_t i = 0; i < n; i++) {
        result_paths[i] = malloc(64);
        snprintf(result_paths[i], 64, "/tmp/_fl_par_%d_%u", getpid(), i);
        pids[i] = -1;
    }

    /* fork & 실행 */
    for (uint32_t i = 0; i < n; i++) {
        pid_t pid = fork();
        if (pid < 0) {
            /* fork 실패 — 해당 슬롯 건너뜀 */
            continue;
        }
        if (pid == 0) {
            /* 자식 프로세스: fn 실행 후 결과 파일에 저장 */
            FLValue fn = v->data[i];
            FLValue result = fl_nil();
            if (fn.tag == FL_FN)
                result = fl_fn_call(fn, 0, NULL);

            /* 결과를 JSON으로 파일에 쓰기 */
            FLValue json_result = fl_json_stringify(result);
            if (json_result.tag == FL_STRING) {
                FILE *f = fopen(result_paths[i], "w");
                if (f) {
                    fputs(((FLString *)json_result.obj)->data, f);
                    fclose(f);
                }
            }
            /* 자식 종료 — atexit 등 방지 */
            _exit(0);
        }
        pids[i] = pid;
    }

    /* 모든 자식 대기 */
    long tms = (timeout_ms.tag == FL_INT) ? timeout_ms.i : 0;
    (void)tms; /* TODO: timeout 지원 */
    for (uint32_t i = 0; i < n; i++) {
        if (pids[i] > 0) waitpid(pids[i], NULL, 0);
    }

    /* 결과 수집 */
    FLValue results = fl_vec_new();
    for (uint32_t i = 0; i < n; i++) {
        FILE *f = fopen(result_paths[i], "r");
        if (f) {
            fseek(f, 0, SEEK_END);
            long sz = ftell(f);
            rewind(f);
            if (sz > 0) {
                char *buf = malloc((size_t)sz + 1);
                size_t rd = fread(buf, 1, (size_t)sz, f);
                buf[rd] = '\0';
                FLValue parsed = fl_json_parse(fl_str_val(buf));
                free(buf);
                results = fl_vec_push(results, parsed);
            } else {
                results = fl_vec_push(results, fl_nil());
            }
            fclose(f);
            remove(result_paths[i]);
        } else {
            results = fl_vec_push(results, fl_nil());
        }
        free(result_paths[i]);
    }

    free(result_paths);
    free(pids);
    return results;
}
