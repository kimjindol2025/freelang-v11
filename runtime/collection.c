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

FLValue fl_any_p(FLValue fn, FLValue vec) {
    if (vec.tag == FL_NIL) return fl_nil();
    if (vec.tag != FL_VECTOR) {
        fl_throw(fl_str_val("any?: second argument must be an array"));
        return fl_nil();
    }
    FLVector* v = (FLVector*)vec.obj;
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue item = v->data[i];
        if (fl_truthy(fl_fn_call(fn, 1, &item))) return item;
    }
    return fl_nil();
}

FLValue fl_none_p(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_bool(true);
    FLVector* v = (FLVector*)vec.obj;
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue item = v->data[i];
        if (fl_truthy(fl_fn_call(fn, 1, &item))) return fl_bool(false);
    }
    return fl_bool(true);
}

FLValue fl_count_if(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_int(0);
    FLVector* v = (FLVector*)vec.obj; uint32_t count = 0;
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue item = v->data[i];
        if (fl_truthy(fl_fn_call(fn, 1, &item))) count++;
    }
    return fl_int(count);
}

FLValue fl_find_first(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_nil();
    FLVector* v = (FLVector*)vec.obj;
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue item = v->data[i];
        if (fl_truthy(fl_fn_call(fn, 1, &item))) return item;
    }
    return fl_nil();
}

FLValue fl_keep(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj; FLValue out = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue item = v->data[i], value = fl_fn_call(fn, 1, &item);
        if (value.tag != FL_NIL) out = fl_vec_push(out, value);
    }
    return out;
}

FLValue fl_map_indexed(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj; FLValue out = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue args[2] = { fl_int(i), v->data[i] };
        out = fl_vec_push(out, fl_fn_call(fn, 2, args));
    }
    return out;
}

FLValue fl_map_vals_fn(FLValue fn, FLValue map) {
    if (map.tag != FL_MAP) return fl_map_new();
    FLMap* m = (FLMap*)map.obj; FLValue out = fl_map_new();
    for (uint32_t i = 0; i < m->len; i++) {
        FLValue value = fl_fn_call(fn, 1, &m->entries[i].val);
        out = fl_map_set(out, m->entries[i].key, value);
    }
    return out;
}

static FLValue fl_comp_call(FLClosure* self, int argc, FLValue* argv) {
    if (self->nenv == 0) return argc > 0 ? argv[0] : fl_nil();
    FLValue result = fl_fn_call(self->env[self->nenv - 1], argc, argv);
    for (uint32_t i = self->nenv - 1; i > 0; i--)
        result = fl_fn_call(self->env[i - 1], 1, &result);
    return result;
}

FLValue fl_comp(uint32_t count, FLValue* fns) {
    return fl_fn_new(fl_comp_call, count, fns);
}

static FLValue fl_path_key(FLValue key) {
    if (key.tag != FL_STRING || !key.obj) return key;
    const char* s = ((FLString*)key.obj)->data;
    return s[0] == ':' ? fl_str_val(s + 1) : key;
}

FLValue fl_get_in(FLValue obj, FLValue path, FLValue default_value) {
    if (path.tag != FL_VECTOR) {
        fl_throw(fl_str_val("get-in: second argument must be an array"));
        return default_value;
    }
    FLVector* p = (FLVector*)path.obj; FLValue cur = obj;
    for (uint32_t i = 0; i < p->len; i++) {
        FLValue key = fl_path_key(p->data[i]);
        if (cur.tag == FL_MAP) cur = fl_map_get(cur, key);
        else if (cur.tag == FL_VECTOR) {
            if (key.tag == FL_STRING && key.obj) {
                const char* text = ((FLString*)key.obj)->data; char* end = NULL;
                long index = strtol(text, &end, 10);
                if (*text && end && *end == '\0') key = fl_int(index);
            }
            cur = key.tag == FL_INT ? fl_vec_get(cur, key) : fl_nil();
        }
        else return default_value;
        if (cur.tag == FL_NIL) return default_value;
    }
    return cur;
}

static FLValue fl_key_string(FLValue key) {
    if (key.tag == FL_NIL) return fl_str_val("null");
    if (key.tag == FL_STRING && key.obj) return key;
    char buf[256]; return fl_str_val(fl_to_str(key, buf, sizeof buf));
}

static FLValue fl_group_key(FLValue fn, FLValue item) {
    if (fn.tag == FL_STRING) {
        FLValue key = fl_path_key(fn), value = fl_map_get(item, key);
        return fl_key_string(value);
    }
    return fl_key_string(fl_fn_call(fn, 1, &item));
}

