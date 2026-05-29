#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

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
FLValue fl_sleep_ms(FLValue ms) {
    int64_t t = ms.tag==FL_INT ? ms.i : (int64_t)ms.f;
    struct timespec ts = { t/1000, (t%1000)*1000000L };
    nanosleep(&ts, NULL);
    return fl_nil();
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

FLValue fl_str_starts_with(FLValue s, FLValue prefix) {
    if (s.tag != FL_STRING || prefix.tag != FL_STRING) return fl_bool(false);
    const char* sp = ((FLString*)s.obj)->data;
    const char* pp = ((FLString*)prefix.obj)->data;
    return fl_bool(strncmp(sp, pp, strlen(pp)) == 0);
}

FLValue fl_str_ends_with(FLValue s, FLValue suffix) {
    if (s.tag != FL_STRING || suffix.tag != FL_STRING) return fl_bool(false);
    const char* sp = ((FLString*)s.obj)->data;
    const char* ep = ((FLString*)suffix.obj)->data;
    size_t sl = strlen(sp), el = strlen(ep);
    return fl_bool(sl >= el && strcmp(sp + sl - el, ep) == 0);
}

FLValue fl_string_p(FLValue v) { return string_p(v); }

/* ── stdlib aliases — self/all.fl compatibility ── */

