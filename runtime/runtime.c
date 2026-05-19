#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

/* ── 값 생성 ── */

FLValue fl_int(int64_t v) {
    FLValue r; r.tag = FL_INT; r.i = v; return r;
}

FLValue fl_float(double v) {
    FLValue r; r.tag = FL_FLOAT; r.f = v; return r;
}

FLValue fl_str_val(const char* s) {
    size_t len = strlen(s);
    FLString* obj = malloc(sizeof(FLString) + len + 1);
    obj->base.type = FL_STRING;
    obj->base.rc = 1;
    obj->len = (uint32_t)len;
    memcpy(obj->data, s, len + 1);
    FLValue r; r.tag = FL_STRING; r.obj = (FLObject*)obj; return r;
}

FLValue fl_bool(bool v) {
    FLValue r; r.tag = FL_BOOL; r.b = v; return r;
}

FLValue fl_nil(void) {
    FLValue r; r.tag = FL_NIL; r.i = 0; return r;
}

/* ── 조건 판별 ── */

bool fl_truthy(FLValue v) {
    switch (v.tag) {
        case FL_BOOL:   return v.b;
        case FL_NIL:    return false;
        case FL_INT:    return v.i != 0;
        case FL_FLOAT:  return v.f != 0.0;
        default:        return true;
    }
}

/* ── 문자열 변환 (출력용) ── */

static const char* fl_to_str(FLValue v, char* buf, size_t sz) {
    switch (v.tag) {
        case FL_INT:    snprintf(buf, sz, "%lld", (long long)v.i); return buf;
        case FL_FLOAT:  snprintf(buf, sz, "%g", v.f); return buf;
        case FL_BOOL:   return v.b ? "true" : "false";
        case FL_NIL:    return "nil";
        case FL_STRING: return ((FLString*)v.obj)->data;
        case FL_VECTOR: {
            FLVector* vec = (FLVector*)v.obj;
            char tmp[128];
            int pos = 0;
            buf[pos++] = '[';
            for (uint32_t i = 0; i < vec->len && pos < (int)sz - 4; i++) {
                if (i) buf[pos++] = ' ';
                const char* s = fl_to_str(vec->data[i], tmp, sizeof(tmp));
                int tlen = (int)strlen(s);
                if (pos + tlen >= (int)sz - 4) { memcpy(buf+pos,"...",3); pos+=3; break; }
                memcpy(buf+pos, s, tlen); pos += tlen;
            }
            buf[pos++] = ']'; buf[pos] = '\0';
            return buf;
        }
        case FL_MAP: {
            FLMap* mp = (FLMap*)v.obj;
            char tmp[128];
            int pos = 0;
            buf[pos++] = '{';
            for (uint32_t i = 0; i < mp->len && pos < (int)sz - 4; i++) {
                if (i) buf[pos++] = ' ';
                const char* ks = fl_to_str(mp->entries[i].key, tmp, sizeof(tmp));
                int klen = (int)strlen(ks);
                if (pos + klen >= (int)sz - 4) { memcpy(buf+pos,"...",3); pos+=3; break; }
                memcpy(buf+pos, ks, klen); pos += klen;
                buf[pos++] = ' ';
                const char* vs = fl_to_str(mp->entries[i].val, tmp, sizeof(tmp));
                int vlen = (int)strlen(vs);
                if (pos + vlen >= (int)sz - 4) { memcpy(buf+pos,"...",3); pos+=3; break; }
                memcpy(buf+pos, vs, vlen); pos += vlen;
            }
            buf[pos++] = '}'; buf[pos] = '\0';
            return buf;
        }
        case FL_FN: return "#<fn>";
        default: return "";
    }
}

/* ── 산술 ── */

FLValue fl_add(FLValue a, FLValue b) {
    if (a.tag == FL_STRING || b.tag == FL_STRING) {
        char ba[64], bb[64];
        const char* sa = fl_to_str(a, ba, sizeof(ba));
        const char* sb = fl_to_str(b, bb, sizeof(bb));
        size_t la = strlen(sa), lb = strlen(sb);
        FLString* obj = malloc(sizeof(FLString) + la + lb + 1);
        obj->base.type = FL_STRING; obj->base.rc = 1;
        obj->len = (uint32_t)(la + lb);
        memcpy(obj->data, sa, la);
        memcpy(obj->data + la, sb, lb + 1);
        FLValue r; r.tag = FL_STRING; r.obj = (FLObject*)obj; return r;
    }
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av + bv);
    }
    return fl_int(a.i + b.i);
}

FLValue fl_sub(FLValue a, FLValue b) {
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av - bv);
    }
    return fl_int(a.i - b.i);
}

FLValue fl_mul(FLValue a, FLValue b) {
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av * bv);
    }
    return fl_int(a.i * b.i);
}

FLValue fl_div(FLValue a, FLValue b) {
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av / bv);
    }
    if (b.i == 0) { fl_throw(fl_make_error("ArithmeticError", "Division by zero")); }
    return fl_int(a.i / b.i);
}

FLValue fl_mod(FLValue a, FLValue b) {
    if (b.i == 0) { fputs("error: mod by zero\n", stderr); exit(1); }
    return fl_int(a.i % b.i);
}

/* ── 비교 ── */

