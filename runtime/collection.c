#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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

FLValue fl_append(FLValue left, FLValue right) {
    if (left.tag == FL_VECTOR && right.tag == FL_VECTOR) {
        FLVector* a = (FLVector*)left.obj;
        FLVector* b = (FLVector*)right.obj;
        uint32_t n = a->len + b->len;
        FLValue* items = n ? malloc(sizeof(FLValue) * n) : NULL;
        if (a->len) memcpy(items, a->data, sizeof(FLValue) * a->len);
        if (b->len) memcpy(items + a->len, b->data, sizeof(FLValue) * b->len);
        FLValue out = fl_vec_from(items, n);
        free(items);
        return out;
    }
    return fl_vec_push(left, right);
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

