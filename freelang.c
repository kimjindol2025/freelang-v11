/*
 * freelang.c — FreeLang seed compiler (Stage 4)
 *
 * 지원: number/string/bool/nil literal, variable, defn, define,
 *       let, if, cond, do, +,-,*,/,%, =,!=,<,>,<=,>=, and,or,not,
 *       println, print, str, function call
 * 제외: closure, map, vector, loop/recur, try/catch
 *
 * 사용: ./freelang input.fl
 * 컴파일: gcc freelang.c -o freelang
 */

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
typedef enum { T_LP,T_RP,T_LB,T_RB,T_NUM,T_STR,T_SYM,T_EOF } TK;
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
                   s[i]!='(' && s[i]!=')' && s[i]!='[' && s[i]!=']' && s[i]!=';')
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
typedef struct N N;
struct N { int k; char v[512]; N** c; int nc; };

static N* mkn(int k, const char* v) {
    N* n = aa(sizeof(N)); n->k = k;
    if (v) { strncpy(n->v, v, 511); n->v[511] = 0; }
    return n;
}
static N* mkl(N** items, int n) {
    N* nd = mkn(NL, NULL);
    nd->c = aa(sizeof(N*) * (n + 1));
    memcpy(nd->c, items, sizeof(N*) * n);
    nd->nc = n; return nd;
}

static N* pnode(void) {
    Tok t = pk();
    if (t.k == T_EOF) return NULL;
    if (t.k == T_LP || t.k == T_LB) {
        TK close = (t.k == T_LP) ? T_RP : T_RB;
        nx();
        N* items[1024]; int n = 0;
        while (pk().k != close && pk().k != T_EOF)
            items[n++] = pnode();
        if (pk().k == close) nx();
        return mkl(items, n);
    }
    nx();
    if (t.k == T_NUM) return mkn(NN, t.v);
    if (t.k == T_STR) return mkn(NS, t.v);
    return mkn(NA, t.v);
}

static int sym(N* n, const char* s) {
    return n && n->k == NA && strcmp(n->v, s) == 0;
}

/* ──────────────────────────────── Emitter ── */
static FILE* out;
static void E(const char* fmt, ...) {
    va_list a; va_start(a, fmt); vfprintf(out, fmt, a); va_end(a);
}

static void cname(const char* s, char* b, size_t sz) {
    size_t i = 0;
    for (size_t j = 0; s[j] && i < sz-1; j++)
        b[i++] = (s[j] == '-' || s[j] == '?') ? '_' : s[j];
    b[i] = 0;
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
    /* file I/O */
    if (sym(op,"file-read")) {
        E("fl_file_read("); emit_node(a[0]); E(")"); return;
    }
    if (sym(op,"file-write")) {
        E("fl_file_write("); emit_node(a[0]); E(", "); emit_node(a[1]); E(")"); return;
    }
    /* generic call */
    char b[512]; cname(op->v, b, sizeof(b));
    E("%s(", b); emit_args(a, na); E(")");
}

/* ──────────────────────────────── Program ── */
#define MAX_NODES 4096
static N* nodes[MAX_NODES];
static int nnodes;

static void emit_params(N* params) {
    int first = 1;
    for (int i = 0; i < params->nc; i++) {
        if (params->c[i]->k != NA) continue;
        char b[512]; cname(params->c[i]->v, b, sizeof(b));
        if (!first) E(", ");
        first = 0;
        E("FLValue %s", b);
    }
}

static void emit_program(void) {
    E("#include \"runtime.h\"\n\n");
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
    /* function definitions */
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
