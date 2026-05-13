#ifndef FREELANG_RUNTIME_H
#define FREELANG_RUNTIME_H

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdarg.h>

/* ── ABI 헌법 (self/ABI.md) ── */

typedef enum {
    FL_INT,
    FL_FLOAT,
    FL_BOOL,
    FL_NIL,
    FL_STRING,
    FL_VECTOR,
    FL_MAP,
    FL_FN
} FLTag;

typedef struct FLObject FLObject;

typedef struct {
    FLTag tag;
    union {
        int64_t  i;
        double   f;
        bool     b;
        FLObject* obj;
    };
} FLValue;

struct FLObject {
    FLTag    type;
    uint32_t rc;
};

typedef struct {
    FLObject base;
    uint32_t len;
    char     data[];
} FLString;

/* ── S5: Heap Object System ── */

typedef struct {
    FLValue key;
    FLValue val;
} FLMapEntry;

typedef struct {
    FLObject  base;   /* type = FL_VECTOR */
    uint32_t  len;
    uint32_t  cap;
    FLValue*  data;
} FLVector;

typedef struct {
    FLObject    base;  /* type = FL_MAP */
    uint32_t    len;
    uint32_t    cap;
    FLMapEntry* entries;
} FLMap;

/* ── 값 생성 ── */
FLValue fl_int(int64_t v);
FLValue fl_float(double v);
FLValue fl_str_val(const char* s);
FLValue fl_bool(bool v);
FLValue fl_nil(void);

/* ── 조건 판별 ── */
bool fl_truthy(FLValue v);

/* ── 산술 ── */
FLValue fl_add(FLValue a, FLValue b);
FLValue fl_sub(FLValue a, FLValue b);
FLValue fl_mul(FLValue a, FLValue b);
FLValue fl_div(FLValue a, FLValue b);
FLValue fl_mod(FLValue a, FLValue b);

/* ── 비교 ── */
FLValue fl_eq(FLValue a, FLValue b);
FLValue fl_lt(FLValue a, FLValue b);
FLValue fl_gt(FLValue a, FLValue b);
FLValue fl_lte(FLValue a, FLValue b);
FLValue fl_gte(FLValue a, FLValue b);
FLValue fl_neq(FLValue a, FLValue b);

/* ── 논리 ── */
FLValue fl_not(FLValue a);
FLValue fl_and(FLValue a, FLValue b);
FLValue fl_or(FLValue a, FLValue b);

/* ── 문자열 ── */
FLValue fl_str_n(int count, ...);

/* ── I/O ── */
FLValue fl_println(FLValue v);
FLValue fl_print(FLValue v);

/* ── 파일 I/O ── */
FLValue fl_file_read(FLValue path);
FLValue fl_file_write(FLValue path, FLValue content);

/* ── Vector ── */
FLValue fl_vec_new(void);
FLValue fl_vec_from(FLValue* items, uint32_t n);
FLValue fl_vec_get(FLValue vec, FLValue idx);
FLValue fl_vec_set(FLValue vec, FLValue idx, FLValue val);
FLValue fl_vec_push(FLValue vec, FLValue val);
FLValue fl_vec_len(FLValue vec);

/* ── Map ── */
FLValue fl_map_new(void);
FLValue fl_map_from_pairs(FLValue* kv, uint32_t n); /* n = 쌍의 수 */
FLValue fl_map_get(FLValue map, FLValue key);
FLValue fl_map_set(FLValue map, FLValue key, FLValue val);
FLValue fl_map_len(FLValue map);

/* ── S7: Closure ── */
typedef struct FLClosure {
    FLObject base;   /* type = FL_FN */
    FLValue (*call)(struct FLClosure* self, int argc, FLValue* argv);
    uint32_t nenv;
    FLValue  env[];  /* flexible array — captured values */
} FLClosure;

FLValue fl_fn_new(FLValue (*call)(FLClosure*, int, FLValue*),
                  uint32_t nenv, FLValue* env);
FLValue fl_fn_call(FLValue fn, int argc, FLValue* argv);

#endif /* FREELANG_RUNTIME_H */
