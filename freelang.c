/* freelang.c — FreeLang seed compiler
 * 사용: ./freelang input.fl  |  컴파일: gcc freelang.c -o freelang */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdarg.h>
#include <libgen.h>
#include <unistd.h>

/* ──────────────────────────────── Arena ── */
#define ARENA_SZ (1 << 26)   /* 64 MB */
static char arena[ARENA_SZ];
static size_t atop;
static void* aa(size_t n) {
    n = (n + 7) & ~7u;
    if (atop + n > ARENA_SZ) { fputs("arena OOM\n", stderr); exit(1); }
    void* p = arena + atop; atop += n; memset(p, 0, n); return p;
}

/* ──────────────────────────────── Lexer ── */
typedef enum { T_LP,T_RP,T_LB,T_RB,T_LC,T_RC,T_NUM,T_STR,T_SYM,T_EOF } TK;
typedef struct { TK k; char v[512]; } Tok;
#define MAX_TOKS 131072
static Tok toks[MAX_TOKS];
static int ntoks, tpos;

static void lex(const char* s) {
    size_t i = 0; ntoks = 0;
    for (;;) {
        while (s[i] && isspace((unsigned char)s[i])) i++;
        if (!s[i]) break;
        if (s[i] == ';') { while (s[i] && s[i] != '\n') i++; continue; }
        Tok t; memset(&t, 0, sizeof(t));
        switch (s[i]) {
        case '(': t.k=T_LP; i++; break;
        case ')': t.k=T_RP; i++; break;
        case '[': t.k=T_LB; i++; break;
        case ']': t.k=T_RB; i++; break;
        case '{': t.k=T_LC; i++; break;
        case '}': t.k=T_RC; i++; break;
        case '"': {
            i++; size_t j = 0;
            while (s[i] && s[i] != '"') {
                if (s[i] == '\\' && s[i+1]) {
                    i++;
                    switch (s[i]) {
                    case 'n': t.v[j++] = '\n'; break;
                    case 't': t.v[j++] = '\t'; break;
                    case '"': t.v[j++] = '"';  break;
                    case '\\':t.v[j++] = '\\'; break;
                    default:  t.v[j++] = s[i]; break;
                    }
                } else t.v[j++] = s[i];
                i++;
            }
            if (s[i]) i++;
            t.v[j] = 0; t.k = T_STR;
            break;
        }
        default: {
            size_t j = 0;
            while (s[i] && !isspace((unsigned char)s[i]) &&
                   s[i]!='(' && s[i]!=')' && s[i]!='[' && s[i]!=']' &&
                   s[i]!='{' && s[i]!='}' && s[i]!=';')
                t.v[j++] = s[i++];
            t.v[j] = 0;
            char* e; strtod(t.v, &e);
            t.k = (*e == 0 && j > 0) ? T_NUM : T_SYM;
            break;
        }
        }
        toks[ntoks++] = t;
    }
    Tok eof; eof.k = T_EOF; eof.v[0] = 0; toks[ntoks++] = eof;
    tpos = 0;
}
static Tok pk(void) { return toks[tpos]; }
static Tok nx(void) { return toks[tpos++]; }

/* ──────────────────────────────── AST ── */
#define NA 0   /* symbol */
#define NN 1   /* number */
#define NS 2   /* string */
#define NL 3   /* list   */
#define NV 4   /* vector [...] */
#define NM 5   /* map    {...} */
typedef struct N N;
struct N { int k; char v[512]; N** c; int nc; };

static N* mkn(int k, const char* v) {
    N* n = aa(sizeof(N)); n->k = k;
    if (v) { strncpy(n->v, v, 511); n->v[511] = 0; }
    return n;
}
static N* mkn2(int k, N** items, int n) {
    N* nd = mkn(k, NULL);
    nd->c = aa(sizeof(N*) * (n + 1));
    memcpy(nd->c, items, sizeof(N*) * n);
    nd->nc = n; return nd;
}

static N* pnode(void) {
    Tok t = pk();
    if (t.k == T_EOF) return NULL;
    if (t.k == T_LP) {
        nx();
        N* items[1024]; int n = 0;
        while (pk().k != T_RP && pk().k != T_EOF) items[n++] = pnode();
        if (pk().k == T_RP) nx();
        return mkn2(NL, items, n);
    }
    if (t.k == T_LB) {
        nx();
        N* items[1024]; int n = 0;
        while (pk().k != T_RB && pk().k != T_EOF) items[n++] = pnode();
        if (pk().k == T_RB) nx();
        return mkn2(NV, items, n);
    }
    if (t.k == T_LC) {
        nx();
        N* items[1024]; int n = 0;
        while (pk().k != T_RC && pk().k != T_EOF) items[n++] = pnode();
        if (pk().k == T_RC) nx();
        return mkn2(NM, items, n);
    }
    nx();
    if (t.k == T_NUM) return mkn(NN, t.v);
    if (t.k == T_STR) return mkn(NS, t.v);
    return mkn(NA, t.v);
}

static int sym(N* n, const char* s) {
    return n && n->k == NA && strcmp(n->v, s) == 0;
}

/* ──────────────────────────────── Loop context ── */
static int loop_ids[32];
static int loop_top = 0;
static int loop_counter = 0;

/* ──────────────────────────────── Closure support ── */
static FILE* preamble;
static int   anon_id;

typedef struct { char s[32][64]; int n; } SymSet;

static void sym_add(SymSet* ss, const char* v) {
    for (int i = 0; i < ss->n; i++) if (!strcmp(ss->s[i], v)) return;
    if (ss->n < 32) { strncpy(ss->s[ss->n], v, 63); ss->s[ss->n++][63] = 0; }
}

