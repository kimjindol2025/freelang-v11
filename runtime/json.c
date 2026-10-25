#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <errno.h>
#include <math.h>

typedef struct { const char *p, *end; unsigned depth; } JsonParser;

static void json_invalid(void) { fl_throw(fl_str_val("json-parse: invalid JSON")); }
static void json_skip_ws(JsonParser *parser) {
    while (parser->p < parser->end && (*parser->p == ' ' || *parser->p == '\t' ||
           *parser->p == '\n' || *parser->p == '\r')) parser->p++;
}
static FLValue json_parse_value(JsonParser *parser);

static int json_hex4(JsonParser *parser, unsigned *out) {
    unsigned value = 0;
    for (int i = 0; i < 4; i++) {
        if (parser->p >= parser->end) return 0;
        unsigned char h = (unsigned char)*parser->p++;
        value <<= 4;
        if (h >= '0' && h <= '9') value |= h - '0';
        else if (h >= 'a' && h <= 'f') value |= h - 'a' + 10;
        else if (h >= 'A' && h <= 'F') value |= h - 'A' + 10;
        else return 0;
    }
    *out = value;
    return 1;
}

static void json_utf8(char *buf, size_t *len, unsigned cp) {
    if (cp < 0x80) buf[(*len)++] = (char)cp;
    else if (cp < 0x800) { buf[(*len)++] = (char)(0xc0 | (cp >> 6)); buf[(*len)++] = (char)(0x80 | (cp & 0x3f)); }
    else if (cp < 0x10000) { buf[(*len)++] = (char)(0xe0 | (cp >> 12)); buf[(*len)++] = (char)(0x80 | ((cp >> 6) & 0x3f)); buf[(*len)++] = (char)(0x80 | (cp & 0x3f)); }
    else { buf[(*len)++] = (char)(0xf0 | (cp >> 18)); buf[(*len)++] = (char)(0x80 | ((cp >> 12) & 0x3f)); buf[(*len)++] = (char)(0x80 | ((cp >> 6) & 0x3f)); buf[(*len)++] = (char)(0x80 | (cp & 0x3f)); }
}

static size_t json_raw_utf8_size(const unsigned char *p, const unsigned char *end) {
    if (*p >= 0xc2 && *p <= 0xdf) {
        if (end - p < 2 || (p[1] & 0xc0) != 0x80) return 0;
        return 2;
    }
    if (*p >= 0xe0 && *p <= 0xef) {
        if (end - p < 3 || (p[1] & 0xc0) != 0x80 || (p[2] & 0xc0) != 0x80 ||
            (*p == 0xe0 && p[1] < 0xa0) || (*p == 0xed && p[1] >= 0xa0)) return 0;
        return 3;
    }
    if (*p >= 0xf0 && *p <= 0xf4) {
        if (end - p < 4 || (p[1] & 0xc0) != 0x80 || (p[2] & 0xc0) != 0x80 || (p[3] & 0xc0) != 0x80 ||
            (*p == 0xf0 && p[1] < 0x90) || (*p == 0xf4 && p[1] >= 0x90)) return 0;
        return 4;
    }
    return 0;
}

static void json_string_grow(char **buf, size_t *cap, size_t len, size_t add) {
    if (add > SIZE_MAX - len - 1) json_invalid();
    size_t need = len + add + 1;
    if (need <= *cap) return;
    size_t next = *cap;
    while (next < need) {
        if (next > SIZE_MAX / 2) { next = need; break; }
        next *= 2;
    }
    *buf = fl_realloc(*buf, next);
    *cap = next;
}

static FLValue json_parse_string(JsonParser *parser) {
    parser->p++;
    size_t cap = 64, len = 0;
    char *buf = fl_malloc(cap);
    while (parser->p < parser->end && *parser->p != '"') {
        unsigned char c = (unsigned char)*parser->p++;
        unsigned cp = c;
        if (c < 0x20) { free(buf); json_invalid(); }
        if (c >= 0x80) {
            size_t width = json_raw_utf8_size((const unsigned char *)parser->p - 1,
                                              (const unsigned char *)parser->end);
            if (!width) { free(buf); json_invalid(); }
            json_string_grow(&buf, &cap, len, width);
            memcpy(buf + len, parser->p - 1, width);
            len += width;
            parser->p += width - 1;
            continue;
        }
        if (c == '\\') {
            if (parser->p >= parser->end) { free(buf); json_invalid(); }
            c = (unsigned char)*parser->p++;
            if (c == '"' || c == '\\' || c == '/') cp = c;
            else if (c == 'b') cp = '\b'; else if (c == 'f') cp = '\f';
            else if (c == 'n') cp = '\n'; else if (c == 'r') cp = '\r'; else if (c == 't') cp = '\t';
            else if (c == 'u') {
                if (!json_hex4(parser, &cp)) { free(buf); json_invalid(); }
                if (cp >= 0xd800 && cp <= 0xdbff) {
                    unsigned low = 0;
                    if (parser->end - parser->p < 6 || parser->p[0] != '\\' || parser->p[1] != 'u') { free(buf); json_invalid(); }
                    parser->p += 2;
                    if (!json_hex4(parser, &low) || low < 0xdc00 || low > 0xdfff) { free(buf); json_invalid(); }
                    cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
                } else if (cp >= 0xdc00 && cp <= 0xdfff) { free(buf); json_invalid(); }
            } else { free(buf); json_invalid(); }
        }
        size_t add = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
        json_string_grow(&buf, &cap, len, add);
        json_utf8(buf, &len, cp);
    }
    if (parser->p >= parser->end || *parser->p != '"') { free(buf); json_invalid(); }
    parser->p++;
    buf[len] = 0;
    FLString *string = fl_malloc(sizeof(*string) + len + 1);
    string->base.type = FL_STRING; string->base.rc = 1; string->len = (uint32_t)len;
    memcpy(string->data, buf, len + 1);
    FLValue result = {.tag=FL_STRING,.obj=(FLObject *)string};
    free(buf);
    return result;
}

