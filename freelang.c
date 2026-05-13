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
#define ARENA_SZ (1 << 22)   /* 4 MB */
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
#define MAX_TOKS 32768
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
    if (n->k == NA) { sym_add(out_ss, n->v); return; }
    if (n->k == NL) {
        /* skip c[0] — always operator/form name, not a variable reference */
        for (int i = 1; i < n->nc; i++) collect_syms(n->c[i], out_ss);
        return;
    }
    for (int i = 0; i < n->nc; i++) collect_syms(n->c[i], out_ss);
}

/* ──────────────────────────────── Emitter ── */
static FILE* out;
static void E(const char* fmt, ...) {
    va_list a; va_start(a, fmt); vfprintf(out, fmt, a); va_end(a);
}

static void cname(const char* s, char* b, size_t sz) {
    size_t i = 0;
    for (size_t j = 0; s[j] && i < sz-2; j++)
        b[i++] = (s[j] == '-' || s[j] == '?') ? '_' : s[j];
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
#define MAX_NODES 4096
static N* nodes[MAX_NODES];
static int nnodes;

/* forward declarations for closure helpers */
static int  is_defn_name(const char*);
static int  is_global_name(const char*);
static void free_vars(N*, SymSet*);
static void emit_node(N* n);

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
        char b[512]; cname(n->v, b, sizeof(b)); E("%s", b); return;
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
    if (sym(op,"cond")) { emit_cond_r(a, na); return; }
    if (sym(op,"do")) {
        E("((__extension__ ({\n");
        for (int i = 0; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 0) { E("        "); emit_node(a[na-1]); E(";\n"); }
        E("    })))");
        return;
    }
    if (sym(op,"let")) {
        N* bl = a[0]; N** it = bl->c; int ni = bl->nc;
        int nested = (ni > 0 && it[0]->k == NL);
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
    /* generic call — defn → direct C, define/unknown → dynamic dispatch */
    char b[512]; cname(op->v, b, sizeof(b));
    if (is_defn_name(op->v)) {
        E("%s(", b); emit_args(a, na); E(")");
    } else {
        if (na > 0) { E("fl_fn_call(%s, %d, (FLValue[]){", b, na); emit_args(a, na); E("})"); }
        else E("fl_fn_call(%s, 0, NULL)", b);
    }
}

/* ──────────────────────────────── Program ── */

static int is_defn_name(const char* name) {
    for (int i = 0; i < nnodes; i++) {
        N* nd = nodes[i];
        if (nd && nd->k==NL && nd->nc>=2 && sym(nd->c[0],"defn")
            && !strcmp(nd->c[1]->v, name)) return 1;
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
    if (fn_node->nc >= 3) collect_syms(fn_node->c[2], &used);
    N* params = (fn_node->nc >= 2) ? fn_node->c[1] : NULL;
    for (int i = 0; i < used.n; i++) {
        const char* v = used.s[i]; int bound = 0;
        if (is_global_name(v)) continue;
        if (params) for (int j = 0; j < params->nc; j++)
            if (!strcmp(params->c[j]->v, v)) { bound=1; break; }
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
    /* Two-buffer strategy:
     * preamble  — anonymous fn C functions (populated by fn handler)
     * body      — forward decls + defn bodies + main()
     * Final output: header + preamble + body */
    preamble = tmpfile();
    FILE* body = tmpfile();
    if (!preamble || !body) { fputs("error: tmpfile failed\n", stderr); exit(1); }

    FILE* final_out = out;
    out = body;

    /* forward declarations */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 3) continue;
        if (!sym(n->c[0], "defn")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        E("FLValue %s(", b); emit_params(n->c[2]); E(");\n");
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
    /* function definitions — fn literals inside bodies populate preamble */
    for (int i = 0; i < nnodes; i++) {
        N* n = nodes[i];
        if (!n || n->k != NL || n->nc < 4) continue;
        if (!sym(n->c[0], "defn")) continue;
        char b[512]; cname(n->c[1]->v, b, sizeof(b));
        E("FLValue %s(", b); emit_params(n->c[2]); E(") {\n");
        E("    return "); emit_node(n->c[3]); E(";\n}\n\n");
    }
    /* main */
    E("int main(void) {\n");
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
    flush_file(preamble, out);
    flush_file(body, out);
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
    if (argc < 2) { fputs("usage: freelang <input.fl>\n", stderr); return 1; }
    const char* input = argv[1];

    /* runtime directory: same dir as freelang binary */
    char self_path[512]; strncpy(self_path, argv[0], 511);
    char* dir = dirname(self_path);
    char runtime_dir[512]; snprintf(runtime_dir, sizeof(runtime_dir), "%s/runtime", dir);

    /* temp paths */
    char cfile[512]; snprintf(cfile, sizeof(cfile), "/tmp/fl_out_%d.c", (int)getpid());
    char binf[512];  snprintf(binf,  sizeof(binf),  "/tmp/fl_out_%d",   (int)getpid());

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

    /* compile */
    char cmd[4096];
    snprintf(cmd, sizeof(cmd),
        "gcc -I%s %s %s/runtime.c -o %s",
        runtime_dir, cfile, runtime_dir, binf);
    int rc = system(cmd);
    remove(cfile);
    if (rc != 0) { fputs("error: compilation failed\n", stderr); return 1; }

    /* run */
    rc = system(binf);
    remove(binf);
    return rc;
}