FLValue fl_group_by(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_map_new();
    FLVector* v = (FLVector*)vec.obj; FLValue out = fl_map_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue key = fl_group_key(fn, v->data[i]);
        FLValue group = fl_map_get(out, key);
        if (group.tag != FL_VECTOR) group = fl_vec_new();
        group = fl_vec_push(group, v->data[i]);
        out = fl_map_set(out, key, group);
    }
    return out;
}

FLValue fl_frequencies(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_map_new();
    FLVector* v = (FLVector*)vec.obj; FLValue out = fl_map_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue key = fl_key_string(v->data[i]);
        FLValue prior = fl_map_get(out, key);
        out = fl_map_set(out, key, fl_int(prior.tag == FL_INT ? prior.i + 1 : 1));
    }
    return out;
}

FLValue fl_into(FLValue target, FLValue coll) {
    if (target.tag == FL_VECTOR)
        return coll.tag == FL_VECTOR ? fl_append(target, coll) : target;
    if (target.tag == FL_MAP) {
        if (coll.tag != FL_VECTOR) return target;
        FLVector* items = (FLVector*)coll.obj; FLValue out = target;
        for (uint32_t i = 0; i < items->len; i++) {
            FLValue item = items->data[i];
            if (item.tag == FL_VECTOR && ((FLVector*)item.obj)->len == 2) {
                FLVector* pair = (FLVector*)item.obj;
                out = fl_map_set(out, pair->data[0], pair->data[1]);
            } else if (item.tag == FL_MAP && item.obj) {
                FLMap* m = (FLMap*)item.obj;
                for (uint32_t j = 0; j < m->len; j++) out = fl_map_set(out, m->entries[j].key, m->entries[j].val);
            }
        }
        return out;
    }
    return coll.tag == FL_NIL ? target : coll;
}

FLValue fl_conj(uint32_t count, FLValue* args) {
    if (!count) return fl_vec_new();
    FLValue target = args[0];
    if (target.tag == FL_VECTOR) {
        FLValue out = target;
        for (uint32_t i = 1; i < count; i++) out = fl_vec_push(out, args[i]);
        return out;
    }
    if (target.tag == FL_MAP) {
        FLValue out = target;
        for (uint32_t i = 1; i < count; i++) {
            FLValue item = args[i];
            if (item.tag == FL_VECTOR && ((FLVector*)item.obj)->len == 2) {
                FLVector* pair = (FLVector*)item.obj;
                out = fl_map_set(out, pair->data[0], pair->data[1]);
            } else if (item.tag == FL_MAP && item.obj) {
                FLMap* m = (FLMap*)item.obj;
                for (uint32_t j = 0; j < m->len; j++) out = fl_map_set(out, m->entries[j].key, m->entries[j].val);
            }
        }
        return out;
    }
    FLValue out = fl_vec_new();
    for (uint32_t i = 1; i < count; i++) out = fl_vec_push(out, args[i]);
    return out;
}

static int fl_keys_contains(FLValue keys, FLValue key) {
    if (keys.tag != FL_VECTOR) return 0;
    FLVector* v = (FLVector*)keys.obj;
    for (uint32_t i = 0; i < v->len; i++)
        if (fl_truthy(fl_eq(fl_path_key(v->data[i]), key))) return 1;
    return 0;
}

FLValue fl_obj_pick(FLValue map, FLValue keys) {
    if (map.tag != FL_MAP || keys.tag != FL_VECTOR) return fl_map_new();
    FLMap* m = (FLMap*)map.obj; FLValue out = fl_map_new();
    for (uint32_t i = 0; i < m->len; i++)
        if (fl_keys_contains(keys, m->entries[i].key)) out = fl_map_set(out, m->entries[i].key, m->entries[i].val);
    return out;
}

FLValue fl_obj_omit(FLValue map, FLValue keys) {
    if (map.tag != FL_MAP) return fl_map_new();
    FLMap* m = (FLMap*)map.obj; FLValue out = fl_map_new();
    for (uint32_t i = 0; i < m->len; i++)
        if (!fl_keys_contains(keys, m->entries[i].key)) out = fl_map_set(out, m->entries[i].key, m->entries[i].val);
    return out;
}

