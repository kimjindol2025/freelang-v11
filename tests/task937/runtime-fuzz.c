#define _POSIX_C_SOURCE 200809L
#include "runtime.h"
#include <setjmp.h>
#include <stdint.h>
#include <dirent.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <signal.h>
#include <setjmp.h>
#include <sys/time.h>
#include <unistd.h>

static uint32_t state = 0x937a51e1u;
static sigjmp_buf timeout_jump;
static void timeout_handler(int signal_number) { (void)signal_number; siglongjmp(timeout_jump, 1); }
static uint32_t next_u32(void) {
    state ^= state << 13; state ^= state >> 17; state ^= state << 5;
    return state;
}

static int caught(FLValue (*fn)(FLValue), FLValue arg, FLValue *out) {
    if (setjmp(fl_try_stack[0].buf) == 0) {
        fl_try_top = 1;
        *out = fn(arg);
        fl_try_top = 0;
        return 0;
    }
    fl_try_top = 0;
    *out = fl_nil();
    return 1;
}

static int timed_caught(FLValue (*fn)(FLValue), FLValue arg, FLValue *out) {
    struct itimerval timer = {.it_value={.tv_sec=1}};
    if (sigsetjmp(timeout_jump, 1) == 0) {
        setitimer(ITIMER_REAL, &timer, NULL);
        int result = caught(fn, arg, out);
        timer.it_value.tv_sec = timer.it_value.tv_usec = 0;
        setitimer(ITIMER_REAL, &timer, NULL);
        return result;
    }
    timer.it_value.tv_sec = timer.it_value.tv_usec = 0;
    setitimer(ITIMER_REAL, &timer, NULL);
    fl_try_top = 0;
    return -1;
}

static int timed_jwt(FLValue token, FLValue key) {
    struct itimerval timer = {.it_value={.tv_sec=1}};
    if (sigsetjmp(timeout_jump, 1) == 0) {
        setitimer(ITIMER_REAL, &timer, NULL);
        (void)fl_jwt_verify(token, key);
        timer.it_value.tv_sec = timer.it_value.tv_usec = 0;
        setitimer(ITIMER_REAL, &timer, NULL);
        return 0;
    }
    timer.it_value.tv_sec = timer.it_value.tv_usec = 0;
    setitimer(ITIMER_REAL, &timer, NULL);
    fl_try_top = 0;
    return -1;
}

