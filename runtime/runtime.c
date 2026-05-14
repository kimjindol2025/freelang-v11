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
            snprintf(buf, sz, "[%u items]", vec->len);
            return buf;
        }
        case FL_MAP: {
            FLMap* mp = (FLMap*)v.obj;
            snprintf(buf, sz, "{%u keys}", mp->len);
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
    if (b.i == 0) { fputs("error: division by zero\n", stderr); exit(1); }
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

FLValue fl_lt(FLValue a, FLValue b)  { return fl_bool(fl_num(a) <  fl_num(b)); }
FLValue fl_gt(FLValue a, FLValue b)  { return fl_bool(fl_num(a) >  fl_num(b)); }
FLValue fl_lte(FLValue a, FLValue b) { return fl_bool(fl_num(a) <= fl_num(b)); }
FLValue fl_gte(FLValue a, FLValue b) { return fl_bool(fl_num(a) >= fl_num(b)); }
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

/* B-3: String ops */
FLValue str_replace(FLValue s, FLValue from, FLValue to) {
    if (s.tag!=FL_STRING||from.tag!=FL_STRING||to.tag!=FL_STRING) return s;
    const char *src=((FLString*)s.obj)->data;
    const char *f=((FLString*)from.obj)->data;
    const char *t=((FLString*)to.obj)->data;
    char *pos=strstr(src,f);
    if (!pos) return s;
    size_t flen=strlen(f), tlen=strlen(t), plen=(size_t)(pos-src);
    size_t nlen=strlen(src)-flen+tlen;
    char *buf=(char*)malloc(nlen+1);
    memcpy(buf,src,plen);
    memcpy(buf+plen,t,tlen);
    strcpy(buf+plen+tlen,pos+flen);
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
