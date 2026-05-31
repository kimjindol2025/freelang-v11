#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

/* ── Error Handling Global State ── */
FLTryFrame fl_try_stack[FL_TRY_MAX];
int fl_try_top = 0;


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

/* ── 타입 이름 (에러 메시지용) ── */

const char* fl_type_name(FLValue v) {
    switch (v.tag) {
        case FL_INT:    return "int";
        case FL_FLOAT:  return "float";
        case FL_BOOL:   return "bool";
        case FL_NIL:    return "nil";
        case FL_STRING: return "string";
        case FL_VECTOR: return "array";
        case FL_MAP:    return "map";
        case FL_FN:     return "function";
        default:        return "unknown";
    }
}

static void fl_type_error(const char* op, const char* expected, FLValue got) {
    fprintf(stderr, "[FL Error] TypeError: %s — %s 필요, %s 제공\n",
            op, expected, fl_type_name(got));
    exit(1);
}

static int fl_is_num(FLValue v) {
    return v.tag == FL_INT || v.tag == FL_FLOAT;
}

/* ── 문자열 변환 (출력용) ── */

const char* fl_to_str(FLValue v, char* buf, size_t sz) {
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
    if (!fl_is_num(a)) fl_type_error("+ (add)", "number", a);
    if (!fl_is_num(b)) fl_type_error("+ (add)", "number", b);
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av + bv);
    }
    return fl_int(a.i + b.i);
}

FLValue fl_sub(FLValue a, FLValue b) {
    if (!fl_is_num(a)) fl_type_error("- (sub)", "number", a);
    if (!fl_is_num(b)) fl_type_error("- (sub)", "number", b);
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av - bv);
    }
    return fl_int(a.i - b.i);
}

FLValue fl_mul(FLValue a, FLValue b) {
    if (!fl_is_num(a)) fl_type_error("* (mul)", "number", a);
    if (!fl_is_num(b)) fl_type_error("* (mul)", "number", b);
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        return fl_float(av * bv);
    }
    return fl_int(a.i * b.i);
}

FLValue fl_div(FLValue a, FLValue b) {
    if (!fl_is_num(a)) fl_type_error("/ (div)", "number", a);
    if (!fl_is_num(b)) fl_type_error("/ (div)", "number", b);
    if (a.tag == FL_FLOAT || b.tag == FL_FLOAT) {
        double av = (a.tag == FL_FLOAT) ? a.f : (double)a.i;
        double bv = (b.tag == FL_FLOAT) ? b.f : (double)b.i;
        if (bv == 0.0) { fprintf(stderr, "[FL Error] ArithmeticError: 0으로 나눌 수 없습니다\n"); exit(1); }
        return fl_float(av / bv);
    }
    if (b.i == 0) { fprintf(stderr, "[FL Error] ArithmeticError: 0으로 나눌 수 없습니다\n"); exit(1); }
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