static void collect_syms(N* n, SymSet* out_ss) {
    if (!n) return;
    if (n->k == NA) {
        if (n->v[0] == ':') return; /* keyword constant — never a free variable */
        sym_add(out_ss, n->v);
        return;
    }
    if (n->k == NL) {
        /* skip c[0] — always operator/form name, not a variable reference */
        for (int i = 1; i < n->nc; i++) collect_syms(n->c[i], out_ss);
        return;
    }
    for (int i = 0; i < n->nc; i++) collect_syms(n->c[i], out_ss);
}

/* collect variable names bound by let forms inside a subtree */
static void collect_let_bindings(N* n, SymSet* bound) {
    if (!n) return;
    if (n->k == NL && n->nc >= 2 && n->c[0] && n->c[0]->k == NA
        && !strcmp(n->c[0]->v, "let")) {
        N* bindings = n->c[1];
        if (bindings) {
            /* 단일 괄호 [var1 e1 var2 e2]: 첫 아이템이 NA → 짝수 인덱스가 변수명 */
            int is_flat = (bindings->nc > 0 && bindings->c[0] && bindings->c[0]->k == NA);
            if (is_flat) {
                for (int i = 0; i < bindings->nc; i += 2) {
                    N* var = bindings->c[i];
                    if (var && var->k == NA) sym_add(bound, var->v);
                    if (i+1 < bindings->nc) collect_let_bindings(bindings->c[i+1], bound);
                }
            } else {
                /* 이중 괄호 [[var1 e1] [var2 e2]] */
                for (int i = 0; i < bindings->nc; i++) {
                    N* item = bindings->c[i];
                    if (item && (item->k == NV || item->k == NL)
                        && item->nc >= 1 && item->c[0] && item->c[0]->k == NA) {
                        sym_add(bound, item->c[0]->v);
                        if (item->nc >= 2) collect_let_bindings(item->c[1], bound);
                    } else {
                        collect_let_bindings(item, bound);
                    }
                }
            }
        }
        for (int i = 2; i < n->nc; i++) collect_let_bindings(n->c[i], bound);
        return;
    }
    for (int i = 0; i < n->nc; i++) collect_let_bindings(n->c[i], bound);
}

/* ──────────────────────────────── Emitter ── */
static FILE* out;
static void E(const char* fmt, ...) {
    va_list a; va_start(a, fmt); vfprintf(out, fmt, a); va_end(a);
}

static void cname(const char* s, char* b, size_t sz) {
    size_t i = 0;
    /* strip leading $ and : prefixes */
    while (*s == '$' || *s == ':') s++;
    for (size_t j = 0; s[j] && i < sz-2; j++) {
        char c = s[j];
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') || c == '_') {
            b[i++] = c;
        } else if (c == '?' && s[j+1] == '\0') {
            /* trailing ? → _p (matches runtime null_p, list_p, etc.) */
            if (i < (int)sz-3) { b[i++]='_'; b[i++]='p'; }
        } else {
            b[i++] = '_';  /* replace any special char with _ */
        }
    }
    if (i == 0) { b[0]='_'; i=1; }  /* empty → _ */
    b[i] = 0;
    /* avoid C keywords — append _ if name collides */
    static const char* kw[] = {"double","float","int","long","short","char","void",
        "for","while","do","return","break","continue","if","else","switch",
        "case","default","goto","struct","union","enum","typedef","static",
        "extern","const","volatile","inline","sizeof","auto","register",NULL};
    for (int k = 0; kw[k]; k++)
        if (!strcmp(b, kw[k])) { b[i]='_'; b[i+1]=0; break; }
}
static void cesc(const char* s) {
    for (; *s; s++) {
        if (*s == '\\')      E("\\\\");
        else if (*s == '"')  E("\\\"");
        else if (*s == '\n') E("\\n");
        else if (*s == '\t') E("\\t");
        else                 E("%c", *s);
    }
}

/* nodes/nnodes forward — defined in Program section */
#define MAX_NODES 32768
static N* nodes[MAX_NODES];
static int nnodes;

/* forward declarations for closure helpers */
static int  is_defn_name(const char*);
static int  is_global_name(const char*);
static void free_vars(N*, SymSet*);
static void emit_node(N* n);
static int is_runtime_builtin(const char* name);
static int is_defn_name(const char* name);

static void emit_args(N** a, int n) {
    for (int i = 0; i < n; i++) { if (i) E(", "); emit_node(a[i]); }
}

static void emit_chain(const char* fn, N** a, int n) {
    if (n == 0) { E("fl_int(0)"); return; }
    if (n == 1) { emit_node(a[0]); return; }
    E("%s(", fn); emit_node(a[0]); E(", ");
    emit_chain(fn, a+1, n-1);
    E(")");
}

static void emit_cond_r(N** pairs, int np) {
    if (np == 0) { E("fl_nil()"); return; }
    N* pair = pairs[np-1];
    if (pair->nc < 2) { emit_cond_r(pairs, np-1); return; }
    N* test = pair->c[0];
    N* body = pair->c[1];
    if (sym(test,"true") || sym(test,"else")) {
        emit_node(body);
    } else {
        E("(fl_truthy("); emit_node(test); E(") ? ");
        emit_node(body); E(" : ");
        emit_cond_r(pairs, np-1);
        E(")");
    }
}

