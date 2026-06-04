#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

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

FLValue fl_vec_first(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_nil();
    FLVector* v = (FLVector*)vec.obj;
    return v->len > 0 ? v->data[0] : fl_nil();
}

FLValue fl_vec_rest(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    if (v->len <= 1) return fl_vec_new();
    FLValue r = fl_vec_new();
    for (uint32_t i = 1; i < v->len; i++) r = fl_vec_push(r, v->data[i]);
    return r;
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

/* ── N-07: 문자열 함수 ── */

static const char* _s(FLValue v) {
    return (v.tag == FL_STRING && v.obj) ? ((FLString*)v.obj)->data : "";
}

FLValue str_split(FLValue s, FLValue sep) {
    const char* src = _s(s);
    const char* delim = _s(sep);
    size_t dlen = strlen(delim);
    FLValue vec = fl_vec_new();
    if (dlen == 0) { vec = fl_vec_push(vec, s); return vec; }
    const char* p = src;
    const char* found;
    while ((found = strstr(p, delim)) != NULL) {
        size_t chunk = (size_t)(found - p);
        char* buf = malloc(chunk + 1);
        memcpy(buf, p, chunk); buf[chunk] = '\0';
        vec = fl_vec_push(vec, fl_str_val(buf)); free(buf);
        p = found + dlen;
    }
    vec = fl_vec_push(vec, fl_str_val(p));
    return vec;
}

FLValue str_to_upper(FLValue s) {
    const char* src = _s(s);
    size_t len = strlen(src);
    char* buf = malloc(len + 1);
    for (size_t i = 0; i <= len; i++) buf[i] = (char)toupper((unsigned char)src[i]);
    FLValue r = fl_str_val(buf); free(buf); return r;
}

FLValue str_to_lower(FLValue s) {
    const char* src = _s(s);
    size_t len = strlen(src);
    char* buf = malloc(len + 1);
    for (size_t i = 0; i <= len; i++) buf[i] = (char)tolower((unsigned char)src[i]);
    FLValue r = fl_str_val(buf); free(buf); return r;
}

FLValue str_trim(FLValue s) {
    const char* src = _s(s);
    while (*src && isspace((unsigned char)*src)) src++;
    size_t len = strlen(src);
    while (len > 0 && isspace((unsigned char)src[len-1])) len--;
    char* buf = malloc(len + 1);
    memcpy(buf, src, len); buf[len] = '\0';
    FLValue r = fl_str_val(buf); free(buf); return r;
}

FLValue str_pad_left(FLValue s, FLValue width, FLValue ch) {
    const char* src = _s(s);
    const char* pad = _s(ch);
    size_t src_len = strlen(src);
    int64_t w = (width.tag == FL_INT) ? width.i : (int64_t)width.f;
    if ((int64_t)src_len >= w) return s;
    size_t pad_n = (size_t)(w - (int64_t)src_len);
    size_t pad_ch_len = strlen(pad) > 0 ? strlen(pad) : 1;
    char* buf = malloc((size_t)w + 1);
    for (size_t i = 0; i < pad_n; i++) buf[i] = pad[i % pad_ch_len];
    memcpy(buf + pad_n, src, src_len); buf[w] = '\0';
    FLValue r = fl_str_val(buf); free(buf); return r;
}

FLValue str_pad_right(FLValue s, FLValue width, FLValue ch) {
    const char* src = _s(s);
    const char* pad = _s(ch);
    size_t src_len = strlen(src);
    int64_t w = (width.tag == FL_INT) ? width.i : (int64_t)width.f;
    if ((int64_t)src_len >= w) return s;
    size_t pad_n = (size_t)(w - (int64_t)src_len);
    size_t pad_ch_len = strlen(pad) > 0 ? strlen(pad) : 1;
    char* buf = malloc((size_t)w + 1);
    memcpy(buf, src, src_len);
    for (size_t i = 0; i < pad_n; i++) buf[src_len + i] = pad[i % pad_ch_len];
    buf[w] = '\0';
    FLValue r = fl_str_val(buf); free(buf); return r;
}

FLValue str_repeat(FLValue s, FLValue n) {
    const char* src = _s(s);
    size_t slen = strlen(src);
    int64_t cnt = (n.tag == FL_INT) ? n.i : (int64_t)n.f;
    if (cnt <= 0) return fl_str_val("");
    char* buf = malloc(slen * (size_t)cnt + 1);
    for (int64_t i = 0; i < cnt; i++) memcpy(buf + slen * (size_t)i, src, slen);
    buf[slen * (size_t)cnt] = '\0';
    FLValue r = fl_str_val(buf); free(buf); return r;
}

/* ── N-08: 컬렉션 함수 ── */

static int fl_cmp_vals(const void* a, const void* b) {
    const FLValue* va = (const FLValue*)a;
    const FLValue* vb = (const FLValue*)b;
    if (va->tag == FL_INT   && vb->tag == FL_INT)   return (va->i > vb->i) - (va->i < vb->i);
    if (va->tag == FL_FLOAT || vb->tag == FL_FLOAT) {
        double da = (va->tag==FL_FLOAT)?va->f:(double)va->i;
        double db = (vb->tag==FL_FLOAT)?vb->f:(double)vb->i;
        return (da > db) - (da < db);
    }
    if (va->tag == FL_STRING && vb->tag == FL_STRING)
        return strcmp(((FLString*)va->obj)->data, ((FLString*)vb->obj)->data);
    return 0;
}

FLValue sort(FLValue vec) {
    if (vec.tag != FL_VECTOR) return vec;
    FLVector* v = (FLVector*)vec.obj;
    FLValue* copy = malloc(sizeof(FLValue) * v->len);
    memcpy(copy, v->data, sizeof(FLValue) * v->len);
    qsort(copy, v->len, sizeof(FLValue), fl_cmp_vals);
    FLValue r = fl_vec_from(copy, v->len); free(copy); return r;
}

FLValue reverse(FLValue vec) {
    if (vec.tag != FL_VECTOR) return vec;
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (int64_t i = (int64_t)v->len - 1; i >= 0; i--)
        r = fl_vec_push(r, v->data[i]);
    return r;
}

FLValue flatten(FLValue vec) {
    if (vec.tag != FL_VECTOR) return vec;
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        if (v->data[i].tag == FL_VECTOR) {
            FLVector* inner = (FLVector*)v->data[i].obj;
            for (uint32_t j = 0; j < inner->len; j++)
                r = fl_vec_push(r, inner->data[j]);
        } else {
            r = fl_vec_push(r, v->data[i]);
        }
    }
    return r;
}