static int run_json(unsigned count) {
    unsigned issues = 0;
    static const char *seeds[] = {
        "{", "[", "[1,]", "\"unterminated", "\"\\u12\"", "[{}", "{\"a\" 1}",
        "01", "-", "1.", "truex", "\\x", "{\"a\":true,}", "null", "[1,2,3]"
    };
    for (unsigned i = 0; i < count; i++) {
        char buf[256]; size_t n;
        if (i < sizeof(seeds) / sizeof(seeds[0])) {
            snprintf(buf, sizeof(buf), "%s", seeds[i]); n = strlen(buf);
        } else {
            n = 2 + next_u32() % 126;
            buf[0] = '[';
            for (size_t j = 1; j + 1 < n; j++) buf[j] = (char)(next_u32() & 0xff);
            buf[n - 1] = ',';
            buf[n] = 0;
        }
        FLString *raw = malloc(sizeof(*raw) + n + 1);
        if (!raw) return 2;
        raw->base.type = FL_STRING; raw->base.rc = 1; raw->len = (uint32_t)n;
        memcpy(raw->data, buf, n + 1);
        FLValue out;
        int threw = timed_caught(fl_json_parse, (FLValue){.tag=FL_STRING,.obj=(FLObject *)raw}, &out);
        if (threw < 0) { issues++; printf("JSON_TIMEOUT case=%u timeout_ms=1000\n", i); break; }
        int expected_invalid = i < 13 || i >= 15;
        if (expected_invalid && !threw) {
            if (issues < 16) {
                char path[96]; snprintf(path, sizeof(path), "tests/fuzz-crashers/json-%04u.bin", i);
                FILE *f = fopen(path, "wb"); if (f) { fwrite(buf, 1, n, f); fclose(f); }
            }
            issues++;
        }
    }
    pid_t child = fork();
    if (child == 0) {
        size_t depth = 10000, cap = depth * 2 + 5;
        char *deep = malloc(cap);
        if (!deep) _exit(2);
        memset(deep, '[', depth); memcpy(deep + depth, "null", 4);
        memset(deep + depth + 4, ']', depth); deep[cap - 1] = 0;
        FLValue result;
        int rejected = timed_caught(fl_json_parse, fl_str_val(deep), &result);
        if (!rejected) {
            FILE *f = fopen("tests/fuzz-crashers/json-depth-10000.json", "wb");
            if (f) { fwrite(deep, 1, cap - 1, f); fclose(f); }
        }
        _exit(rejected ? 0 : 3);
    }
    int status = 0;
    if (child < 0 || waitpid(child, &status, 0) != child || !WIFEXITED(status) || WEXITSTATUS(status) != 0) issues++;
    printf("JSON_FUZZ iterations=%u issues=%u seed=0x937a51e1 deep_depth=10000\n", count, issues);
    DIR *dir = opendir("tests/fuzz-crashers");
    unsigned regressions = 0, regression_issues = 0;
    if (!dir) return 2;
    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        if (strncmp(entry->d_name, "json-", 5) != 0) continue;
        char path[256]; snprintf(path, sizeof(path), "tests/fuzz-crashers/%s", entry->d_name);
        FILE *f = fopen(path, "rb"); if (!f) { closedir(dir); return 2; }
        if (fseek(f, 0, SEEK_END) != 0) { fclose(f); closedir(dir); return 2; }
        long size = ftell(f); rewind(f);
        if (size < 0 || size > 2 * 1024 * 1024) { fclose(f); closedir(dir); return 2; }
        FLString *raw = malloc(sizeof(*raw) + (size_t)size + 1);
        if (!raw) { fclose(f); closedir(dir); return 2; }
        raw->base.type=FL_STRING; raw->base.rc=1; raw->len=(uint32_t)size;
        if (fread(raw->data,1,(size_t)size,f)!=(size_t)size) { fclose(f); closedir(dir); return 2; }
        fclose(f); raw->data[size]=0;
        FLValue parsed; int timed = timed_caught(fl_json_parse,(FLValue){.tag=FL_STRING,.obj=(FLObject *)raw},&parsed);
        if (timed < 0) regression_issues++;
        else regression_issues += (unsigned)!timed;
        regressions++;
    }
    closedir(dir);
    printf("JSON_CRASHER_REGRESSION cases=%u issues=%u\n", regressions, regression_issues);
    issues += regression_issues;
    unsigned edge_passed = 0;
    FLValue korean = fl_json_parse(fl_str_val("\"한글\""));
    if (korean.tag == FL_STRING && ((FLString *)korean.obj)->len == strlen("한글") &&
        memcmp(((FLString *)korean.obj)->data, "한글", strlen("한글")) == 0) edge_passed++;
    FLValue nul = fl_json_parse(fl_str_val("\"\\u0000x\""));
    if (nul.tag == FL_STRING && ((FLString *)nul.obj)->len == 2 &&
        ((FLString *)nul.obj)->data[0] == 0 && ((FLString *)nul.obj)->data[1] == 'x') edge_passed++;
    FLValue invalid_utf8;
    char bad_utf8[] = {'"', (char)0xff, '"', 0};
    if (timed_caught(fl_json_parse, fl_str_val(bad_utf8), &invalid_utf8) == 1) edge_passed++;
    printf("JSON_EDGE_REGRESSION=%u/3\n", edge_passed);
    if (edge_passed != 3) issues++;
    return issues ? 1 : 0;
}

static int run_jwt(unsigned count) {
    unsigned issues = 0;
    FLValue key = fl_str_val("fuzz-test-only-secret-key-32-bytes-minimum");
    for (unsigned i = 0; i < count; i++) {
        char token[320]; size_t n = next_u32() % 256;
        for (size_t j = 0; j < n; j++) {
            static const char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_!.";
            token[j] = alphabet[next_u32() % (sizeof(alphabet) - 1)];
        }
        token[n] = 0;
        if ((i % 5) == 0) {
            char base[256]; memcpy(base, token, n + 1);
            snprintf(token, sizeof(token), "%.80s.%.80s.%.80s", base, base, base);
        }
        if (timed_jwt(fl_str_val(token), key) != 0) { issues++; printf("JWT_TIMEOUT case=%u timeout_ms=1000\n", i); break; }
    }
    printf("JWT_FUZZ iterations=%u issues=%u seed=0x937a51e1\n", count, issues);
    return 0;
}

int main(int argc, char **argv) {
    if (argc != 3) return 2;
    signal(SIGALRM, timeout_handler);
    unsigned count = (unsigned)strtoul(argv[2], NULL, 10);
    if (!count) return 2;
    if (!strcmp(argv[1], "json")) return run_json(count);
    if (!strcmp(argv[1], "jwt")) return run_jwt(count);
    return 2;
}