FLValue fl_eq(FLValue a, FLValue b) {
    if (a.tag == FL_NIL && b.tag == FL_NIL) return fl_bool(true);
    if (a.tag != b.tag) {
        if ((a.tag == FL_INT || a.tag == FL_FLOAT) && (b.tag == FL_INT || b.tag == FL_FLOAT)) {
            double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
            double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
            return fl_bool(av == bv);
        }
        return fl_bool(false);
    }
    switch (a.tag) {
        case FL_INT:    return fl_bool(a.i == b.i);
        case FL_FLOAT:  return fl_bool(a.f == b.f);
        case FL_BOOL:   return fl_bool(a.b == b.b);
        case FL_STRING: {
            const char* sa = ((FLString*)a.obj)->data;
            const char* sb = ((FLString*)b.obj)->data;
            return fl_bool(strcmp(sa, sb) == 0);
        }
        default:        return fl_bool(false);
    }
}

static double fl_num(FLValue v) {
    return (v.tag == FL_FLOAT) ? v.f : (double)v.i;
}

static int fl_str_cmp(FLValue a, FLValue b) {
    const char* sa = (a.tag==FL_STRING && a.obj) ? ((FLString*)a.obj)->data : "";
    const char* sb = (b.tag==FL_STRING && b.obj) ? ((FLString*)b.obj)->data : "";
    return strcmp(sa, sb);
}
FLValue fl_lt(FLValue a, FLValue b)  {
    if (a.tag==FL_STRING && b.tag==FL_STRING) return fl_bool(fl_str_cmp(a,b) <  0);
    return fl_bool(fl_num(a) <  fl_num(b));
}
FLValue fl_gt(FLValue a, FLValue b)  {
    if (a.tag==FL_STRING && b.tag==FL_STRING) return fl_bool(fl_str_cmp(a,b) >  0);
    return fl_bool(fl_num(a) >  fl_num(b));
}
FLValue fl_lte(FLValue a, FLValue b) {
    if (a.tag==FL_STRING && b.tag==FL_STRING) return fl_bool(fl_str_cmp(a,b) <= 0);
    return fl_bool(fl_num(a) <= fl_num(b));
}
FLValue fl_gte(FLValue a, FLValue b) {
    if (a.tag==FL_STRING && b.tag==FL_STRING) return fl_bool(fl_str_cmp(a,b) >= 0);
    return fl_bool(fl_num(a) >= fl_num(b));
}
FLValue fl_neq(FLValue a, FLValue b) { return fl_bool(!fl_truthy(fl_eq(a, b))); }

/* ── 논리 ── */

FLValue fl_not(FLValue a)             { return fl_bool(!fl_truthy(a)); }
FLValue fl_and(FLValue a, FLValue b)  { return fl_truthy(a) ? b : a; }
FLValue fl_or(FLValue a, FLValue b)   { return fl_truthy(a) ? a : b; }

/* ── 문자열 (str n-인자) ── */

FLValue fl_str_n(int count, ...) {
    if (count == 0) return fl_str_val("");
    va_list ap;
    va_start(ap, count);
    char bufs[8][64];
    const char* parts[count];
    size_t lens[count];
    size_t total = 0;
    for (int i = 0; i < count; i++) {
        FLValue v = va_arg(ap, FLValue);
        parts[i] = fl_to_str(v, bufs[i < 8 ? i : 0], 64);
        lens[i] = strlen(parts[i]);
        total += lens[i];
    }
    va_end(ap);
    FLString* obj = malloc(sizeof(FLString) + total + 1);
    obj->base.type = FL_STRING; obj->base.rc = 1;
    obj->len = (uint32_t)total;
    size_t off = 0;
    for (int i = 0; i < count; i++) {
        memcpy(obj->data + off, parts[i], lens[i]);
        off += lens[i];
    }
    obj->data[total] = '\0';
    FLValue r; r.tag = FL_STRING; r.obj = (FLObject*)obj; return r;
}

/* ── I/O ── */

FLValue fl_println(FLValue v) {
    char buf[64];
    puts(fl_to_str(v, buf, sizeof(buf)));
    return fl_nil();
}

FLValue fl_print(FLValue v) {
    char buf[64];
    fputs(fl_to_str(v, buf, sizeof(buf)), stdout);
    return fl_nil();
}

/* ── 파일 I/O ── */

/* Phase A 메모리: malloc 후 프로세스 종료 시 OS 회수. Arena는 Phase B에서 추가. */

FLValue fl_file_read(FLValue path) {
    if (path.tag != FL_STRING) return fl_nil();
    const char* p = ((FLString*)path.obj)->data;
    FILE* f = fopen(p, "rb");
    if (!f) return fl_nil();
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    rewind(f);
    FLString* obj = malloc(sizeof(FLString) + (size_t)sz + 1);
    obj->base.type = FL_STRING; obj->base.rc = 1;
    obj->len = (uint32_t)sz;
    fread(obj->data, 1, (size_t)sz, f);
    obj->data[sz] = '\0';
    fclose(f);
    FLValue r; r.tag = FL_STRING; r.obj = (FLObject*)obj; return r;
}

FLValue fl_file_write(FLValue path, FLValue content) {
    if (path.tag != FL_STRING) return fl_nil();
    const char* p = ((FLString*)path.obj)->data;
    char buf[64];
    const char* s = fl_to_str(content, buf, sizeof(buf));
    FILE* f = fopen(p, "wb");
    if (!f) return fl_nil();
    fwrite(s, 1, strlen(s), f);
    fclose(f);
    return fl_nil();
}

/* ── Vector ── */

FLValue fl_vec_new(void) {
    FLVector* v = malloc(sizeof(FLVector));
    v->base.type = FL_VECTOR; v->base.rc = 1;
    v->len = 0; v->cap = 0; v->data = NULL;
    FLValue r; r.tag = FL_VECTOR; r.obj = (FLObject*)v; return r;
}