static void emit_node(N* n) {
    if (!n) { E("fl_nil()"); return; }
    if (n->k == NN) {
        if (strchr(n->v, '.')) E("fl_float(%s)", n->v);
        else E("fl_int(%s)", n->v);
        return;
    }
    if (n->k == NS) { E("fl_str_val(\""); cesc(n->v); E("\")"); return; }
    if (n->k == NA) {
        if (!strcmp(n->v,"true"))           { E("fl_bool(true)");  return; }
        if (!strcmp(n->v,"false"))          { E("fl_bool(false)"); return; }
        if (!strcmp(n->v,"nil") || !strcmp(n->v,"null")) { E("fl_nil()"); return; }
        /* :keyword → string literal */
        if (n->v[0] == ':') { E("fl_str_val(\""); cesc(n->v+1); E("\")"); return; }
        /* @var → fl_atom_deref(var) */
        if (n->v[0] == '@' && n->v[1]) {
            char b[512]; cname(n->v + 1, b, sizeof(b));
            E("fl_atom_deref(%s)", b); return;
        }
        char b[512]; cname(n->v, b, sizeof(b));
        /* defn name used as value → wrap as FLValue fn */
        if (is_defn_name(n->v)) { E("fl_fn_new(_wrap_%s, 0, NULL)", b); return; }
        E("%s", b); return;
    }
    /* NV — vector literal */
    if (n->k == NV) {
        if (n->nc == 0) { E("fl_vec_new()"); return; }
        E("fl_vec_from((FLValue[]){"); emit_args(n->c, n->nc); E("}, %d)", n->nc);
        return;
    }
    /* NM — map literal */
    if (n->k == NM) {
        if (n->nc == 0) { E("fl_map_new()"); return; }
        E("fl_map_from_pairs((FLValue[]){"); emit_args(n->c, n->nc); E("}, %d)", n->nc/2);
        return;
    }
    /* NL */
    if (n->nc == 0) { E("fl_nil()"); return; }
    N* op = n->c[0]; N** a = n->c+1; int na = n->nc-1;

    /* arithmetic */
    if (sym(op,"+")) { emit_chain("fl_add",a,na); return; }
    if (sym(op,"*")) { emit_chain("fl_mul",a,na); return; }
    if (sym(op,"-")) {
        if (na==1) { E("fl_sub(fl_int(0), "); emit_node(a[0]); E(")"); }
        else emit_chain("fl_sub",a,na);
        return;
    }
    if (sym(op,"/"))  { E("fl_div(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"%"))  { E("fl_mod(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    /* comparison */
    if (sym(op,"="))  { E("fl_eq(");   emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"!=")) { E("fl_neq(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"<"))  { E("fl_lt(");   emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,">"))  { E("fl_gt(");   emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"<=")) { E("fl_lte(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,">=")) { E("fl_gte(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    /* logical */
    if (sym(op,"not")) { E("fl_not("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"and")) { emit_chain("fl_and",a,na); return; }
    if (sym(op,"or"))  { emit_chain("fl_or",a,na);  return; }
    /* I/O */
    if (sym(op,"println")) {
        if (na==0) { E("fl_println(fl_nil())"); return; }
        if (na==1) { E("fl_println("); emit_node(a[0]); E(")"); return; }
        E("fl_println(fl_str_n(%d, ", na); emit_args(a,na); E("))"); return;
    }
    if (sym(op,"print")) {
        if (na==0) { E("fl_print(fl_nil())"); return; }
        if (na==1) { E("fl_print("); emit_node(a[0]); E(")"); return; }
        E("fl_print(fl_str_n(%d, ", na); emit_args(a,na); E("))"); return;
    }
    if (sym(op,"str")) {
        if (na==0) { E("fl_str_val(\"\")"); return; }
        if (na==1) { emit_node(a[0]); return; }
        E("fl_str_n(%d, ", na); emit_args(a,na); E(")"); return;
    }
    /* control flow */
    if (sym(op,"if")) {
        E("(fl_truthy("); emit_node(a[0]); E(") ? ");
        emit_node(na>1 ? a[1] : NULL);
        E(" : ");
        emit_node(na>2 ? a[2] : NULL);
        E(")");
        return;
    }
    if (sym(op,"when")) {
        E("(fl_truthy("); emit_node(a[0]); E(") ? ((__extension__({\n");
        for (int i = 1; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 1) E("        "); emit_node(na>1 ? a[na-1] : NULL); E(";\n    }))) : fl_nil())");
        return;
    }
    if (sym(op,"when-not")) {
        E("(!fl_truthy("); emit_node(a[0]); E(") ? ((__extension__({\n");
        for (int i = 1; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 1) E("        "); emit_node(na>1 ? a[na-1] : NULL); E(";\n    }))) : fl_nil())");
        return;
    }
    if (sym(op,"cond")) { emit_cond_r(a, na); return; }
    if (sym(op,"case")) {
        /* (case val v1 r1 v2 r2 ... [default]) — 홀수 trailing = 기본값 */
        E("((__extension__({\n");
        E("    FLValue _cv = "); emit_node(a[0]); E(";\n");
        E("    FLValue _cr = fl_nil();\n");
        int has_default = ((na % 2) == 0);  /* val + 짝수 나머지 = 기본값 있음 */
        int pairs_end = has_default ? na - 1 : na;
        for (int i = 1; i + 1 < pairs_end; i += 2) {
            if (i == 1) E("    if");
            else        E("    } else if");
            E(" (fl_truthy(fl_eq(_cv, "); emit_node(a[i]); E("))) { _cr = ");
            emit_node(a[i+1]); E(";\n");
        }
        if (pairs_end > 1) E("    } else { _cr = ");
        else               E("    _cr = ");
        if (has_default) emit_node(a[na-1]);
        else             E("fl_nil()");
        E(";\n");
        if (pairs_end > 1) E("    }\n");
        E("    _cr;\n})))");
        return;
    }
    if (sym(op,"do")) {
        E("((__extension__ ({\n");
        for (int i = 0; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 0) { E("        "); emit_node(a[na-1]); E(";\n"); }
        E("    })))");
        return;
    }
    if (sym(op,"try")) {
        /* catch 절 위치 탐색 */
        int ci = -1;
        for (int i = 0; i < na; i++)
            if (a[i]->k == NL && a[i]->nc >= 1 && sym(a[i]->c[0], "catch"))
                { ci = i; break; }
        int body_end = (ci >= 0) ? ci : na;
        E("((__extension__({\n");
        E("    FLValue _tr = fl_nil();\n");
        E("    fl_try_top++;\n");
        E("    if (setjmp(fl_try_stack[fl_try_top-1].buf) == 0) {\n");
        for (int i = 0; i < body_end - 1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (body_end > 0) { E("        _tr = "); emit_node(a[body_end-1]); E(";\n"); }
        E("        fl_try_top--;\n");
        E("    } else {\n");
        E("        FLValue _te = fl_try_stack[fl_try_top-1].err; fl_try_top--;\n");
        if (ci >= 0 && a[ci]->nc >= 2) {
            char eb[512]; cname(a[ci]->c[1]->v, eb, sizeof(eb));
            E("        FLValue %s = _te;\n", eb);
            int hn = a[ci]->nc;
            for (int i = 2; i < hn - 1; i++) { E("        "); emit_node(a[ci]->c[i]); E(";\n"); }
            if (hn > 2) { E("        _tr = "); emit_node(a[ci]->c[hn-1]); E(";\n"); }
        }
        E("    }\n    _tr;\n})))");
        return;
    }
    if (sym(op,"let")) {
        N* bl = a[0]; N** it = bl->c; int ni = bl->nc;
        int nested = (ni > 0 && (it[0]->k == NL || it[0]->k == NV));
        E("((__extension__ ({\n");
        if (nested) {
            for (int i = 0; i < ni; i++) {
                char b[512]; cname(it[i]->c[0]->v, b, sizeof(b));
                E("        FLValue %s = ", b); emit_node(it[i]->c[1]); E(";\n");
            }
        } else {
            for (int i = 0; i+1 < ni; i+=2) {
                char b[512]; cname(it[i]->v, b, sizeof(b));
                E("        FLValue %s = ", b); emit_node(it[i+1]); E(";\n");
            }
        }
        for (int i = 1; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 1) { E("        "); emit_node(a[na-1]); E(";\n"); }
        E("    })))");
        return;
    }
    if (sym(op,"defn") || sym(op,"define")) {
        E("/* %s inside expr — skip */fl_nil()", op->v); return;
    }
    if (sym(op,"file-read"))  { E("fl_file_read("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"file-write")) { E("fl_file_write("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"doseq")) {
        /* (doseq [x coll] body...) */
        N* bv = a[0];  /* binding vector: c[0]=varname, c[1]=coll */
        char bname[512]; cname(bv->c[0]->v, bname, sizeof(bname));
        int lid = loop_counter++;
        E("((__extension__({\n");
        E("    FLValue _dsv%d = ", lid); emit_node(bv->c[1]); E(";\n");
        E("    int64_t _dsn%d = fl_vec_len(_dsv%d).i;\n", lid, lid);
        E("    for (int64_t _dsi%d = 0; _dsi%d < _dsn%d; _dsi%d++) {\n", lid,lid,lid,lid);
        E("        FLValue %s = fl_vec_get(_dsv%d, fl_int(_dsi%d));\n", bname, lid, lid);
        for (int i = 1; i < na; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        E("    }\n    fl_nil();\n})))");
        return;
    }
    /* loop/recur */
    if (sym(op,"loop")) {
        N* bl = a[0]; int nv = bl->nc/2, lid = loop_counter++;
        E("(__extension__({\n");
        for (int i = 0; i < nv; i++) {
            char b[512]; cname(bl->c[i*2]->v, b, sizeof(b));
            E("    FLValue _lv%d_%d = ", lid, i); emit_node(bl->c[i*2+1]); E(";\n");
        }
        E("    FLValue _lr%d;\n    _loop_%d:;\n    {\n", lid, lid);
        for (int i = 0; i < nv; i++) {
            char b[512]; cname(bl->c[i*2]->v, b, sizeof(b));
            E("        FLValue %s = _lv%d_%d;\n", b, lid, i);
        }
        loop_ids[loop_top++] = lid;
        E("        _lr%d = ", lid); emit_node(na > 1 ? a[na-1] : NULL);
        E(";\n    }\n    _lr%d;\n}))", lid); loop_top--;
        return;
    }
    if (sym(op,"recur")) {
        if (loop_top == 0) { E("fl_nil()"); return; }
        int lid = loop_ids[loop_top-1];
        E("(");
        for (int i = 0; i < na; i++) {
            E("_lv%d_%d = ", lid, i); emit_node(a[i]); E(", ");
        }
        E("(__extension__({goto _loop_%d; fl_nil();})))", lid);
        return;
    }
    if (sym(op,"vec-get"))  { E("fl_vec_get(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"vec-set"))  { E("fl_vec_set(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    if (sym(op,"vec-push")) { E("fl_vec_push("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"vec-len"))  { E("fl_vec_len(");  emit_node(a[0]); E(")"); return; }
    if (sym(op,"map-get"))  { E("fl_map_get(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"map-set"))  { E("fl_map_set(");  emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    if (sym(op,"map-len"))  { E("fl_map_len(");  emit_node(a[0]); E(")"); return; }
    if (sym(op,"map-keys"))    { E("fl_map_keys(");    emit_node(a[0]); E(")"); return; }
    if (sym(op,"map-vals"))    { E("fl_map_vals(");    emit_node(a[0]); E(")"); return; }
    if (sym(op,"map-entries")) { E("fl_map_entries("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"map"))    { E("fl_map_fn(");    emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"filter")) { E("fl_filter_fn("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"reduce")) { E("fl_reduce_fn("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    /* stdlib aliases */
    if (sym(op,"append") || sym(op,"push")) {
        E("fl_vec_push("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"list")) {
        if (na==0) { E("fl_vec_new()"); return; }
        E("fl_vec_from((FLValue[]){"); emit_args(a,na); E("}, %d)", na); return; }
    if (sym(op,"slice")) {
        E("fl_vec_slice("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    /* JS runtime internal names used in self/all.fl */
    if (sym(op,"_fl_map_set") || sym(op,"assoc") || sym(op,"obj-assoc")) {
        E("fl_map_set("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    if (sym(op,"dissoc") || sym(op,"obj-dissoc")) {
        E("fl_map_del("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"obj-keys") || sym(op,"keys")) {
        E("fl_map_keys("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"obj-vals") || sym(op,"vals")) {
        E("fl_map_vals("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"obj-entries") || sym(op,"entries")) {
        E("fl_map_entries("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"obj-merge") || sym(op,"merge")) {
        E("fl_map_merge("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"concat")) {
        E("fl_concat("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"first")) { E("fl_vec_get("); emit_node(a[0]); E(", fl_int(0))"); return; }
    if (sym(op,"last"))  { E("fl_vec_last("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"rest"))  { E("fl_vec_slice("); emit_node(a[0]); E(", fl_int(1), fl_int(-1))"); return; }
    if (sym(op,"abs"))   { E("fl_abs("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"floor")) { E("fl_floor("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"ceil"))  { E("fl_ceil(");  emit_node(a[0]); E(")"); return; }
    if (sym(op,"round")) { E("fl_ceil(");  emit_node(a[0]); E(")"); return; }
    if (sym(op,"sqrt"))  { E("fl_math_sqrt("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"now") || sym(op,"now-ms") || sym(op,"now_ms"))
        { E("fl_now_ms()"); return; }
    if (sym(op,"bit-xor") || sym(op,"bit_xor"))
        { E("fl_bit_xor("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"bit-and") || sym(op,"bit_and"))
        { E("fl_bit_and("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"bit-or") || sym(op,"bit_or"))
        { E("fl_bit_or("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"bit-shift-left") || sym(op,"bit_shift_left"))
        { E("fl_bit_shl("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"bit-shift-right") || sym(op,"bit_shift_right"))
        { E("fl_bit_shr("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"json-parse") || sym(op,"json_parse"))
        { E("fl_json_parse("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"json-stringify") || sym(op,"json_stringify"))
        { E("fl_json_stringify("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"math-sqrt") || sym(op,"math_sqrt"))
        { E("fl_math_sqrt("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"str-join") || sym(op,"str_join"))
        { E("str_join("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"str-to-num") || sym(op,"str_to_num"))
        { E("fl_str_to_num("); emit_node(a[0]); E(")"); return; }
    /* D: atom */
    if (sym(op,"atom"))
        { E("fl_atom_new("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"deref"))
        { E("fl_atom_deref("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"reset!") || sym(op,"reset_e"))
        { E("fl_atom_reset("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"swap!") || sym(op,"swap_e")) {
        /* (swap! atom fn args...) → fl_atom_reset(atom, (fn (deref atom) args...)) */
        E("fl_atom_reset("); emit_node(a[0]); E(", ");
        N* items[64]; items[0] = a[1];
        N* da[2]; da[0] = mkn(NA,"deref"); da[1] = a[0];
        items[1] = mkn2(NL, da, 2);
        for (int i = 2; i < na; i++) items[i] = a[i];
        emit_node(mkn2(NL, items, na));
        E(")"); return; }
    /* A: fl_fn_call 오류 → 직접 매핑 */
    if (sym(op,"html-escape") || sym(op,"html_escape"))
        { E("fl_html_escape("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"sleep"))
        { E("fl_sleep_ms("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"min")) {
        for (int i = 0; i < na - 1; i++) E("fl_min2(");
        emit_node(a[0]);
        for (int i = 1; i < na; i++) { E(", "); emit_node(a[i]); E(")"); }
        return; }
    if (sym(op,"max")) {
        for (int i = 0; i < na - 1; i++) E("fl_max2(");
        emit_node(a[0]);
        for (int i = 1; i < na; i++) { E(", "); emit_node(a[i]); E(")"); }
        return; }
    /* B: cname 미스매치 수정 */
    if (sym(op,"str-starts-with") || sym(op,"str_starts_with"))
        { E("fl_str_starts_with("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"str-ends-with") || sym(op,"str_ends_with"))
        { E("fl_str_ends_with("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    /* C: 술어 */
    if (sym(op,"nil?") || sym(op,"nil_p"))
        { E("null_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"empty?") || sym(op,"empty_p"))
        { E("fl_empty_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"not-empty?") || sym(op,"not_empty_p"))
        { E("fl_not_empty_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"nil-or-empty?") || sym(op,"nil_or_empty_p"))
        { E("fl_nil_or_empty_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"number?") || sym(op,"number_p"))
        { E("fl_number_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"boolean?") || sym(op,"boolean_p"))
        { E("fl_boolean_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"array?") || sym(op,"array_p"))
        { E("fl_array_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"map?") || sym(op,"map_p"))
        { E("fl_map_p("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"fn?") || sym(op,"fn_p"))
        { E("fl_fn_p("); emit_node(a[0]); E(")"); return; }
    /* C: 컬렉션/맵 */
    if (sym(op,"get-in") || sym(op,"get_in"))
        { E("fl_get_in("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"includes-item") || sym(op,"includes_item"))
        { E("fl_includes_item("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"sort-by") || sym(op,"sort_by"))
        { E("fl_sort_by("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"obj-omit") || sym(op,"obj_omit"))
        { E("fl_obj_omit("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"cli-args") || sym(op,"cli_args"))
        { E("fl_get_argv()"); return; }
    /* E: HTTP 서버 라우팅 */
    if (sym(op,"server-start") || sym(op,"server_start"))
        { E("fl_http_start("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"server-get") || sym(op,"server_get"))
        { E("fl_http_route(fl_str_val(\"GET\"), "); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"server-post") || sym(op,"server_post"))
        { E("fl_http_route(fl_str_val(\"POST\"), "); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"server-put") || sym(op,"server_put"))
        { E("fl_http_route(fl_str_val(\"PUT\"), "); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"server-delete") || sym(op,"server_delete"))
        { E("fl_http_route(fl_str_val(\"DELETE\"), "); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"server-patch") || sym(op,"server_patch"))
        { E("fl_http_route(fl_str_val(\"PATCH\"), "); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    /* E: HTTP 응답 빌더 */
    if (sym(op,"server-html") || sym(op,"server_html"))
        { E("fl_resp_html("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"server-json") || sym(op,"server_json"))
        { E("fl_resp_json("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"server-status") || sym(op,"server_status"))
        { E("fl_resp_status("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"server-redirect") || sym(op,"server_redirect"))
        { E("fl_resp_redirect("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"server-html-cookie") || sym(op,"server_html_cookie"))
        { E("fl_resp_html_cookie("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"server-set-cookie") || sym(op,"server_set_cookie"))
        { E("fl_resp_set_cookie("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(na > 2 ? a[2] : NULL); E(")"); return; }
    /* E: HTTP 클라이언트 */
    if (sym(op,"http-get") || sym(op,"http_get"))
        { E("fl_http_get("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"http-post") || sym(op,"http_post"))
        { E("fl_http_post("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(na > 2 ? a[2] : NULL); E(")"); return; }
    if (sym(op,"http-get-headers") || sym(op,"http_get_headers"))
        { E("fl_http_get_headers("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"http-post-headers") || sym(op,"http_post_headers"))
        { E("fl_http_post_headers("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    /* F: DB (SQLite) */
    if (sym(op,"db-open") || sym(op,"db_open"))
        { E("fl_db_open("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"db-close") || sym(op,"db_close"))
        { E("fl_db_close("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"db-query") || sym(op,"db_query"))
        { E("fl_db_query("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    if (sym(op,"db-exec") || sym(op,"db_exec"))
        { E("fl_db_exec("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    /* G: JWT + auth */
    if (sym(op,"auth-jwt-sign") || sym(op,"auth_jwt_sign"))
        { E("fl_jwt_sign("); emit_node(a[0]); E(", "); emit_node(a[1]); E(", "); emit_node(a[2]); E(")"); return; }
    if (sym(op,"auth-jwt-verify") || sym(op,"auth_jwt_verify"))
        { E("fl_jwt_verify("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    if (sym(op,"auth-jwt-expired") || sym(op,"auth_jwt_expired"))
        { E("fl_jwt_expired("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"auth-hash-password") || sym(op,"auth_hash_password"))
        { E("fl_hash_password("); emit_node(a[0]); E(")"); return; }
    if (sym(op,"auth-verify-password") || sym(op,"auth_verify_password"))
        { E("fl_verify_password("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return; }
    /* fn literal */
    if (sym(op,"fn")) {
        SymSet fv = {0};
        free_vars(n, &fv);
        int id = anon_id++;
        FILE* saved = out; out = preamble;
        E("static FLValue _anon_%d(FLClosure* _cl, int _ac, FLValue* _av) {\n", id);
        N* params = (na >= 1) ? a[0] : NULL;
        if (params) for (int i = 0; i < params->nc; i++) {
            char b[512]; cname(params->c[i]->v, b, sizeof(b));
            E("    FLValue %s = _av[%d];\n", b, i);
        }
        for (int i = 0; i < fv.n; i++) {
            char b[512]; cname(fv.s[i], b, sizeof(b));
            E("    FLValue %s = _cl->env[%d];\n", b, i);
        }
        E("    return "); emit_node(na >= 2 ? a[1] : NULL); E(";\n}\n");
        out = saved;
        if (fv.n > 0) {
            E("fl_fn_new(_anon_%d, %d, (FLValue[]){", id, fv.n);
            for (int i = 0; i < fv.n; i++) {
                if (i) E(", ");
                char b[512]; cname(fv.s[i], b, sizeof(b)); E("%s", b);
            }
            E("})");
        } else {
            E("fl_fn_new(_anon_%d, 0, NULL)", id);
        }
        return;
    }
    /* IIFE: op is itself a fn node */
    if (op->k == NL) {
        E("fl_fn_call("); emit_node(op);
        if (na > 0) { E(", %d, (FLValue[]){", na); emit_args(a, na); E("})"); }
        else E(", 0, NULL)");
        return;
    }
    /* generic call — defn/builtin → direct C, define/unknown → dynamic dispatch */
    char b[512]; cname(op->v, b, sizeof(b));
    if (is_defn_name(op->v) || is_runtime_builtin(b)) {  /* b = C-mangled name */
        E("%s(", b); emit_args(a, na); E(")");
    } else {
        if (na > 0) { E("fl_fn_call(%s, %d, (FLValue[]){", b, na); emit_args(a, na); E("})"); }
        else E("fl_fn_call(%s, 0, NULL)", b);
    }
}

/* ──────────────────────────────── Program ── */

static int is_runtime_builtin(const char* name) {
    /* C-mangled names (after cname()) that are direct runtime functions */
    static const char* builtins[] = {
        /* core */
        "length","get","range","type_of",
        /* predicates (? → _p via cname) */
        "null_p","list_p","map_p","fn_p","string_p","array_p","number_p",
        "array_p","integer_p","float_p","vector_p","keyword_p",
        /* string */
        "split","join","trim","substring","index_of","str_index_of",
        "str_replace","str_replace_all","str_includes","str_upper","str_lower",
        "str_trim","str_length","str_split","str_join","str_starts_with","str_ends_with",
        "str_contains","str_blank_p",
        /* array */
        "first","last","rest","push","pop","reverse","flatten",
        "take","drop","sort","sort_by","flat_map","zip",
        "char_at","char_code_at","includes_item",
        /* map */
        "map_entries","map_keys","map_vals",
        "fl_map_get","fl_map_set","fl_map_new","fl_map_len",
        "fl_map_from_pairs","fl_vec_get","fl_vec_set","fl_vec_push",
        "fl_vec_new","fl_vec_len","fl_vec_from",
        /* higher-order */
        "fl_map_fn","fl_filter_fn","fl_reduce_fn",
        /* math */
        "fl_abs","fl_floor","fl_ceil","fl_math_sqrt","fl_float","fl_int","fl_bool",
        /* io */
        "fl_parse","fl_now","fl_now_ms","fl_get_argv","fl_println","fl_print",
        "fl_str_val","fl_str_n","fl_str_includes","fl_string_p",
        "fl_file_read","fl_file_write",
        /* _fl_process_* */
        "_fl_process_getcwd","_fl_process_chdir","_fl_process_pid","_fl_process_ppid",
        "_fl_process_kill","_fl_process_exists","_fl_process_wait",
        "_fl_process_run","_fl_process_run_args","_fl_run_inherit",
        "_fl_process_exec","_fl_process_exec_args","_fl_process_spawn",
        /* _fl_file_* */
        "_fl_file_append","_fl_file_delete","_fl_file_copy","_fl_file_rename",
        "_fl_file_size","_fl_file_modified","_fl_file_mkdir","_fl_file_rmdir",
        "_fl_file_list","_fl_file_is_file","_fl_file_is_dir","file_exists",
        /* _fl_env_* */
        "_fl_env_get","_fl_env_set","_fl_env_all",
        /* str_join */
        "str_join",
        /* misc */
        "not","abs","floor","ceil","round","concat",
        "json_parse","json_stringify","shell_exec","now_ms","now_iso","now_unix",
        NULL
    };
    for (int i = 0; builtins[i]; i++)
        if (!strcmp(name, builtins[i])) return 1;
    return 0;
}

static int is_defn_name(const char* name) {
    /* match by C-mangled name so "json-keys" defn is found by "json_keys" call */
    char nb[512]; cname(name, nb, sizeof(nb));
    for (int i = 0; i < nnodes; i++) {
        N* nd = nodes[i];
        if (!nd || nd->k!=NL || nd->nc<2) continue;
        if (!sym(nd->c[0],"defn")) continue;
        char fb[512]; cname(nd->c[1]->v, fb, sizeof(fb));
        if (!strcmp(fb, nb)) return 1;
    }
    return 0;
}

static int is_global_name(const char* name) {
    static const char* bi[] = {"true","false","nil","null",NULL};
    for (int i = 0; bi[i]; i++) if (!strcmp(name, bi[i])) return 1;
    for (int i = 0; i < nnodes; i++) {
        N* nd = nodes[i];
        if (nd && nd->k==NL && nd->nc>=2
            && (sym(nd->c[0],"defn")||sym(nd->c[0],"define"))
            && !strcmp(nd->c[1]->v, name)) return 1;
    }
    return 0;
}

static void free_vars(N* fn_node, SymSet* fv) {
    SymSet used = {0};
    SymSet let_bound = {0};
    if (fn_node->nc >= 3) {
        collect_syms(fn_node->c[2], &used);
        collect_let_bindings(fn_node->c[2], &let_bound);
    }
    N* params = (fn_node->nc >= 2) ? fn_node->c[1] : NULL;
    for (int i = 0; i < used.n; i++) {
        const char* v = used.s[i]; int bound = 0;
        if (is_global_name(v)) continue;
        if (params) for (int j = 0; j < params->nc; j++)
            if (!strcmp(params->c[j]->v, v)) { bound=1; break; }
        for (int j = 0; j < let_bound.n && !bound; j++)
            if (!strcmp(let_bound.s[j], v)) bound=1;
        if (!bound) sym_add(fv, v);
    }
}

static void emit_params(N* params) {
    int first = 1;
    for (int i = 0; i < params->nc; i++) {
        if (params->c[i]->k != NA) continue;
        char b[512]; cname(params->c[i]->v, b, sizeof(b));
        if (!first) E(", ");
        first = 0; E("FLValue %s", b);
    }
}

static void flush_file(FILE* src, FILE* dst) {
    rewind(src); int ch;
    while ((ch = fgetc(src)) != EOF) fputc(ch, dst);
    fclose(src);
}

static void emit_program(void) {
    /* Three-buffer strategy:
     * fwddecl   — forward declarations (must precede preamble anonymous fns)
     * preamble  — anonymous fn C functions (populated by fn handler)
     * body      — defn bodies + main()
     * Final output: header + fwddecl + preamble + body */
    FILE* fwddecl = tmpfile();
    preamble = tmpfile();
    FILE* body = tmpfile();
    if (!fwddecl || !preamble || !body) { fputs("error: tmpfile failed\n", stderr); exit(1); }

    FILE* final_out = out;
    out = fwddecl;

    /* forward declarations */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 3) continue;
        if (!sym(n->c[0], "defn")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        E("FLValue %s(", b); emit_params(n->c[2]); E(");\n");
    }
    /* _wrap_ forward declarations (closure-compatible wrappers for defn) */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 3) continue;
        if (!sym(n->c[0], "defn")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        E("FLValue _wrap_%s(FLClosure* _cl, int _argc, FLValue* _av);\n", b);
    }
    E("\n");
    /* global define declarations */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 3) continue;
        if (!sym(n->c[0], "define")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        E("static FLValue %s;\n", b);
    }
    E("\n");
    /* switch to body buffer for defn bodies and main */
    out = body;
    /* function definitions — fn literals inside bodies populate preamble */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 4) continue;
        if (!sym(n->c[0], "defn")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        E("FLValue %s(", b); emit_params(n->c[2]); E(") {\n");
        E("    return "); emit_node(n->c[3]); E(";\n}\n\n");
    }
    /* _wrap_ bodies — closure-compatible delegates to direct defn */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 4) continue;
        if (!sym(n->c[0], "defn")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        N* params = n->c[2];
        int np = params ? params->nc : 0;
        E("FLValue _wrap_%s(FLClosure* _cl, int _argc, FLValue* _av) {\n", b);
        E("    (void)_cl;\n");
        if (np == 0) {
            E("    return %s();\n", b);
        } else {
            E("    return %s(", b);
            for (int j = 0; j < np; j++) {
                if (j) E(", ");
                E("_av[%d]", j);
            }
            E(");\n");
        }
        E("}\n\n");
    }
    /* main */
    E("int main(int argc, char** argv) {\n");
    E("    fl_init_argv(argc, argv);\n");
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 1) continue;
        if (sym(n->c[0], "defn")) continue;
        if (sym(n->c[0], "define")) {
            char b[512]; cname(n->c[1]->v, b, sizeof(b));
            E("    %s = ", b); emit_node(n->c[2]); E(";\n");
            continue;
        }
        E("    "); emit_node(n); E(";\n");
    }
    E("    return 0;\n}\n");

    out = final_out;
    fprintf(out, "#include \"runtime.h\"\n\n");
    flush_file(fwddecl, out);   /* fwd decls first — anonymous fns may call defns */
    flush_file(preamble, out);  /* anonymous fn bodies */
    flush_file(body, out);      /* defn bodies + main */
}

/* ──────────────────────────────── Driver ── */
static char* read_file(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) { fprintf(stderr, "error: cannot open '%s'\n", path); exit(1); }
    fseek(f, 0, SEEK_END); long sz = ftell(f); rewind(f);
    char* buf = malloc((size_t)sz + 1);
    fread(buf, 1, (size_t)sz, f); buf[sz] = 0; fclose(f);
    return buf;
}

int main(int argc, char** argv) {
    if (argc < 2) { fputs("usage: freelang <input.fl> [output.c]\n", stderr); return 1; }
    const char* input = argv[1];
    const char* output_c = (argc >= 3) ? argv[2] : NULL;

    /* runtime directory: same dir as freelang binary */
    char self_path[512]; strncpy(self_path, argv[0], 511);
    char* dir = dirname(self_path);
    char runtime_dir[512]; snprintf(runtime_dir, sizeof(runtime_dir), "%s/runtime", dir);

    /* temp or explicit C output path */
    char cfile[512];
    if (output_c) {
        strncpy(cfile, output_c, 511);
    } else {
        snprintf(cfile, sizeof(cfile), "/tmp/fl_out_%d.c", (int)getpid());
    }
    char binf[512]; snprintf(binf, sizeof(binf), "/tmp/fl_out_%d", (int)getpid());

    /* lex + parse */
    char* src = read_file(input);
    lex(src);
    nnodes = 0;
    while (pk().k != T_EOF) {
        N* n = pnode();
        if (n && nnodes < MAX_NODES) nodes[nnodes++] = n;
    }

    /* emit C */
    out = fopen(cfile, "w");
    if (!out) { fputs("error: cannot write temp file\n", stderr); return 1; }
    emit_program();
    fclose(out);

    /* compile-only mode: output.c 지정 시 C 생성 후 종료 */
    if (output_c) { free(src); return 0; }

    /* compile */
    char cmd[8192];
    snprintf(cmd, sizeof(cmd),
        "gcc -I%s %s %s/core.c %s/collection.c %s/math.c %s/json.c %s/io.c %s/process.c %s/error.c -o %s -lm",
        runtime_dir, cfile,
        runtime_dir, runtime_dir, runtime_dir, runtime_dir,
        runtime_dir, runtime_dir, runtime_dir,
        binf);
    int rc = system(cmd);
    remove(cfile);
    if (rc != 0) { fputs("error: compilation failed\n", stderr); return 1; }

    /* run — forward remaining argv to compiled binary */
    {
        char run_cmd[8192];
        snprintf(run_cmd, sizeof(run_cmd), "\"%s\"", binf);
        for (int i = 2; i < argc; i++) {
            strncat(run_cmd, " \"", sizeof(run_cmd) - strlen(run_cmd) - 1);
            strncat(run_cmd, argv[i], sizeof(run_cmd) - strlen(run_cmd) - 1);
            strncat(run_cmd, "\"", sizeof(run_cmd) - strlen(run_cmd) - 1);
        }
        rc = system(run_cmd);
    }
    remove(binf);
    return rc;
}