FLValue fl_zip_with(FLValue fn, FLValue left, FLValue right) {
    if (left.tag != FL_VECTOR || right.tag != FL_VECTOR) return fl_vec_new();
    FLVector* a = (FLVector*)left.obj; FLVector* b = (FLVector*)right.obj;
    uint32_t n = a->len < b->len ? a->len : b->len; FLValue out = fl_vec_new();
    for (uint32_t i = 0; i < n; i++) {
        FLValue args[2] = { a->data[i], b->data[i] };
        out = fl_vec_push(out, fl_fn_call(fn, 2, args));
    }
    return out;
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

FLValue fl_vec_take(FLValue count, FLValue vec) {
    int64_t n = count.tag == FL_INT ? count.i : 0;
    if (n < 0) n = 0;
    return fl_vec_slice(vec, fl_int(0), fl_int(n));
}

FLValue fl_vec_drop(FLValue count, FLValue vec) {
    int64_t n = count.tag == FL_INT ? count.i : 0;
    if (n < 0) n = 0;
    return fl_vec_slice(vec, fl_int(n), fl_vec_len(vec));
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
    if (v->len == 0) return fl_vec_new();
    FLValue r = fl_vec_new();
    for (uint32_t i = 1; i < v->len; i++) r = fl_vec_push(r, v->data[i]);
    return r;
}

FLValue drop_while(FLValue pred, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    uint32_t i = 0;
    while (i < v->len) {
        FLValue elem = v->data[i];
        if (!fl_truthy(fl_fn_call(pred, 1, &elem))) break;
        i++;
    }
    FLValue r = fl_vec_new();
    for (; i < v->len; i++) r = fl_vec_push(r, v->data[i]);
    return r;
}

typedef struct { FLValue item; FLValue key; } FlSortPair;

static int fl_sort_pair_cmp(const void *a, const void *b) {
    const FlSortPair *pa = (const FlSortPair *)a;
    const FlSortPair *pb = (const FlSortPair *)b;
    FLValue ka = pa->key, kb = pb->key;
    if (ka.tag == FL_INT && kb.tag == FL_INT) {
        if (ka.i < kb.i) return -1;
        if (ka.i > kb.i) return 1;
        return 0;
    }
    if (ka.tag == FL_FLOAT || kb.tag == FL_FLOAT) {
        double da = ka.tag == FL_FLOAT ? ka.f : (double)ka.i;
        double db = kb.tag == FL_FLOAT ? kb.f : (double)kb.i;
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
    }
    if (ka.tag == FL_STRING && kb.tag == FL_STRING && ka.obj && kb.obj) {
        return strcmp(((FLString *)ka.obj)->data, ((FLString *)kb.obj)->data);
    }
    if (ka.tag < kb.tag) return -1;
    if (ka.tag > kb.tag) return 1;
    return 0;
}

FLValue fl_sort_by(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    if (v->len == 0) return fl_vec_new();
    FlSortPair *pairs = (FlSortPair *)malloc(sizeof(FlSortPair) * v->len);
    if (!pairs) return fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        pairs[i].item = v->data[i];
        pairs[i].key = fl_fn_call(fn, 1, &v->data[i]);
    }
    qsort(pairs, v->len, sizeof(FlSortPair), fl_sort_pair_cmp);
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) r = fl_vec_push(r, pairs[i].item);
    free(pairs);
    return r;
}

FLValue reverse(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = v->len; i > 0; i--) r = fl_vec_push(r, v->data[i - 1]);
    return r;
}

FLValue fl_mapcat(FLValue fn, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* v = (FLVector*)vec.obj;
    FLValue r = fl_vec_new();
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue elem = v->data[i];
        FLValue out = fl_fn_call(fn, 1, &elem);
        if (out.tag == FL_VECTOR) r = fl_append(r, out);
        else r = fl_vec_push(r, out);
    }
    return r;
}

FLValue fl_every_p(FLValue fn, FLValue vec) {
    if (vec.tag == FL_NIL) return fl_bool(true);
    if (vec.tag != FL_VECTOR) {
        fl_throw(fl_str_val("every?: second argument must be an array"));
        return fl_bool(false);
    }
    FLVector* v = (FLVector*)vec.obj;
    for (uint32_t i = 0; i < v->len; i++) {
        FLValue elem = v->data[i];
        if (!fl_truthy(fl_fn_call(fn, 1, &elem))) return fl_bool(false);
    }
    return fl_bool(true);
}

FLValue contains_p(FLValue coll, FLValue item) {
    if (coll.tag == FL_STRING && item.tag == FL_STRING) {
        const char* s = ((FLString*)coll.obj)->data;
        const char* p = ((FLString*)item.obj)->data;
        return fl_bool(strstr(s, p) != NULL);
    }
    if (coll.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)coll.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            if (fl_truthy(fl_eq(v->data[i], item))) return fl_bool(true);
        }
        return fl_bool(false);
    }
    if (coll.tag == FL_MAP) return json_has(coll, item);
    return fl_bool(false);
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

