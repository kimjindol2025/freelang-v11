#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <ctype.h>

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
FLValue fl_fn_p(FLValue v)  { return fl_bool(v.tag==FL_FN); }
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
FLValue fl_str_join(FLValue a, FLValue b) {
    if (a.tag == FL_VECTOR) return join(a, b);
    if (b.tag == FL_VECTOR) return join(b, a);
    return fl_str_val("");
}
static FLValue _fl_template_fill(FLValue tmpl, FLValue env, int use_env) {
    if (tmpl.tag != FL_STRING || !tmpl.obj) return fl_str_val("");
    const char* s = ((FLString*)tmpl.obj)->data;
    size_t n = strlen(s);
    size_t cap = n + 1;
    char* out = (char*)malloc(cap);
    size_t w = 0;
    for (size_t i = 0; i < n; ) {
        if (s[i] == '$' && i + 1 < n && s[i + 1] == '{') {
            i += 2;
            size_t start = i;
            while (i < n && s[i] != '}') i++;
            size_t len = i - start;
            if (i < n && s[i] == '}') i++;
            if (use_env && env.tag == FL_MAP && len > 0) {
                char ident[128];
                if (len >= sizeof ident) len = sizeof ident - 1;
                memcpy(ident, s + start, len);
                ident[len] = '\0';
                FLValue v = fl_map_get(env, fl_str_val(ident));
                const char* ins = "";
                char nbuf[64];
                if (v.tag == FL_STRING && v.obj) ins = ((FLString*)v.obj)->data;
                else if (v.tag == FL_INT) {
                    snprintf(nbuf, sizeof nbuf, "%lld", (long long)v.i);
                    ins = nbuf;
                } else if (v.tag == FL_BOOL) ins = v.b ? "true" : "false";
                else if (v.tag == FL_NIL) ins = "";
                size_t il = strlen(ins);
                if (w + il + 1 >= cap) {
                    cap = (w + il + 1) * 2;
                    out = (char*)realloc(out, cap);
                }
                memcpy(out + w, ins, il);
                w += il;
            }
        } else {
            if (w + 2 >= cap) {
                cap *= 2;
                out = (char*)realloc(out, cap);
            }
            out[w++] = s[i++];
        }
    }
    out[w] = '\0';
    FLValue r = fl_str_val(out);
    free(out);
    return r;
}

FLValue fl_template_interp(FLValue tmpl) {
    return _fl_template_fill(tmpl, fl_nil(), 0);
}

