#include "runtime.h"
#include "internal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <pthread.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <signal.h>
#include <fcntl.h>

/* ── 라우팅 테이블 ── */
#define MAX_ROUTES 256
#define MAX_PARAMS 16

typedef struct {
    char   method[8];   /* GET / POST / PUT / DELETE / PATCH */
    char   pattern[256];
    FLValue handler;    /* FL_FN closure */
} Route;

static Route  g_routes[MAX_ROUTES];
static int    g_nroutes = 0;
static int    g_server_fd = -1;

/* ── 패턴 매칭 — :param 지원 ── */
static int match_route(const char* pattern, const char* path,
                        char param_keys[][64], char param_vals[][256], int* nparam) {
    *nparam = 0;
    const char* pp = pattern;
    const char* cp = path;
    while (*pp && *cp) {
        if (*pp == ':') {
            /* 파라미터 이름 추출 */
            pp++;
            char key[64]; int ki = 0;
            while (*pp && *pp != '/') key[ki++] = *pp++;
            key[ki] = '\0';
            /* 값 추출 */
            char val[256]; int vi = 0;
            while (*cp && *cp != '/') val[vi++] = *cp++;
            val[vi] = '\0';
            strcpy(param_keys[*nparam], key);
            strcpy(param_vals[*nparam], val);
            (*nparam)++;
        } else {
            if (*pp != *cp) return 0;
            pp++; cp++;
        }
    }
    /* 후행 슬래시 무시 */
    while (*pp == '/') pp++;
    while (*cp == '/') cp++;
    return (*pp == '\0' && *cp == '\0');
}

/* ── Request 파싱 ── */
typedef struct {
    char method[8];
    char path[512];
    char query_str[512];
    char body[65536];
    int  body_len;
    char headers[4096];  /* raw headers */
    char content_type[128];
    int  content_length;
} ParsedReq;

static void parse_request(const char* raw, int rawlen, ParsedReq* req) {
    memset(req, 0, sizeof(*req));
    /* 첫 줄: METHOD /path?query HTTP/1.1 */
    const char* p = raw;
    int i = 0;
    while (*p && *p != ' ' && i < 7) req->method[i++] = *p++;
    req->method[i] = '\0';
    while (*p == ' ') p++;
    i = 0;
    char full_path[512];
    while (*p && *p != ' ' && i < 511) full_path[i++] = *p++;
    full_path[i] = '\0';
    /* query 분리 */
    char* q = strchr(full_path, '?');
    if (q) {
        strncpy(req->path, full_path, (size_t)(q - full_path));
        req->path[q - full_path] = '\0';
        strncpy(req->query_str, q + 1, sizeof(req->query_str)-1);
    } else {
        strncpy(req->path, full_path, sizeof(req->path)-1);
    }
    /* 헤더 파싱 */
    const char* header_end = strstr(raw, "\r\n\r\n");
    if (!header_end) return;
    size_t hlen = (size_t)(header_end - raw);
    if (hlen < sizeof(req->headers)) {
        memcpy(req->headers, raw, hlen);
        req->headers[hlen] = '\0';
    }
    /* Content-Length */
    const char* cl = strcasestr(req->headers, "content-length:");
    if (cl) req->content_length = atoi(cl + 15);
    /* Content-Type */
    const char* ct = strcasestr(req->headers, "content-type:");
    if (ct) {
        ct += 13; while (*ct == ' ') ct++;
        i = 0;
        while (*ct && *ct != '\r' && *ct != '\n' && i < 127) req->content_type[i++] = *ct++;
        req->content_type[i] = '\0';
    }
    /* body */
    const char* body_start = header_end + 4;
    int blen = rawlen - (int)(body_start - raw);
    if (blen > 0 && blen < (int)sizeof(req->body)-1) {
        memcpy(req->body, body_start, (size_t)blen);
        req->body[blen] = '\0';
        req->body_len = blen;
    }
}

/* ── URL 디코딩 ── */
static void url_decode(const char* src, char* dst, size_t dstlen) {
    size_t i = 0;
    while (*src && i < dstlen - 1) {
        if (*src == '%' && src[1] && src[2]) {
            char hex[3] = {src[1], src[2], 0};
            dst[i++] = (char)strtol(hex, NULL, 16);
            src += 3;
        } else if (*src == '+') {
            dst[i++] = ' '; src++;
        } else {
            dst[i++] = *src++;
        }
    }
    dst[i] = '\0';
}