FLValue fl_vec_from(FLValue* items, uint32_t n) {
    FLVector* v = malloc(sizeof(FLVector));
    v->base.type = FL_VECTOR; v->base.rc = 1;
    v->len = n; v->cap = n;
    v->data = n ? malloc(sizeof(FLValue) * n) : NULL;
    if (n) memcpy(v->data, items, sizeof(FLValue) * n);
    FLValue r; r.tag = FL_VECTOR; r.obj = (FLObject*)v; return r;
}

FLValue fl_vec_get(FLValue vec, FLValue idx) {
    if (vec.tag != FL_VECTOR) return fl_nil();
    FLVector* v = (FLVector*)vec.obj;
    int64_t i = (idx.tag == FL_FLOAT) ? (int64_t)idx.f : idx.i;
    if (i < 0 || (uint32_t)i >= v->len) return fl_nil();
    return v->data[i];
}

FLValue fl_vec_len(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_int(0);
    return fl_int((int64_t)((FLVector*)vec.obj)->len);
}

/* copy semantics: 새 vector 반환 */
FLValue fl_vec_push(FLValue vec, FLValue val) {
    FLVector* src = (vec.tag == FL_VECTOR) ? (FLVector*)vec.obj : NULL;
    uint32_t n = src ? src->len : 0;
    FLVector* v = malloc(sizeof(FLVector));
    v->base.type = FL_VECTOR; v->base.rc = 1;
    v->len = n + 1; v->cap = n + 1;
    v->data = malloc(sizeof(FLValue) * (n + 1));
    if (n && src->data) memcpy(v->data, src->data, sizeof(FLValue) * n);
    v->data[n] = val;
    FLValue r; r.tag = FL_VECTOR; r.obj = (FLObject*)v; return r;
}

FLValue fl_vec_set(FLValue vec, FLValue idx, FLValue val) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* src = (FLVector*)vec.obj;
    int64_t i = (idx.tag == FL_FLOAT) ? (int64_t)idx.f : idx.i;
    if (i < 0 || (uint32_t)i >= src->len) return vec;
    FLVector* v = malloc(sizeof(FLVector));
    v->base.type = FL_VECTOR; v->base.rc = 1;
    v->len = src->len; v->cap = src->len;
    v->data = malloc(sizeof(FLValue) * src->len);
    memcpy(v->data, src->data, sizeof(FLValue) * src->len);
    v->data[i] = val;
    FLValue r; r.tag = FL_VECTOR; r.obj = (FLObject*)v; return r;
}

/* ── Map ── */

FLValue fl_map_new(void) {
    FLMap* m = malloc(sizeof(FLMap));
    m->base.type = FL_MAP; m->base.rc = 1;
    m->len = 0; m->cap = 0; m->entries = NULL;
    FLValue r; r.tag = FL_MAP; r.obj = (FLObject*)m; return r;
}

/* kv: [k0,v0, k1,v1, ...], n = 쌍의 수 */
FLValue fl_map_from_pairs(FLValue* kv, uint32_t n) {
    FLMap* m = malloc(sizeof(FLMap));
    m->base.type = FL_MAP; m->base.rc = 1;
    m->len = n; m->cap = n;
    m->entries = n ? malloc(sizeof(FLMapEntry) * n) : NULL;
    for (uint32_t i = 0; i < n; i++) {
        m->entries[i].key = kv[i * 2];
        m->entries[i].val = kv[i * 2 + 1];
    }
    FLValue r; r.tag = FL_MAP; r.obj = (FLObject*)m; return r;
}

FLValue fl_map_get(FLValue map, FLValue key) {
    if (map.tag != FL_MAP) return fl_nil();
    FLMap* m = (FLMap*)map.obj;
    for (uint32_t i = 0; i < m->len; i++) {
        if (fl_truthy(fl_eq(m->entries[i].key, key)))
            return m->entries[i].val;
    }
    return fl_nil();
}

FLValue fl_map_len(FLValue map) {
    if (map.tag != FL_MAP) return fl_int(0);
    return fl_int((int64_t)((FLMap*)map.obj)->len);
}

/* copy semantics: upsert 후 새 map 반환 */
FLValue fl_map_set(FLValue map, FLValue key, FLValue val) {
    FLMap* src = (map.tag == FL_MAP) ? (FLMap*)map.obj : NULL;
    uint32_t n = src ? src->len : 0;
    /* 기존 키 탐색 */
    for (uint32_t i = 0; i < n; i++) {
        if (fl_truthy(fl_eq(src->entries[i].key, key))) {
            FLMap* m = malloc(sizeof(FLMap));
            m->base.type = FL_MAP; m->base.rc = 1;
            m->len = n; m->cap = n;
            m->entries = malloc(sizeof(FLMapEntry) * n);
            memcpy(m->entries, src->entries, sizeof(FLMapEntry) * n);
            m->entries[i].val = val;
            FLValue r; r.tag = FL_MAP; r.obj = (FLObject*)m; return r;
        }
    }
    /* 새 키 추가 */
    FLMap* m = malloc(sizeof(FLMap));
    m->base.type = FL_MAP; m->base.rc = 1;
    m->len = n + 1; m->cap = n + 1;
    m->entries = malloc(sizeof(FLMapEntry) * (n + 1));
    if (n && src->entries) memcpy(m->entries, src->entries, sizeof(FLMapEntry) * n);
    m->entries[n].key = key; m->entries[n].val = val;
    FLValue r; r.tag = FL_MAP; r.obj = (FLObject*)m; return r;
}

/* ── S7: Closure ── */