FLValue fl_template_bound(FLValue tmpl, FLValue env) {
    return _fl_template_fill(tmpl, env, 1);
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
    FLString *string=(FLString*)s.obj;
    const char *p=string->data;
    int64_t i=idx.i, len=(int64_t)string->len;
    if (i<0||i>=len) return fl_nil();
    if (p[i]=='\0') return fl_nil();
    return fl_int((unsigned char)p[i]);
}
static FLValue char_byte_error(const char* code, const char* message) {
    FLValue error = fl_map_new();
    error = fl_map_set(error, fl_str_val("code"), fl_str_val(code));
    error = fl_map_set(error, fl_str_val("message"), fl_str_val(message));
    FLValue result = fl_map_new();
    result = fl_map_set(result, fl_str_val("ok"), fl_bool(false));
    result = fl_map_set(result, fl_str_val("error"), error);
    return result;
}
FLValue char_from_byte(FLValue byte) {
    int64_t n;
    if (byte.tag == FL_INT) n = byte.i;
    else if (byte.tag == FL_FLOAT && isfinite(byte.f) && byte.f >= 0 && byte.f <= 255 && floor(byte.f) == byte.f)
        n = (int64_t)byte.f;
    else
        return char_byte_error("BYTE_RANGE", "expected integer byte in range 0..255");
    if (n < 0 || n > 255)
        return char_byte_error("BYTE_RANGE", "expected integer byte in range 0..255");
    if (n == 0)
        return char_byte_error("UNSUPPORTED_NUL", "runtime strings truncate at NUL");
    FLString* obj = malloc(sizeof(FLString) + 2);
    obj->base.type = FL_STRING;
    obj->base.rc = 1;
    obj->len = 1;
    obj->data[0] = (char)(unsigned char)n;
    obj->data[1] = '\0';
    FLValue value; value.tag = FL_STRING; value.obj = (FLObject*)obj;
    FLValue result = fl_map_new();
    result = fl_map_set(result, fl_str_val("ok"), fl_bool(true));
    result = fl_map_set(result, fl_str_val("value"), value);
    return result;
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
FLValue process_argv(void) {
    return fl_get_argv();
}
/* Script ABI: (get-arg n) / (sys:args). argv is program-name-stripped. */
FLValue get_arg(FLValue index) {
    if (index.tag != FL_INT) return fl_nil();
    return fl_vec_get(fl_get_argv(), index);
}
FLValue sys_args(void) {
    return fl_get_argv();
}
FLValue sys(FLValue key) {
    if (key.tag == FL_STRING && key.obj &&
        strcmp(((FLString*)key.obj)->data, "args") == 0)
        return fl_get_argv();
    return fl_nil();
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

/* bootstrap.js str-contains-in: String(s).includes(String(pattern)) */
static const char* fl_js_string(FLValue v, char* buf, size_t sz) {
    if (v.tag == FL_STRING && v.obj) return ((FLString*)v.obj)->data;
    if (v.tag == FL_NIL) return "null";
    if (v.tag == FL_BOOL) return v.b ? "true" : "false";
    if (v.tag == FL_INT) {
        snprintf(buf, sz, "%lld", (long long)v.i);
        return buf;
    }
    if (v.tag == FL_FLOAT) {
        snprintf(buf, sz, "%g", v.f);
        return buf;
    }
    return "";
}

FLValue str_contains_in(FLValue s, FLValue pattern) {
    char a[4096], b[4096];
    const char* ss = fl_js_string(s, a, sizeof a);
    const char* pp = fl_js_string(pattern, b, sizeof b);
    if (!ss) ss = "";
    if (!pp) pp = "";
    return fl_bool(strstr(ss, pp) != NULL);
}

FLValue fl_string_p(FLValue v) { return string_p(v); }

/* bootstrap.js _fl_concat else: String(v || ""). 빈 배열은 truthy 이고 String([]) 은 "". */
static int fl_js_falsy_text(FLValue v) {
    if (v.tag == FL_NIL) return 1;
    if (v.tag == FL_BOOL) return !v.b;
    if (v.tag == FL_INT) return v.i == 0;
    if (v.tag == FL_FLOAT) return v.f == 0.0 || v.f == -0.0;
    if (v.tag == FL_STRING) {
        FLString* s = (FLString*)v.obj;
        return !s || s->len == 0;
    }
    return 0;
}

static FLValue fl_js_scalar_text(FLValue v) {
    char b[64];
    if (v.tag == FL_NIL || (v.tag == FL_BOOL && !v.b)) return fl_str_val("");
    if (v.tag == FL_BOOL) return fl_str_val("true");
    if (v.tag == FL_INT) {
        if (v.i == 0) return fl_str_val("");
        snprintf(b, sizeof b, "%lld", (long long)v.i);
        return fl_str_val(b);
    }
    if (v.tag == FL_FLOAT) {
        if (v.f == 0.0) return fl_str_val("");
        snprintf(b, sizeof b, "%.15g", v.f);
        return fl_str_val(b);
    }
    if (v.tag == FL_STRING) return v.obj ? v : fl_str_val("");
    return fl_str_val("");
}

static FLValue fl_js_join_vec(FLValue v) {
    FLVector* vec = (v.tag == FL_VECTOR) ? (FLVector*)v.obj : NULL;
    uint32_t n = vec ? vec->len : 0;
    if (!vec || n == 0) return fl_str_val("");
    FLValue acc = fl_str_val("");
    for (uint32_t i = 0; i < n; i++) {
        if (i) acc = fl_add(acc, fl_str_val(","));
        FLValue item = vec->data[i];
        if (item.tag == FL_VECTOR) acc = fl_add(acc, fl_js_join_vec(item));
        else acc = fl_add(acc, fl_js_scalar_text(item));
    }
    return acc;
}

static FLValue fl_js_text(FLValue v) {
    if (v.tag == FL_VECTOR) return fl_js_join_vec(v);
    if (v.tag == FL_MAP || v.tag == FL_FN) {
        if (fl_js_falsy_text(v)) return fl_str_val("");
        return fl_str_val("[object Object]");
    }
    if (fl_js_falsy_text(v)) return fl_str_val("");
    if (v.tag == FL_STRING) return v;
    return fl_js_scalar_text(v);
}

FLValue fl_text(FLValue v) { return fl_js_text(v); }

FLValue fl_concat(FLValue a, FLValue b) {
    if (a.tag == FL_VECTOR && b.tag == FL_VECTOR) return fl_append(a, b);
    return fl_add(fl_js_text(a), fl_js_text(b));
}

/* bootstrap.js _fl_str_to_num: Number(s), NaN 이면 null */
FLValue fl_str_to_num(FLValue s) {
    if (s.tag == FL_NIL) return fl_int(0);
    if (s.tag == FL_BOOL) return fl_int(s.b ? 1 : 0);
    if (s.tag == FL_INT) return s;
    if (s.tag == FL_FLOAT) {
        if (isfinite(s.f) && s.f == floor(s.f) &&
            s.f >= (double)INT64_MIN && s.f <= (double)INT64_MAX)
            return fl_int((int64_t)s.f);
        if (!isfinite(s.f)) return fl_nil();
        return s;
    }
    if (s.tag != FL_STRING || !s.obj) return fl_nil();
    const char* p = ((FLString*)s.obj)->data;
    while (*p && isspace((unsigned char)*p)) p++;
    if (*p == '\0') return fl_int(0);
    char* end = NULL;
    double n = strtod(p, &end);
    if (end == p) return fl_nil();
    while (end && *end && isspace((unsigned char)*end)) end++;
    if (!end || *end != '\0' || !isfinite(n)) return fl_nil();
    if (n == floor(n) && n >= (double)INT64_MIN && n <= (double)INT64_MAX)
        return fl_int((int64_t)n);
    return fl_float(n);
}

FLValue fl_now_iso(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    struct tm tm;
    gmtime_r(&ts.tv_sec, &tm);
    char b[80];
    int ms = (int)(ts.tv_nsec / 1000000L);
    if (ms < 0) ms = 0;
    if (ms > 999) ms = 999;
    snprintf(b, sizeof b, "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
             tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday,
             tm.tm_hour, tm.tm_min, tm.tm_sec, ms);
    return fl_str_val(b);
}

FLValue now_iso(void) { return fl_now_iso(); }

FLValue fl_array_p(FLValue v) { return array_p(v); }
FLValue fl_number_p(FLValue v) { return fl_bool(v.tag == FL_INT || v.tag == FL_FLOAT); }
FLValue fl_integer_p(FLValue v) {
    if (v.tag == FL_INT) return fl_bool(true);
    if (v.tag == FL_FLOAT) return fl_bool(isfinite(v.f) && v.f == floor(v.f));
    return fl_bool(false);
}
FLValue fl_boolean_p(FLValue v) { return fl_bool(v.tag == FL_BOOL); }

FLValue str_split(FLValue s, FLValue sep) {
    if (s.tag != FL_STRING || sep.tag != FL_STRING) return fl_vec_new();
    const char* src = ((FLString*)s.obj)->data;
    const char* d = ((FLString*)sep.obj)->data;
    size_t dlen = strlen(d);
    if (dlen == 0) {
        FLValue vec = fl_vec_new();
        for (const char* p = src; *p; p++) {
            char buf[2] = { *p, 0 };
            vec = fl_vec_push(vec, fl_str_val(buf));
        }
        return vec;
    }
    return split(s, sep);
}

FLValue str_trim(FLValue s) {
    if (s.tag != FL_STRING) return s.tag == FL_NIL ? fl_nil() : fl_str_val("");
    return trim(s);
}

FLValue str_lower(FLValue s) {
    const char* p = "";
    if (s.tag == FL_STRING && s.obj) p = ((FLString*)s.obj)->data;
    size_t n = strlen(p);
    char* buf = malloc(n + 1);
    for (size_t i = 0; i < n; i++) buf[i] = (char)tolower((unsigned char)p[i]);
    buf[n] = 0;
    FLValue r = fl_str_val(buf);
    free(buf);
    return r;
}

FLValue str_to_upper(FLValue s) {
    const char* p = "";
    if (s.tag == FL_STRING && s.obj) p = ((FLString*)s.obj)->data;
    size_t n = strlen(p);
    char* buf = malloc(n + 1);
    for (size_t i = 0; i < n; i++) buf[i] = (char)toupper((unsigned char)p[i]);
    buf[n] = 0;
    FLValue r = fl_str_val(buf);
    free(buf);
    return r;
}

static void fl_sort_key(FLValue v, char* buf, size_t sz) {
    if (v.tag == FL_STRING && v.obj) {
        snprintf(buf, sz, "%s", ((FLString*)v.obj)->data);
        return;
    }
    if (v.tag == FL_INT) { snprintf(buf, sz, "%lld", (long long)v.i); return; }
    if (v.tag == FL_FLOAT) { snprintf(buf, sz, "%.15g", v.f); return; }
    if (v.tag == FL_BOOL) { snprintf(buf, sz, "%s", v.b ? "true" : "false"); return; }
    buf[0] = 0;
}

static int fl_sort_cmp(const void* a, const void* b) {
    FLValue x = *(const FLValue*)a;
    FLValue y = *(const FLValue*)b;
    int xn = (x.tag == FL_INT || x.tag == FL_FLOAT);
    int yn = (y.tag == FL_INT || y.tag == FL_FLOAT);
    if (xn && yn) {
        double dx = x.tag == FL_INT ? (double)x.i : x.f;
        double dy = y.tag == FL_INT ? (double)y.i : y.f;
        if (dx < dy) return -1;
        if (dx > dy) return 1;
        return 0;
    }
    char ax[256], ay[256];
    fl_sort_key(x, ax, sizeof ax);
    fl_sort_key(y, ay, sizeof ay);
    return strcmp(ax, ay);
}

FLValue sort(FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_vec_new();
    FLVector* src = (FLVector*)vec.obj;
    if (src->len == 0) return fl_vec_new();
    FLValue* items = malloc(sizeof(FLValue) * src->len);
    memcpy(items, src->data, sizeof(FLValue) * src->len);
    qsort(items, src->len, sizeof(FLValue), fl_sort_cmp);
    FLValue out = fl_vec_from(items, src->len);
    free(items);
    return out;
}

FLValue max(FLValue a, FLValue b) {
    double da = a.tag == FL_FLOAT ? a.f : (double)a.i;
    double db = b.tag == FL_FLOAT ? b.f : (double)b.i;
    double m = da > db ? da : db;
    if (a.tag == FL_INT && b.tag == FL_INT) return fl_int((int64_t)m);
    return fl_float(m);
}

/* ── stdlib aliases — self/all.fl compatibility ── */