/* ── query string → FLMap ── */
static FLValue parse_query(const char* qs) {
    FLValue map = fl_map_new();
    if (!qs || !*qs) return map;
    char buf[512]; strncpy(buf, qs, sizeof(buf)-1);
    char* tok = strtok(buf, "&");
    while (tok) {
        char* eq = strchr(tok, '=');
        if (eq) {
            *eq = '\0';
            char key[128], val[256];
            url_decode(tok, key, sizeof(key));
            url_decode(eq+1, val, sizeof(val));
            map = fl_map_set(map, fl_str_val(key), fl_str_val(val));
        }
        tok = strtok(NULL, "&");
    }
    return map;
}

/* ── form body → FLMap ── */
static FLValue parse_form(const char* body) {
    return parse_query(body);
}

/* ── 쿠키 헤더 → FLMap ── */
static FLValue parse_cookies(const char* headers) {
    FLValue map = fl_map_new();
    const char* p = strcasestr(headers, "cookie:");
    if (!p) return map;
    p += 7; while (*p == ' ') p++;
    char buf[1024]; int i = 0;
    while (*p && *p != '\r' && *p != '\n' && i < 1023) buf[i++] = *p++;
    buf[i] = '\0';
    char* tok = strtok(buf, ";");
    while (tok) {
        while (*tok == ' ') tok++;
        char* eq = strchr(tok, '=');
        if (eq) {
            *eq = '\0';
            char key[128], val[256];
            url_decode(tok, key, sizeof(key));
            url_decode(eq+1, val, sizeof(val));
            map = fl_map_set(map, fl_str_val(key), fl_str_val(val));
        }
        tok = strtok(NULL, ";");
    }
    return map;
}

/* ── ParsedReq → FLValue (request map) ── */
static FLValue build_req(ParsedReq* r,
                          char param_keys[][64], char param_vals[][256], int nparam) {
    FLValue req = fl_map_new();
    req = fl_map_set(req, fl_str_val("method"), fl_str_val(r->method));
    req = fl_map_set(req, fl_str_val("path"),   fl_str_val(r->path));
    /* query */
    req = fl_map_set(req, fl_str_val("query"), parse_query(r->query_str));
    /* params */
    FLValue params = fl_map_new();
    for (int i = 0; i < nparam; i++)
        params = fl_map_set(params, fl_str_val(param_keys[i]), fl_str_val(param_vals[i]));
    req = fl_map_set(req, fl_str_val("params"), params);
    /* cookies */
    req = fl_map_set(req, fl_str_val("cookies"), parse_cookies(r->headers));
    /* body */
    if (r->body_len > 0) {
        int is_json = (strstr(r->content_type, "application/json") != NULL);
        int is_form = (strstr(r->content_type, "application/x-www-form-urlencoded") != NULL);
        if (is_json) {
            FLValue parsed = fl_json_parse(fl_str_val(r->body));
            req = fl_map_set(req, fl_str_val("body"), parsed);
        } else if (is_form) {
            req = fl_map_set(req, fl_str_val("body"), parse_form(r->body));
        } else {
            req = fl_map_set(req, fl_str_val("body"), fl_str_val(r->body));
        }
    } else {
        req = fl_map_set(req, fl_str_val("body"), fl_nil());
    }
    return req;
}

/* ── Response 전송 ── */
static void send_response(int fd, int status, const char* ctype,
                           const char* body, size_t bodylen,
                           const char* extra_headers) {
    char head[1024];
    const char* status_text = "OK";
    if (status == 201) status_text = "Created";
    else if (status == 204) status_text = "No Content";
    else if (status == 301 || status == 302) status_text = "Redirect";
    else if (status == 400) status_text = "Bad Request";
    else if (status == 401) status_text = "Unauthorized";
    else if (status == 403) status_text = "Forbidden";
    else if (status == 404) status_text = "Not Found";
    else if (status == 500) status_text = "Internal Server Error";

    int hlen = snprintf(head, sizeof(head),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "%s"
        "\r\n",
        status, status_text, ctype, bodylen,
        extra_headers ? extra_headers : "");
    write(fd, head, (size_t)hlen);
    if (bodylen > 0) write(fd, body, bodylen);
}