FLValue distinct(FLValue vec) {
    if (vec.tag != FL_VECTOR) return vec;
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        int found = 0;
        FLVector* rv = (FLVector*)r.obj;
        for (uint32_t j = 0; j < rv->len; j++)
            if (fl_truthy(fl_eq(rv->data[j], v->data[i]))) { found=1; break; }
        if (!found) r = fl_vec_push(r, v->data[i]);
    }
    return r;
}

FLValue take(FLValue n, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    int64_t cnt = (n.tag==FL_INT)?n.i:(int64_t)n.f;
    if (cnt < 0) cnt = 0;
    if ((uint32_t)cnt > v->len) cnt = (int64_t)v->len;
    return fl_vec_from(v->data, (uint32_t)cnt);
}

FLValue drop(FLValue n, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    int64_t cnt = (n.tag==FL_INT)?n.i:(int64_t)n.f;
    if (cnt < 0) cnt = 0;
    if ((uint32_t)cnt >= v->len) return fl_vec_new();
    return fl_vec_from(v->data + cnt, v->len - (uint32_t)cnt);
}

FLValue zip(FLValue a, FLValue b) {
    if (a.tag != FL_VECTOR || b.tag != FL_VECTOR) return fl_vec_new();
    FLVector* va = (FLVector*)a.obj;
    FLVector* vb = (FLVector*)b.obj;
    uint32_t len = va->len < vb->len ? va->len : vb->len;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < len; i++) {
        FLValue pair[2] = { va->data[i], vb->data[i] };
        r = fl_vec_push(r, fl_vec_from(pair, 2));
    }
    return r;
}

FLValue partition(FLValue n, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    int64_t sz = (n.tag==FL_INT)?n.i:(int64_t)n.f;
    if (sz <= 0) return fl_vec_new();
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i + (uint32_t)sz <= v->len; i += (uint32_t)sz)
        r = fl_vec_push(r, fl_vec_from(v->data + i, (uint32_t)sz));
    return r;
}

FLValue interpose(FLValue sep, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        if (i) r = fl_vec_push(r, sep);
        r = fl_vec_push(r, v->data[i]);
    }
    return r;
}

FLValue group_by(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_map_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_map_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue key = fl_fn_call(fn, 1, &v->data[i]);
        FLValue group = fl_map_get(r, key);
        if (group.tag != FL_VECTOR) group = fl_vec_new();
        group = fl_vec_push(group, v->data[i]);
        r = fl_map_set(r, key, group);
    }
    return r;
}

FLValue frequencies(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_map_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_map_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue cnt = fl_map_get(r, v->data[i]);
        int64_t n = (cnt.tag == FL_INT) ? cnt.i : 0;
        r = fl_map_set(r, v->data[i], fl_int(n + 1));
    }
    return r;
}

FLValue keys(FLValue map) { return fl_map_keys(map); }
FLValue vals(FLValue map) { return fl_map_vals(map); }
FLValue entries(FLValue map) { return fl_map_entries(map); }

FLValue dissoc(FLValue map, FLValue key) { return fl_map_del(map, key); }

FLValue select_keys(FLValue map, FLValue ks) {
    if (map.tag != FL_MAP || ks.tag != FL_VECTOR) return fl_map_new();
    FLVector* v = (FLVector*)ks.obj;
    FLValue r = fl_map_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue val = fl_map_get(map, v->data[i]);
        if (val.tag != FL_NIL) r = fl_map_set(r, v->data[i], val);
    }
    return r;
}

FLValue fl_min2(FLValue a, FLValue b) { return fl_truthy(fl_lt(a, b)) ? a : b; }
FLValue fl_max2(FLValue a, FLValue b) { return fl_truthy(fl_gt(a, b)) ? a : b; }

FLValue uuid(void) {
    unsigned char b[16];
    FILE* f = fopen("/dev/urandom", "rb");
    if (f) { (void)fread(b, 1, 16, f); fclose(f); }
    b[6] = (b[6] & 0x0f) | 0x40; /* version 4 */
    b[8] = (b[8] & 0x3f) | 0x80; /* variant */
    char buf[37];
    snprintf(buf, sizeof(buf),
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7],
        b[8],b[9],b[10],b[11],b[12],b[13],b[14],b[15]);
    return fl_str_val(buf);
}