static FLValue json_parse_array(JsonParser *parser) {
    if (++parser->depth > 256) json_invalid();
    parser->p++;
    FLValue vec = fl_vec_new();
    json_skip_ws(parser);
    if (parser->p < parser->end && *parser->p == ']') { parser->p++; parser->depth--; return vec; }
    for (;;) {
        vec = fl_vec_push(vec, json_parse_value(parser));
        json_skip_ws(parser);
        if (parser->p >= parser->end) json_invalid();
        if (*parser->p == ']') { parser->p++; parser->depth--; return vec; }
        if (*parser->p != ',') json_invalid();
        parser->p++;
        json_skip_ws(parser);
        if (parser->p >= parser->end || *parser->p == ']') json_invalid();
    }
}

static FLValue json_parse_object(JsonParser *parser) {
    if (++parser->depth > 256) json_invalid();
    parser->p++;
    FLValue map = fl_map_new();
    json_skip_ws(parser);
    if (parser->p < parser->end && *parser->p == '}') { parser->p++; parser->depth--; return map; }
    for (;;) {
        if (parser->p >= parser->end || *parser->p != '"') json_invalid();
        FLValue key = json_parse_string(parser);
        json_skip_ws(parser);
        if (parser->p >= parser->end || *parser->p != ':') json_invalid();
        parser->p++;
        FLValue value = json_parse_value(parser);
        map = fl_map_set(map, key, value);
        json_skip_ws(parser);
        if (parser->p >= parser->end) json_invalid();
        if (*parser->p == '}') { parser->p++; parser->depth--; return map; }
        if (*parser->p != ',') json_invalid();
        parser->p++;
        json_skip_ws(parser);
    }
}

static FLValue json_parse_number(JsonParser *parser) {
    const char *start = parser->p;
    if (*parser->p == '-') parser->p++;
    if (parser->p >= parser->end) json_invalid();
    if (*parser->p == '0') parser->p++;
    else {
        if (*parser->p < '1' || *parser->p > '9') json_invalid();
        while (parser->p < parser->end && *parser->p >= '0' && *parser->p <= '9') parser->p++;
    }
    int integral = 1;
    if (parser->p < parser->end && *parser->p == '.') {
        integral = 0; parser->p++;
        if (parser->p >= parser->end || *parser->p < '0' || *parser->p > '9') json_invalid();
        while (parser->p < parser->end && *parser->p >= '0' && *parser->p <= '9') parser->p++;
    }
    if (parser->p < parser->end && (*parser->p == 'e' || *parser->p == 'E')) {
        integral = 0; parser->p++;
        if (parser->p < parser->end && (*parser->p == '+' || *parser->p == '-')) parser->p++;
        if (parser->p >= parser->end || *parser->p < '0' || *parser->p > '9') json_invalid();
        while (parser->p < parser->end && *parser->p >= '0' && *parser->p <= '9') parser->p++;
    }
    size_t len = (size_t)(parser->p - start);
    char local[128], *number = local;
    if (len >= sizeof(local)) { number = fl_malloc(len + 1); }
    memcpy(number, start, len); number[len] = 0;
    FLValue result;
    if (integral) {
        errno = 0;
        char *end = NULL; long long value = strtoll(number, &end, 10);
        if (end && *end == 0 && errno != ERANGE) result = fl_int((int64_t)value);
        else integral = 0;
    }
    if (!integral) {
        errno = 0;
        char *end = NULL; double value = strtod(number, &end);
        if (!end || *end || !isfinite(value)) { if (number != local) free(number); json_invalid(); }
        result = fl_float(value);
    }
    if (number != local) free(number);
    return result;
}

static FLValue json_parse_value(JsonParser *parser) {
    json_skip_ws(parser);
    if (parser->p >= parser->end) json_invalid();
    if (*parser->p == '"') return json_parse_string(parser);
    if (*parser->p == '[') return json_parse_array(parser);
    if (*parser->p == '{') return json_parse_object(parser);
    if (parser->end - parser->p >= 4 && memcmp(parser->p, "null", 4) == 0) { parser->p += 4; return fl_nil(); }
    if (parser->end - parser->p >= 4 && memcmp(parser->p, "true", 4) == 0) { parser->p += 4; return fl_bool(true); }
    if (parser->end - parser->p >= 5 && memcmp(parser->p, "false", 5) == 0) { parser->p += 5; return fl_bool(false); }
    return json_parse_number(parser);
}

FLValue fl_json_parse(FLValue src) {
    if (src.tag != FL_STRING || !src.obj) {
        fl_throw(fl_str_val("json-parse: invalid JSON"));
        return fl_nil();
    }
    FLString* s = (FLString*)src.obj;
    if (s->len > 2u * 1024u * 1024u || memchr(s->data, '\0', s->len)) json_invalid();
    JsonParser parser = {s->data, s->data + s->len, 0};
    FLValue v = json_parse_value(&parser);
    json_skip_ws(&parser);
    if (parser.p != parser.end) json_invalid();
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