/* ── FLValue(response map) → HTTP wire ── */
static void dispatch_response(int fd, FLValue rv) {
    if (rv.tag != FL_MAP) {
        const char* body = "Internal Error";
        send_response(fd, 500, "text/plain", body, strlen(body), NULL);
        return;
    }
    FLValue status_v  = fl_map_get(rv, fl_str_val("status"));
    FLValue ctype_v   = fl_map_get(rv, fl_str_val("content_type"));
    FLValue body_v    = fl_map_get(rv, fl_str_val("body"));
    FLValue headers_v = fl_map_get(rv, fl_str_val("headers"));

    int status = (status_v.tag == FL_INT) ? (int)status_v.i : 200;
    const char* ctype = (ctype_v.tag == FL_STRING) ? ((FLString*)ctype_v.obj)->data : "text/plain";

    char extra[1024] = "";
    if (headers_v.tag == FL_MAP) {
        FLMap* hm = (FLMap*)headers_v.obj;
        size_t off = 0;
        for (uint32_t i = 0; i < hm->len && off < sizeof(extra)-128; i++) {
            const char* k = ((FLString*)hm->entries[i].key.obj)->data;
            char tmp[64]; const char* v = fl_to_str(hm->entries[i].val, tmp, sizeof(tmp));
            off += (size_t)snprintf(extra+off, sizeof(extra)-off, "%s: %s\r\n", k, v);
        }
    }

    if (body_v.tag == FL_STRING) {
        const char* body = ((FLString*)body_v.obj)->data;
        send_response(fd, status, ctype, body, strlen(body), extra);
    } else {
        char buf[64];
        const char* body = fl_to_str(body_v, buf, sizeof(buf));
        send_response(fd, status, ctype, body, strlen(body), extra);
    }
}

/* ── 연결 처리 스레드 ── */
typedef struct { int fd; } ConnArg;

static void* handle_conn(void* arg) {
    ConnArg* ca = (ConnArg*)arg;
    int fd = ca->fd;
    free(ca);

    char raw[131072]; /* 128KB */
    ssize_t n = read(fd, raw, sizeof(raw)-1);
    if (n <= 0) { close(fd); return NULL; }
    raw[n] = '\0';

    ParsedReq req;
    parse_request(raw, (int)n, &req);

    /* 라우트 검색 */
    char pk[MAX_PARAMS][64];
    char pv[MAX_PARAMS][256];
    int  np = 0;
    FLValue handler = fl_nil();

    for (int i = 0; i < g_nroutes; i++) {
        if (strcasecmp(g_routes[i].method, req.method) != 0) continue;
        if (match_route(g_routes[i].pattern, req.path, pk, pv, &np)) {
            handler = g_routes[i].handler;
            break;
        }
    }

    if (handler.tag != FL_FN) {
        const char* body = "Not Found";
        send_response(fd, 404, "text/plain", body, strlen(body), NULL);
        close(fd);
        return NULL;
    }

    FLValue req_val = build_req(&req, pk, pv, np);
    FLValue argv[1] = { req_val };
    FLValue rv = fl_fn_call(handler, 1, argv);
    dispatch_response(fd, rv);

    close(fd);
    return NULL;
}

/* ── 서버 루프 스레드 ── */
static int  g_port = 0;