FLValue fl_fn_new(FLValue (*call)(FLClosure*, int, FLValue*),
                  uint32_t nenv, FLValue* env) {
    FLClosure* cl = malloc(sizeof(FLClosure) + sizeof(FLValue) * nenv);
    cl->base.type = FL_FN; cl->base.rc = 1;
    cl->call = call; cl->nenv = nenv;
    for (uint32_t i = 0; i < nenv; i++) cl->env[i] = env[i];
    FLValue r; r.tag = FL_FN; r.obj = (FLObject*)cl; return r;
}

FLValue fl_fn_call(FLValue fn, int argc, FLValue* argv) {
    if (fn.tag != FL_FN) { fputs("error: not a fn\n", stderr); exit(1); }
    FLClosure* cl = (FLClosure*)fn.obj;
    return cl->call(cl, argc, argv);
}

/* ── S8: 고차함수 ── */

FLValue fl_map_fn(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue elem = v->data[i];
        FLValue out = fl_fn_call(fn, 1, &elem);
        r = fl_vec_push(r, out);
    }
    return r;
}

FLValue fl_filter_fn(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue elem = v->data[i];
        if (fl_truthy(fl_fn_call(fn, 1, &elem))) r = fl_vec_push(r, elem);
    }
    return r;
}

FLValue fl_reduce_fn(FLValue fn, FLValue init, FLValue vec) {
    if (vec.tag != FL_VECTOR) return init;
    FLVector* v = (FLVector*)vec.obj;
    FLValue acc = init;
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue args[2] = { acc, v->data[i] };
        acc = fl_fn_call(fn, 2, args);
    }
    return acc;
}

/* ── S9: 맵 accessor ── */

FLValue fl_map_keys(FLValue map) {
    if (map.tag != FL_MAP) return fl_vec_new();
    FLMap* m = (FLMap*)map.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < m->len; i++) r = fl_vec_push(r, m->entries[i].key);
    return r;
}

FLValue fl_map_vals(FLValue map) {
    if (map.tag != FL_MAP) return fl_vec_new();
    FLMap* m = (FLMap*)map.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < m->len; i++) r = fl_vec_push(r, m->entries[i].val);
    return r;
}

FLValue fl_map_entries(FLValue map) {
    if (map.tag != FL_MAP) return fl_vec_new();
    FLMap* m = (FLMap*)map.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < m->len; i++) {
        FLValue pair[2] = { m->entries[i].key, m->entries[i].val };
        r = fl_vec_push(r, fl_vec_from(pair, 2));
    }
    return r;
}

/* ── S12: bridge builtins ── */

FLValue null_p(FLValue v) {
    return fl_bool(v.tag == FL_NIL);
}

FLValue get(FLValue obj, FLValue key) {
    if (obj.tag == FL_MAP) return fl_map_get(obj, key);
    if (obj.tag == FL_VECTOR) {
        if (key.tag != FL_INT) return fl_nil();
        return fl_vec_get(obj, key);
    }
    if (obj.tag == FL_STRING) {
        if (key.tag != FL_INT) return fl_nil();
        int64_t idx = key.i;
        const char* s = ((FLString*)obj.obj)->data;
        int64_t len = (int64_t)strlen(s);
        if (idx < 0 || idx >= len) return fl_nil();
        char buf[2] = { s[idx], '\0' };
        return fl_str_val(buf);
    }
    return fl_nil();
}

FLValue length(FLValue obj) {
    if (obj.tag == FL_VECTOR) return fl_vec_len(obj);
    if (obj.tag == FL_MAP)    return fl_map_len(obj);
    if (obj.tag == FL_STRING) return fl_int((int64_t)strlen(((FLString*)obj.obj)->data));
    return fl_int(0);
}

FLValue char_at(FLValue str, FLValue idx) {
    return get(str, idx);
}

/* ── S15: stdlib bridge ── */
FLValue fl_floor(FLValue x) { return x.tag==FL_FLOAT ? fl_float(floor(x.f)) : x; }
FLValue fl_ceil(FLValue x)  { return x.tag==FL_FLOAT ? fl_float(ceil(x.f))  : x; }
FLValue fl_abs(FLValue x) {
    if (x.tag==FL_INT)   return fl_int(x.i<0 ? -x.i : x.i);
    if (x.tag==FL_FLOAT) return fl_float(x.f<0 ? -x.f : x.f);
    return x;
}
FLValue fl_math_sqrt(FLValue x) {
    return fl_float(sqrt(x.tag==FL_INT ? (double)x.i : x.f));
}
FLValue fl_now(void)    { return fl_int((int64_t)time(NULL)); }
FLValue fl_now_ms(void) {
    struct timespec ts; clock_gettime(CLOCK_REALTIME, &ts);
    return fl_int(ts.tv_sec*1000LL + ts.tv_nsec/1000000LL);
}
FLValue string_p(FLValue v) { return fl_bool(v.tag==FL_STRING); }
FLValue array_p(FLValue v)  { return fl_bool(v.tag==FL_VECTOR); }
FLValue list_p(FLValue v)   { return fl_bool(v.tag==FL_VECTOR); }
FLValue map_p(FLValue v)    { return fl_bool(v.tag==FL_MAP); }
FLValue fn_p(FLValue v)     { return fl_bool(v.tag==FL_FN); }
FLValue type_of(FLValue v) {
    switch(v.tag) {
        case FL_NIL:    return fl_str_val("nil");
        case FL_INT:    return fl_str_val("number");
        case FL_FLOAT:  return fl_str_val("number");
        case FL_BOOL:   return fl_str_val("boolean");
        case FL_STRING: return fl_str_val("string");
        case FL_VECTOR: return fl_str_val("array");
        case FL_MAP:    return fl_str_val("map");
        case FL_FN:     return fl_str_val("function");
        default:        return fl_str_val("unknown");
    }
}

