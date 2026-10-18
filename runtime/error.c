#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <setjmp.h>

FLValue fl_cgc_halt(void) {
    exit(1);
    return fl_nil();
}

void fl_throw(FLValue err) {
    if (fl_try_top <= 0) {
        const char* msg = "error";
        if (err.tag == FL_STRING && err.obj)
            msg = ((FLString*)err.obj)->data;
        else if (err.tag == FL_MAP) {
            FLValue m = fl_map_get(err, fl_str_val("message"));
            if (m.tag == FL_STRING && m.obj)
                msg = ((FLString*)m.obj)->data;
        }
        const char* path = getenv("FL_SOURCE_FILE");
        const char* base = path ? strrchr(path, '/') : NULL;
        base = base ? base + 1 : (path ? path : "<stdin>");
        fprintf(stderr, "\n\033[31m실행 오류\033[0m  %s:1\n", base);
        if (path) {
            FILE* f = fopen(path, "r");
            if (f) {
                char line[1024];
                if (fgets(line, sizeof line, f)) {
                    size_t n = strlen(line);
                    while (n > 0 && (line[n - 1] == '\n' || line[n - 1] == '\r'))
                        line[--n] = '\0';
                    fprintf(stderr, "  \033[31m→\033[0m    1 │ \033[31m%s\033[0m\n", line);
                }
                fprintf(stderr, "       2 │ \033[2m\033[0m\n");
                fclose(f);
            }
        }
        fprintf(stderr, "\n  \033[31m✖\033[0m %s\n", msg);
        exit(1);
    }
    fl_try_stack[fl_try_top - 1].err = err;
    longjmp(fl_try_stack[fl_try_top - 1].buf, 1);
}

FLValue fl_make_error(const char* type, const char* msg) {
    FLValue m = fl_map_new();
    m = fl_map_set(m, fl_str_val("type"),    fl_str_val(type));
    m = fl_map_set(m, fl_str_val("message"), fl_str_val(msg));
    return m;
}

/* bootstrap.js 5621-5601: is / is= / deftest counters / run-tests / test-summary */
static int _fl_test_passed = 0;
static int _fl_test_failed = 0;

static const char* _fl_cstr(FLValue v) {
    if (v.tag == FL_STRING && v.obj) return ((FLString*)v.obj)->data;
    return "";
}

FLValue fl_is(FLValue val) {
    if (!fl_truthy(val))
        fl_throw(fl_str_val("Expected truthy"));
    return val;
}

FLValue is_eq(FLValue expected, FLValue actual) {
    if (!fl_truthy(fl_eq(expected, actual))) {
        FLValue es = fl_json_stringify(expected);
        FLValue as = fl_json_stringify(actual);
        char buf[512];
        snprintf(buf, sizeof buf, "Expected %s, got %s", _fl_cstr(es), _fl_cstr(as));
        fl_throw(fl_str_val(buf));
    }
    return actual;
}

void fl_test_pass(FLValue name) {
    _fl_test_passed++;
    printf("  \u2713 %s\n", _fl_cstr(name));
}

void fl_test_fail(FLValue name, FLValue err) {
    _fl_test_failed++;
    const char* msg = "error";
    if (err.tag == FL_STRING && err.obj)
        msg = ((FLString*)err.obj)->data;
    else if (err.tag == FL_MAP) {
        FLValue m = fl_map_get(err, fl_str_val("message"));
        if (m.tag == FL_STRING && m.obj)
            msg = ((FLString*)m.obj)->data;
    }
    printf("  \u2717 %s: %s\n", _fl_cstr(name), msg);
}

FLValue test_summary(void) {
    FLValue m = fl_map_new();
    m = fl_map_set(m, fl_str_val("passed"), fl_int(_fl_test_passed));
    m = fl_map_set(m, fl_str_val("failed"), fl_int(_fl_test_failed));
    m = fl_map_set(m, fl_str_val("total"), fl_int(_fl_test_passed + _fl_test_failed));
    m = fl_map_set(m, fl_str_val("errors"), fl_vec_new());
    return m;
}

FLValue run_tests(void) {
    int total = _fl_test_passed + _fl_test_failed;
    printf("\nTest Results: %d/%d passed", _fl_test_passed, total);
    if (_fl_test_failed > 0) printf(" (%d FAILED)", _fl_test_failed);
    printf("\n");
    FLValue m = fl_map_new();
    m = fl_map_set(m, fl_str_val("passed"), fl_int(_fl_test_passed));
    m = fl_map_set(m, fl_str_val("failed"), fl_int(_fl_test_failed));
    m = fl_map_set(m, fl_str_val("total"), fl_int(total));
    _fl_test_passed = 0;
    _fl_test_failed = 0;
    return m;
}

/* bootstrap.js 29862-29775 try-call / 3881-3889 err?/ok?/unwrap */
FLValue try_call(FLValue fn) {
    FLValue m = fl_map_new();
    if (fl_try_top >= FL_TRY_MAX) {
        m = fl_map_set(m, fl_str_val("_tag"), fl_str_val("Err"));
        m = fl_map_set(m, fl_str_val("code"), fl_str_val("E_TRY_CALL"));
        m = fl_map_set(m, fl_str_val("message"), fl_str_val("operation_failed"));
        m = fl_map_set(m, fl_str_val("category"), fl_str_val("runtime-error"));
        m = fl_map_set(m, fl_str_val("recoverable"), fl_bool(true));
        return m;
    }
    if (setjmp(fl_try_stack[fl_try_top].buf) == 0) {
        fl_try_top++;
        FLValue v = (fn.tag == FL_FN) ? fl_fn_call(fn, 0, NULL) : fl_nil();
        fl_try_top--;
        m = fl_map_set(m, fl_str_val("_tag"), fl_str_val("Ok"));
        m = fl_map_set(m, fl_str_val("value"), v);
        return m;
    }
    fl_try_top--;
    m = fl_map_set(m, fl_str_val("_tag"), fl_str_val("Err"));
    m = fl_map_set(m, fl_str_val("code"), fl_str_val("E_TRY_CALL"));
    m = fl_map_set(m, fl_str_val("message"), fl_str_val("operation_failed"));
    m = fl_map_set(m, fl_str_val("category"), fl_str_val("runtime-error"));
    m = fl_map_set(m, fl_str_val("recoverable"), fl_bool(true));
    return m;
}

FLValue err_p(FLValue r) {
    if (r.tag != FL_MAP) return fl_bool(false);
    FLValue tag = fl_map_get(r, fl_str_val("_tag"));
    return fl_bool(tag.tag == FL_STRING && tag.obj &&
                   strcmp(((FLString*)tag.obj)->data, "Err") == 0);
}

FLValue ok_p(FLValue r) {
    if (r.tag != FL_MAP) return fl_bool(false);
    FLValue tag = fl_map_get(r, fl_str_val("_tag"));
    return fl_bool(tag.tag == FL_STRING && tag.obj &&
                   strcmp(((FLString*)tag.obj)->data, "Ok") == 0);
}

FLValue unwrap_result(FLValue r) {
    if (fl_truthy(ok_p(r)))
        return fl_map_get(r, fl_str_val("value"));
    fl_throw(fl_str_val("[FreeLang Result] unwrap failed"));
    return fl_nil();
}
