#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

static const char* json_skip_ws(const char* p) {
    while (*p && isspace((unsigned char)*p)) p++;
    return p;
}

static FLValue json_parse_value(const char** pp);

static FLValue json_parse_string(const char** pp) {
    const char* p = *pp + 1; /* skip opening " */
    size_t cap = 64, len = 0;
    char* buf = fl_malloc(cap);
    while (*p && *p != '"') {
        if (*p == '\\') {
            p++;
            char c = *p++;
            if (c=='n') buf[len++]='\n';
            else if (c=='t') buf[len++]='\t';
            else if (c=='r') buf[len++]='\r';
            else if (c=='b') buf[len++]='\b';
            else if (c=='f') buf[len++]='\f';
            else if (c=='"' || c=='\\' || c=='/') buf[len++]=c;
            else if (c=='u') {
                unsigned cp = 0;
                for (int i = 0; i < 4; i++) {
                    unsigned char h = (unsigned char)*p++;
                    cp <<= 4;
                    if (h >= '0' && h <= '9') cp |= h - '0';
                    else if (h >= 'a' && h <= 'f') cp |= h - 'a' + 10;
                    else if (h >= 'A' && h <= 'F') cp |= h - 'A' + 10;
                    else { free(buf); fl_throw(fl_str_val("json-parse: invalid unicode escape")); return fl_nil(); }
                }
                if (cp < 0x80) buf[len++] = (char)cp;
                else if (cp < 0x800) { buf[len++] = (char)(0xc0 | (cp >> 6)); buf[len++] = (char)(0x80 | (cp & 0x3f)); }
                else { buf[len++] = (char)(0xe0 | (cp >> 12)); buf[len++] = (char)(0x80 | ((cp >> 6) & 0x3f)); buf[len++] = (char)(0x80 | (cp & 0x3f)); }
            } else { free(buf); fl_throw(fl_str_val("json-parse: invalid escape")); return fl_nil(); }
        } else {
            buf[len++] = *p++;
        }
        if (len + 4 >= cap) { cap *= 2; char *next = fl_realloc(buf, cap); if (!next) { free(buf); fl_throw(fl_str_val("json-parse: out of memory")); return fl_nil(); } buf = next; }
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
    if (*p != '}') {
        fl_throw(fl_str_val("json-parse: invalid JSON"));
        return fl_nil();
    }
    p++;
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
    if (src.tag != FL_STRING || !src.obj) {
        fl_throw(fl_str_val("json-parse: invalid JSON"));
        return fl_nil();
    }
    FLString* s = (FLString*)src.obj;
    const char* p = s->data;
    FLValue v = json_parse_value(&p);
    p = json_skip_ws(p);
    if (*p != '\0') {
        fl_throw(fl_str_val("json-parse: invalid JSON"));
        return fl_nil();
    }
    return v;
}

FLValue json_parse_wrap(FLClosure* self, int argc, FLValue* argv) {
    (void)self;
    if (argc < 1 || !argv) return fl_nil();
    return fl_json_parse(argv[0]);
}

FLValue json_has(FLValue obj, FLValue key) {
    if (obj.tag == FL_STRING) obj = fl_json_parse(obj);
    if (obj.tag != FL_MAP) return fl_bool(false);
    FLMap* m = (FLMap*)obj.obj;
    for (uint32_t i = 0; i < m->len; i++) {
        if (fl_truthy(fl_eq(m->entries[i].key, key))) return fl_bool(true);
    }
    return fl_bool(false);
}

typedef struct { char *data; size_t len, cap; int failed; } JsonBuffer;

static void json_append(JsonBuffer *b, const char *s, size_t n) {
    if (b->failed || n > SIZE_MAX - b->len - 1) { b->failed = 1; return; }
    size_t need = b->len + n + 1;
    if (need > b->cap) {
        size_t cap = b->cap ? b->cap : 128;
        while (cap < need) {
            if (cap > SIZE_MAX / 2) { cap = need; break; }
            cap *= 2;
        }
        char *next = fl_realloc(b->data, cap);
        if (!next) { b->failed = 1; return; }
        b->data = next; b->cap = cap;
    }
    memcpy(b->data + b->len, s, n);
    b->len += n; b->data[b->len] = '\0';
}

static void json_stringify_buf(FLValue v, JsonBuffer *b, unsigned depth) {
    if (b->failed) return;
    if (depth > 256) { b->failed = 1; return; }
    char tmp[64];
    if (v.tag == FL_NIL) { json_append(b, "null", 4); return; }
    if (v.tag == FL_BOOL) { const char *s = v.b ? "true" : "false"; json_append(b, s, strlen(s)); return; }
    if (v.tag == FL_INT) {
        int n = snprintf(tmp, sizeof(tmp), "%lld", (long long)v.i);
        if (n > 0) json_append(b, tmp, (size_t)n);
        return;
    }
    if (v.tag == FL_FLOAT) {
        int n = snprintf(tmp, sizeof(tmp), "%.17g", v.f);
        if (n > 0) json_append(b, tmp, (size_t)n);
        return;
    }
    if (v.tag == FL_STRING && v.obj) {
        static const char hex[] = "0123456789abcdef";
        FLString *s = (FLString*)v.obj;
        json_append(b, "\"", 1);
        for (uint32_t i = 0; i < s->len && !b->failed; i++) {
            unsigned char c = (unsigned char)s->data[i];
            if (c == '"' || c == '\\') { tmp[0] = '\\'; tmp[1] = (char)c; json_append(b, tmp, 2); }
            else if (c == '\b') json_append(b, "\\b", 2);
            else if (c == '\f') json_append(b, "\\f", 2);
            else if (c == '\n') json_append(b, "\\n", 2);
            else if (c == '\r') json_append(b, "\\r", 2);
            else if (c == '\t') json_append(b, "\\t", 2);
            else if (c < 0x20) {
                tmp[0] = '\\'; tmp[1] = 'u'; tmp[2] = '0'; tmp[3] = '0';
                tmp[4] = hex[c >> 4]; tmp[5] = hex[c & 15]; json_append(b, tmp, 6);
            } else json_append(b, &s->data[i], 1);
        }
        json_append(b, "\"", 1); return;
    }
    if (v.tag == FL_VECTOR && v.obj) {
        FLVector *vec = (FLVector*)v.obj;
        json_append(b, "[", 1);
        for (uint32_t i = 0; i < vec->len && !b->failed; i++) {
            if (i) json_append(b, ",", 1);
            json_stringify_buf(vec->data[i], b, depth + 1);
        }
        json_append(b, "]", 1); return;
    }
    if (v.tag == FL_MAP && v.obj) {
        FLMap *m = (FLMap*)v.obj;
        json_append(b, "{", 1);
        for (uint32_t i = 0; i < m->len && !b->failed; i++) {
            if (i) json_append(b, ",", 1);
            json_stringify_buf(m->entries[i].key, b, depth + 1);
            json_append(b, ":", 1);
            json_stringify_buf(m->entries[i].val, b, depth + 1);
        }
        json_append(b, "}", 1); return;
    }
    json_append(b, "null", 4);
}

FLValue fl_json_stringify(FLValue val) {
    JsonBuffer b = {0};
    json_stringify_buf(val, &b, 0);
    if (b.failed) { free(b.data); return fl_nil(); }
    if (!b.data) return fl_str_val("");
    FLValue out = fl_str_val(b.data);
    free(b.data);
    return out;
}

/* ── 비트 연산 ── */