/* B-3: String ops */
FLValue str_replace(FLValue s, FLValue from, FLValue to) {
    if (s.tag!=FL_STRING||from.tag!=FL_STRING||to.tag!=FL_STRING) return s;
    const char *src=((FLString*)s.obj)->data;
    const char *f=((FLString*)from.obj)->data;
    const char *t=((FLString*)to.obj)->data;
    size_t flen=strlen(f);
    if (flen==0) return s;
    size_t tlen=strlen(t);
    /* global replace: 모든 occurrence 치환 */
    size_t cap=strlen(src)*2+64; char *buf=(char*)malloc(cap+1);
    size_t wi=0; const char *cur=src; const char *pos;
    while ((pos=strstr(cur,f))) {
        size_t plen=(size_t)(pos-cur);
        if (wi+plen+tlen>cap) { cap=(wi+plen+tlen)*2; buf=(char*)realloc(buf,cap+1); }
        memcpy(buf+wi,cur,plen); wi+=plen;
        memcpy(buf+wi,t,tlen); wi+=tlen;
        cur=pos+flen;
    }
    size_t rest=strlen(cur);
    if (wi+rest>cap) buf=(char*)realloc(buf,wi+rest+1);
    memcpy(buf+wi,cur,rest); buf[wi+rest]='\0';
    FLValue r=fl_str_val(buf); free(buf); return r;
}
FLValue split(FLValue s, FLValue sep) {
    if (s.tag!=FL_STRING||sep.tag!=FL_STRING) return fl_vec_new();
    const char *src=((FLString*)s.obj)->data;
    const char *d=((FLString*)sep.obj)->data;
    size_t dlen=strlen(d); FLValue vec=fl_vec_new();
    const char *p=src, *q;
    while ((q=strstr(p,d))) {
        size_t n=(size_t)(q-p); char *buf=(char*)malloc(n+1);
        memcpy(buf,p,n); buf[n]='\0';
        vec=fl_vec_push(vec,fl_str_val(buf)); free(buf); p=q+dlen;
    }
    return fl_vec_push(vec,fl_str_val(p));
}
FLValue join(FLValue vec, FLValue sep) {
    if (vec.tag!=FL_VECTOR) return fl_str_val("");
    FLVector *v=(FLVector*)vec.obj;
    const char *d=sep.tag==FL_STRING?((FLString*)sep.obj)->data:"";
    size_t dlen=strlen(d), total=0;
    for (uint32_t i=0;i<v->len;i++) {
        if (v->data[i].tag==FL_STRING) total+=strlen(((FLString*)v->data[i].obj)->data);
        if (i+1<v->len) total+=dlen;
    }
    char *buf=(char*)malloc(total+1); buf[0]='\0';
    for (uint32_t i=0;i<v->len;i++) {
        if (v->data[i].tag==FL_STRING) strcat(buf,((FLString*)v->data[i].obj)->data);
        if (i+1<v->len) strcat(buf,d);
    }
    FLValue r=fl_str_val(buf); free(buf); return r;
}

/* B-4: Range / String utilities */
FLValue range(FLValue start, FLValue end) {
    int64_t s=start.tag==FL_INT?start.i:0, e=end.tag==FL_INT?end.i:0;
    FLValue vec=fl_vec_new();
    for (int64_t i=s;i<e;i++) vec=fl_vec_push(vec,fl_int(i));
    return vec;
}
FLValue char_code_at(FLValue s, FLValue idx) {
    if (s.tag!=FL_STRING||idx.tag!=FL_INT) return fl_nil();
    const char *p=((FLString*)s.obj)->data;
    int64_t i=idx.i, len=(int64_t)strlen(p);
    if (i<0||i>=len) return fl_nil();
    return fl_int((unsigned char)p[i]);
}
FLValue substring(FLValue s, FLValue start, FLValue end) {
    /* 벡터 슬라이스 지원: (slice vec i j) → substring(vec, i, j) */
    if (s.tag==FL_VECTOR) {
        FLVector* vec=(FLVector*)s.obj;
        int64_t len=(int64_t)vec->len;
        int64_t a=start.tag==FL_INT?start.i:0, b=end.tag==FL_INT?end.i:len;
        if (a<0) a=0;
        if (b>len) b=len;
        if (a>b) a=b;
        FLValue r=fl_vec_new();
        for (int64_t i=a; i<b; i++) r=fl_vec_push(r, vec->data[i]);
        return r;
    }
    if (s.tag!=FL_STRING) return fl_str_val("");
    const char *p=((FLString*)s.obj)->data;
    int64_t len=(int64_t)strlen(p);
    int64_t a=start.tag==FL_INT?start.i:0, b=end.tag==FL_INT?end.i:len;
    if (a<0) a=0;
    if (b>len) b=len;
    if (a>b) a=b;
    size_t n=(size_t)(b-a); char *buf=(char*)malloc(n+1);
    memcpy(buf,p+a,n); buf[n]='\0';
    FLValue r=fl_str_val(buf); free(buf); return r;
}
FLValue trim(FLValue s) {
    if (s.tag!=FL_STRING) return s;
    const char *p=((FLString*)s.obj)->data;
    while (*p==' '||*p=='\t'||*p=='\n'||*p=='\r') p++;
    size_t len=strlen(p);
    while (len>0&&(p[len-1]==' '||p[len-1]=='\t'||p[len-1]=='\n'||p[len-1]=='\r')) len--;
    char *buf=(char*)malloc(len+1); memcpy(buf,p,len); buf[len]='\0';
    FLValue r=fl_str_val(buf); free(buf); return r;
}

