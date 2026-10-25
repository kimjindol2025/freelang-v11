#define _POSIX_C_SOURCE 200809L
#include "runtime.h"
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static uint32_t state = 0x937a51e1u;
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
        FLValue out;
        int threw = caught(fl_json_parse, fl_str_val(buf), &out);
        int expected_invalid = i < 13 || i >= 15;
        if (expected_invalid && !threw) issues++;
    }
    pid_t child = fork();
    if (child == 0) {
        size_t depth = 10000, cap = depth * 2 + 5;
        char *deep = malloc(cap);
        if (!deep) _exit(2);
        memset(deep, '[', depth); memcpy(deep + depth, "null", 4);
        memset(deep + depth + 4, ']', depth); deep[cap - 1] = 0;
        FLValue result;
        int rejected = caught(fl_json_parse, fl_str_val(deep), &result);
        _exit(rejected ? 0 : 3);
    }
    int status = 0;
    if (child < 0 || waitpid(child, &status, 0) != child || !WIFEXITED(status) || WEXITSTATUS(status) != 0) issues++;
    printf("JSON_FUZZ iterations=%u issues=%u seed=0x937a51e1 deep_depth=10000\n", count, issues);
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
        if ((i % 5) == 0) snprintf(token, sizeof(token), "%.80s.%.80s.%.80s", token, token, token);
        (void)fl_jwt_verify(fl_str_val(token), key);
    }
    printf("JWT_FUZZ iterations=%u issues=%u seed=0x937a51e1\n", count, issues);
    return 0;
}

int main(int argc, char **argv) {
    if (argc != 3) return 2;
    unsigned count = (unsigned)strtoul(argv[2], NULL, 10);
    if (!count) return 2;
    if (!strcmp(argv[1], "json")) return run_json(count);
    if (!strcmp(argv[1], "jwt")) return run_jwt(count);
    return 2;
}