static void* server_loop(void* _arg) {
    (void)_arg;
    signal(SIGPIPE, SIG_IGN);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons((uint16_t)g_port);

    if (bind(g_server_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind"); return NULL;
    }
    if (listen(g_server_fd, 128) < 0) {
        perror("listen"); return NULL;
    }
    fprintf(stderr, "[http] listening on :%d\n", g_port);

    while (1) {
        int cfd = accept(g_server_fd, NULL, NULL);
        if (cfd < 0) {
            if (errno == EINTR) continue;
            break;
        }
        ConnArg* ca = malloc(sizeof(ConnArg));
        ca->fd = cfd;
        pthread_t t;
        pthread_create(&t, NULL, handle_conn, ca);
        pthread_detach(t);
    }
    return NULL;
}

/* ── 공개 API ── */

/* (fl-http-route method pattern handler) → nil */
FLValue fl_http_route(FLValue method, FLValue pattern, FLValue handler) {
    if (method.tag != FL_STRING || pattern.tag != FL_STRING) return fl_nil();
    if (g_nroutes >= MAX_ROUTES) return fl_nil();
    Route* r = &g_routes[g_nroutes++];
    strncpy(r->method,  ((FLString*)method.obj)->data,  sizeof(r->method)-1);
    strncpy(r->pattern, ((FLString*)pattern.obj)->data, sizeof(r->pattern)-1);
    r->handler = handler;
    return fl_nil();
}

/* (fl-http-start port) → nil  — 논블로킹 백그라운드 스레드 */
FLValue fl_http_start(FLValue port) {
    if (port.tag != FL_INT) return fl_nil();
    g_port = (int)port.i;

    g_server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (g_server_fd < 0) return fl_nil();
    int opt = 1;
    setsockopt(g_server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    /* cgc-bin: server_loop를 메인 스레드에서 블로킹 실행 */
    server_loop(NULL);
    return fl_nil();
}

/* (fl-http-stop) → nil */
FLValue fl_http_stop(void) {
    if (g_server_fd >= 0) {
        close(g_server_fd);
        g_server_fd = -1;
    }
    return fl_nil();
}

/* ── response 빌더 헬퍼 (codegen 에서 server-html/json/status 등 생성) ── */

FLValue fl_resp_html(FLValue body) {
    FLValue r = fl_map_new();
    r = fl_map_set(r, fl_str_val("status"),       fl_int(200));
    r = fl_map_set(r, fl_str_val("content_type"), fl_str_val("text/html; charset=utf-8"));
    r = fl_map_set(r, fl_str_val("body"),         body);
    return r;
}

FLValue fl_resp_json(FLValue val) {
    FLValue body = fl_json_stringify(val);
    FLValue r = fl_map_new();
    r = fl_map_set(r, fl_str_val("status"),       fl_int(200));
    r = fl_map_set(r, fl_str_val("content_type"), fl_str_val("application/json"));
    r = fl_map_set(r, fl_str_val("body"),         body);
    return r;
}

FLValue fl_resp_status(FLValue code, FLValue msg) {
    char buf[64];
    const char* s = (msg.tag == FL_STRING) ? ((FLString*)msg.obj)->data
                                           : fl_to_str(msg, buf, sizeof(buf));
    FLValue r = fl_map_new();
    r = fl_map_set(r, fl_str_val("status"),       code);
    r = fl_map_set(r, fl_str_val("content_type"), fl_str_val("text/plain"));
    r = fl_map_set(r, fl_str_val("body"),         fl_str_val(s));
    return r;
}

FLValue fl_resp_redirect(FLValue url) {
    char buf[256];
    const char* u = (url.tag == FL_STRING) ? ((FLString*)url.obj)->data
                                           : fl_to_str(url, buf, sizeof(buf));
    char loc[300]; snprintf(loc, sizeof(loc), "Location: %s\r\n", u);
    FLValue r = fl_map_new();
    r = fl_map_set(r, fl_str_val("status"),       fl_int(302));
    r = fl_map_set(r, fl_str_val("content_type"), fl_str_val("text/plain"));
    r = fl_map_set(r, fl_str_val("body"),         fl_str_val(""));
    FLValue hdrs = fl_map_new();
    hdrs = fl_map_set(hdrs, fl_str_val("Location"), fl_str_val(u));
    r = fl_map_set(r, fl_str_val("headers"), hdrs);
    return r;
}

FLValue fl_resp_html_cookie(FLValue body, FLValue cookie) {
    FLValue r = fl_resp_html(body);
    FLValue hdrs = fl_map_new();
    char buf[64]; const char* c = fl_to_str(cookie, buf, sizeof(buf));
    hdrs = fl_map_set(hdrs, fl_str_val("Set-Cookie"), fl_str_val(c));
    r = fl_map_set(r, fl_str_val("headers"), hdrs);
    return r;
}

FLValue fl_resp_set_cookie(FLValue name, FLValue value, FLValue opts) {
    char buf_n[64], buf_v[256];
    const char* n = (name.tag  == FL_STRING) ? ((FLString*)name.obj)->data  : fl_to_str(name,  buf_n, sizeof(buf_n));
    const char* v = (value.tag == FL_STRING) ? ((FLString*)value.obj)->data : fl_to_str(value, buf_v, sizeof(buf_v));
    int max_age = 3600;
    if (opts.tag == FL_MAP) {
        FLValue ma = fl_map_get(opts, fl_str_val("max_age"));
        if (ma.tag == FL_INT) max_age = (int)ma.i;
    }
    char cookie[512];
    snprintf(cookie, sizeof(cookie),
             "%s=%s; Max-Age=%d; Path=/; HttpOnly; SameSite=Strict", n, v, max_age);
    return fl_str_val(cookie);
}