/* B-5: index-of */
FLValue index_of(FLValue vec, FLValue val) {
    if (vec.tag!=FL_VECTOR) return fl_int(-1);
    FLVector *v=(FLVector*)vec.obj;
    for (uint32_t i=0;i<v->len;i++)
        if (fl_truthy(fl_eq(v->data[i],val))) return fl_int((int64_t)i);
    return fl_int(-1);
}
FLValue str_index_of(FLValue s, FLValue sub) {
    if (s.tag!=FL_STRING||sub.tag!=FL_STRING) return fl_int(-1);
    const char *p=strstr(((FLString*)s.obj)->data,((FLString*)sub.obj)->data);
    if (!p) return fl_int(-1);
    return fl_int((int64_t)(p-((FLString*)s.obj)->data));
}

/* ── S22: argv ── */
static FLValue _fl_argv;
static bool    _fl_argv_init = false;

void fl_init_argv(int argc, char** argv) {
    FLValue vec = fl_vec_new();
    for (int i = 1; i < argc; i++)   /* argv[0]은 프로그램 이름 — Node slice(2)와 동일 */
        vec = fl_vec_push(vec, fl_str_val(argv[i]));
    _fl_argv = vec;
    _fl_argv_init = true;
}

FLValue fl_get_argv(void) {
    return _fl_argv_init ? _fl_argv : fl_vec_new();
}

/* ── S26: atom ── */
FLValue fl_atom_new(FLValue init) { return fl_vec_from(&init, 1); }
FLValue fl_atom_deref(FLValue atom) { return fl_vec_get(atom, fl_int(0)); }
FLValue fl_atom_reset(FLValue atom, FLValue val) {
    ((FLVector*)atom.obj)->data[0] = val;
    return val;
}

FLValue fl_includes_item(FLValue vec, FLValue item) {
    if (vec.tag != FL_VECTOR) return fl_bool(false);
    FLVector* v = (FLVector*)vec.obj;
    for (uint32_t i = 0; i < v->len; i++)
        if (fl_truthy(fl_eq(v->data[i], item))) return fl_bool(true);
    return fl_bool(false);
}

FLValue fl_str_includes(FLValue s, FLValue sub) {
    if (s.tag != FL_STRING || sub.tag != FL_STRING) return fl_bool(false);
    return fl_bool(strstr(((FLString*)s.obj)->data, ((FLString*)sub.obj)->data) != NULL);
}

FLValue fl_string_p(FLValue v) { return string_p(v); }

/* ── stdlib aliases — self/all.fl compatibility ── */

FLValue fl_vec_slice(FLValue vec, FLValue start, FLValue end) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    int64_t s = start.tag == FL_INT ? start.i : 0;
    int64_t e = end.tag == FL_INT ? (end.i < 0 ? (int64_t)v->len + end.i + 1 : end.i) : (int64_t)v->len;
    if (s < 0) s = 0;
    if (e > (int64_t)v->len) e = (int64_t)v->len;
    FLValue r = fl_vec_new();
    for (int64_t i = s; i < e; i++) r = fl_vec_push(r, v->data[i]);
    return r;
}

FLValue fl_vec_last(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_nil();
    FLVector* v = (FLVector*)vec.obj;
    return v->len > 0 ? v->data[v->len-1] : fl_nil();
}

FLValue fl_map_del(FLValue map, FLValue key) {
    if (map.tag != FL_MAP) return map;
    FLMap* m = (FLMap*)map.obj;
    FLValue r = fl_map_new();
    for (uint32_t i = 0; i < m->len; i++)
        if (!fl_truthy(fl_eq(m->entries[i].key, key)))
            r = fl_map_set(r, m->entries[i].key, m->entries[i].val);
    return r;
}

FLValue fl_map_merge(FLValue a, FLValue b) {
    if (a.tag != FL_MAP) return b;
    if (b.tag != FL_MAP) return a;
    FLValue r = a;
    FLMap* mb = (FLMap*)b.obj;
    for (uint32_t i = 0; i < mb->len; i++)
        r = fl_map_set(r, mb->entries[i].key, mb->entries[i].val);
    return r;
}

FLValue fl_concat(FLValue a, FLValue b) {
    if (a.tag == FL_VECTOR && b.tag == FL_VECTOR) {
        FLValue r = a;
        FLVector* vb = (FLVector*)b.obj;
        for (uint32_t i = 0; i < vb->len; i++) r = fl_vec_push(r, vb->data[i]);
        return r;
    }
    /* string concat fallback */
    char ba[256], bb[256];
    const char* sa = fl_to_str(a, ba, sizeof(ba));
    const char* sb = fl_to_str(b, bb, sizeof(bb));
    size_t la = strlen(sa), lb = strlen(sb);
    FLString* obj = malloc(sizeof(FLString) + la + lb + 1);
    obj->base.type = FL_STRING; obj->base.rc = 1;
    obj->len = (uint32_t)(la + lb);
    memcpy(obj->data, sa, la);
    memcpy(obj->data + la, sb, lb + 1);
    FLValue r; r.tag = FL_STRING; r.obj = (FLObject*)obj; return r;
}

/* ── JSON parse / stringify (minimal implementation) ── */
#include <stdlib.h>
#include <ctype.h>

static const char* json_skip_ws(const char* p) {
    while (*p && isspace((unsigned char)*p)) p++;
    return p;
}

static FLValue json_parse_value(const char** pp);

