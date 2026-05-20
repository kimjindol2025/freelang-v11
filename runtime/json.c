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