static FLValue json_parse_string(const char** pp) {
    const char* p = *pp + 1; /* skip opening " */
    size_t cap = 64, len = 0;
    char* buf = malloc(cap);
    while (*p && *p != '"') {
        if (*p == '\\') {
            p++;
            char c = *p++;
            if (c=='n') buf[len++]='\n';
            else if (c=='t') buf[len++]='\t';
            else if (c=='r') buf[len++]='\r';
            else buf[len++]=c;
        } else {
            buf[len++] = *p++;
        }
        if (len + 4 >= cap) { cap *= 2; buf = realloc(buf, cap); }
    }
    if (*p == '"') p++;
    buf[len] = 0;
    FLValue r = fl_str_val(buf); free(buf);
    *pp = p; return r;
}

static FLValue json_parse_array(const char** pp) {
    const char* p = *pp + 1; /* skip [ */
    FLValue vec = fl_vec_new();
    p = json_skip_ws(p);
    if (*p == ']') { *pp = p+1; return vec; }
    while (*p) {
        p = json_skip_ws(p);
        FLValue v = json_parse_value(&p);
        vec = fl_vec_push(vec, v);
        p = json_skip_ws(p);
        if (*p == ',') p++;
        else break;
    }
    if (*p == ']') p++;
    *pp = p; return vec;
}

static FLValue json_parse_object(const char** pp) {
    const char* p = *pp + 1; /* skip { */
    FLValue map = fl_map_new();
    p = json_skip_ws(p);
    if (*p == '}') { *pp = p+1; return map; }
    while (*p) {
        p = json_skip_ws(p);
        if (*p != '"') break;
        FLValue key = json_parse_string(&p);
        p = json_skip_ws(p);
        if (*p == ':') p++;
        p = json_skip_ws(p);
        FLValue val = json_parse_value(&p);
        map = fl_map_set(map, key, val);
        p = json_skip_ws(p);
        if (*p == ',') p++;
        else break;
    }
    if (*p == '}') p++;
    *pp = p; return map;
}

static FLValue json_parse_value(const char** pp) {
    const char* p = json_skip_ws(*pp);
    if (*p == '"') { FLValue r = json_parse_string(&p); *pp = p; return r; }
    if (*p == '[') { FLValue r = json_parse_array(&p);  *pp = p; return r; }
    if (*p == '{') { FLValue r = json_parse_object(&p); *pp = p; return r; }
    if (strncmp(p,"null",4)==0)  { *pp=p+4; return fl_nil(); }
    if (strncmp(p,"true",4)==0)  { *pp=p+4; return fl_bool(true); }
    if (strncmp(p,"false",5)==0) { *pp=p+5; return fl_bool(false); }
    /* number */
    char* end; double d = strtod(p, &end);
    if (end > p) {
        *pp = end;
        if (d == (int64_t)d) return fl_int((int64_t)d);
        return fl_float(d);
    }
    *pp = p+1; return fl_nil();
}

FLValue fl_json_parse(FLValue src) {
    if (src.tag != FL_STRING) return fl_nil();
    FLString* s = (FLString*)src.obj;
    const char* p = s->data;
    return json_parse_value(&p);
}

static void json_stringify_buf(FLValue v, char* buf, size_t sz, size_t* pos) {
#define JCAT(fmt, ...) do { \
    int _n = snprintf(buf + *pos, sz - *pos, fmt, ##__VA_ARGS__); \
    if (_n > 0) *pos += (size_t)_n; } while(0)

    if (v.tag == FL_NIL)    { JCAT("null"); return; }
    if (v.tag == FL_BOOL)   { JCAT("%s", v.b ? "true" : "false"); return; }
    if (v.tag == FL_INT)    { JCAT("%lld", (long long)v.i); return; }
    if (v.tag == FL_FLOAT)  { JCAT("%g", v.f); return; }
    if (v.tag == FL_STRING) {
        FLString* s = (FLString*)v.obj;
        JCAT("\"");
        for (uint32_t i = 0; i < s->len && *pos < sz-4; i++) {
            char c = s->data[i];
            if (c=='"')       { JCAT("\\\""); }
            else if (c=='\\') { JCAT("\\\\"); }
            else if (c=='\n') { JCAT("\\n");  }
            else if (c=='\t') { JCAT("\\t");  }
            else              { JCAT("%c", c); }
        }
        JCAT("\""); return;
    }
    if (v.tag == FL_VECTOR) {
        FLVector* vec = (FLVector*)v.obj;
        JCAT("[");
        for (uint32_t i = 0; i < vec->len; i++) {
            if (i) JCAT(",");
            json_stringify_buf(vec->data[i], buf, sz, pos);
        }
        JCAT("]"); return;
    }
    if (v.tag == FL_MAP) {
        FLMap* m = (FLMap*)v.obj;
        JCAT("{");
        for (uint32_t i = 0; i < m->len; i++) {
            if (i) JCAT(",");
            json_stringify_buf(m->entries[i].key, buf, sz, pos);
            JCAT(":");
            json_stringify_buf(m->entries[i].val, buf, sz, pos);
        }
        JCAT("}"); return;
    }
    JCAT("null");
#undef JCAT
}

FLValue fl_json_stringify(FLValue val) {
    char buf[65536]; size_t pos = 0;
    json_stringify_buf(val, buf, sizeof(buf), &pos);
    return fl_str_val(buf);
}

/* ── 비트 연산 ── */
FLValue fl_bit_xor(FLValue a, FLValue b) { return fl_int(a.i ^ b.i); }
FLValue fl_bit_and(FLValue a, FLValue b) { return fl_int(a.i & b.i); }
FLValue fl_bit_or(FLValue a, FLValue b)  { return fl_int(a.i | b.i); }
FLValue fl_bit_shl(FLValue a, FLValue b) { return fl_int(a.i << b.i); }
FLValue fl_bit_shr(FLValue a, FLValue b) { return fl_int(a.i >> b.i); }

/* ── _fl_file_* — all.fl stdlib 래퍼용 ── */
#include <sys/stat.h>
#include <dirent.h>
#include <unistd.h>

static const char* _strval(FLValue v) {
    if (v.tag == FL_STRING && v.obj) return ((FLString*)v.obj)->data;
    return "";
}

FLValue _fl_file_append(FLValue path, FLValue content) {
    FILE* f = fopen(_strval(path), "ab");
    if (!f) return fl_bool(false);
    const char* s = _strval(content);
    fwrite(s, 1, strlen(s), f); fclose(f);
    return fl_bool(true);
}
FLValue file_exists(FLValue path) {
    struct stat st; return fl_bool(stat(_strval(path), &st) == 0);
}
FLValue _fl_file_delete(FLValue path) { return fl_bool(remove(_strval(path)) == 0); }
FLValue _fl_file_copy(FLValue src, FLValue dst) {
    FILE* in = fopen(_strval(src), "rb"); if (!in) return fl_bool(false);
    FILE* out = fopen(_strval(dst), "wb"); if (!out) { fclose(in); return fl_bool(false); }
    char buf[8192]; size_t n;
    while ((n = fread(buf,1,sizeof(buf),in)) > 0) fwrite(buf,1,n,out);
    fclose(in); fclose(out); return fl_bool(true);
}
FLValue _fl_file_rename(FLValue old, FLValue nw) { return fl_bool(rename(_strval(old), _strval(nw)) == 0); }
FLValue _fl_file_size(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_int(-1);
    return fl_int((int64_t)st.st_size);
}
FLValue _fl_file_modified(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_int(0);
    return fl_int((int64_t)st.st_mtime * 1000);
}
FLValue _fl_file_mkdir(FLValue path) { return fl_bool(mkdir(_strval(path), 0755) == 0); }
FLValue _fl_file_rmdir(FLValue path) { return fl_bool(rmdir(_strval(path)) == 0); }
FLValue _fl_file_list(FLValue path) {
    DIR* d = opendir(_strval(path));
    FLValue r = fl_vec_new();
    if (!d) return r;
    struct dirent* e;
    while ((e = readdir(d))) {
        if (strcmp(e->d_name,".") && strcmp(e->d_name,".."))
            r = fl_vec_push(r, fl_str_val(e->d_name));
    }
    closedir(d); return r;
}
FLValue _fl_file_is_file(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_bool(false);
    return fl_bool(S_ISREG(st.st_mode));
}
FLValue _fl_file_is_dir(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_bool(false);
    return fl_bool(S_ISDIR(st.st_mode));
}

/* ── _fl_env_* ── */
#include <stdlib.h>
extern char** environ;

FLValue _fl_env_get(FLValue key) {
    const char* v = getenv(_strval(key));
    return v ? fl_str_val(v) : fl_nil();
}
FLValue _fl_env_set(FLValue key, FLValue val) {
    return fl_bool(setenv(_strval(key), _strval(val), 1) == 0);
}
FLValue _fl_env_all(void) {
    FLValue r = fl_map_new();
    if (!environ) return r;
    for (int i = 0; environ[i]; i++) {
        const char* e = environ[i];
        const char* eq = strchr(e, '=');
        if (!eq) continue;
        char key[256]; int klen = (int)(eq - e);
        if (klen >= 256) klen = 255;
        strncpy(key, e, klen); key[klen] = '\0';
        r = fl_map_set(r, fl_str_val(key), fl_str_val(eq + 1));
    }
    return r;
}

/* ── str_join ── */
FLValue str_join(FLValue sep, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_str_val("");
    FLVector* v = (FLVector*)vec.obj;
    const char* s = (sep.tag == FL_STRING && sep.obj) ? ((FLString*)sep.obj)->data : "";
    size_t slen = strlen(s);
    /* 먼저 총 길이 계산 */
    size_t total = 0;
    char tmp[64];
    for (uint32_t i = 0; i < v->len; i++) {
        total += strlen(fl_to_str(v->data[i], tmp, sizeof(tmp)));
        if (i + 1 < v->len) total += slen;
    }
    char* buf = malloc(total + 1); buf[0] = '\0';
    for (uint32_t i = 0; i < v->len; i++) {
        strcat(buf, fl_to_str(v->data[i], tmp, sizeof(tmp)));
        if (i + 1 < v->len) strcat(buf, s);
    }
    FLValue r = fl_str_val(buf); free(buf); return r;
}

/* ── _fl_process_* ── */
#include <signal.h>
#include <sys/wait.h>

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
FLTryFrame fl_try_stack[FL_TRY_MAX];
int fl_try_top = 0;

void fl_throw(FLValue err) {
    if (fl_try_top <= 0) {
        if (err.tag == FL_STRING && err.obj)
            fprintf(stderr, "Uncaught error: %s\n", ((FLString*)err.obj)->data);
        else if (err.tag == FL_MAP) {
            FLValue msg = fl_map_get(err, fl_str_val("message"));
            if (msg.tag == FL_STRING && msg.obj)
                fprintf(stderr, "Uncaught error: %s\n", ((FLString*)msg.obj)->data);
            else fprintf(stderr, "Uncaught error\n");
        } else fprintf(stderr, "Uncaught error\n");
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
