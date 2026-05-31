/* runtime/http-client.c — HTTP 클라이언트 (curl subprocess)
 * libcurl 헤더 불필요. 시스템 curl 바이너리를 subprocess로 실행.
 * 반환값: {:status 200 :body "..." :headers {}} */

#include "runtime.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <unistd.h>

/* ── 파일 전체 읽기 ── */
static char *read_file_str(const char *path, size_t *out_len) {
    FILE *f = fopen(path, "rb");
    if (!f) { *out_len = 0; return strdup(""); }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    rewind(f);
    if (sz <= 0) { fclose(f); *out_len = 0; return strdup(""); }
    char *buf = malloc((size_t)sz + 1);
    size_t n = fread(buf, 1, (size_t)sz, f);
    buf[n] = '\0';
    fclose(f);
    *out_len = n;
    return buf;
}

/* ── 헤더 파일 파싱 → FLValue map ── */
static FLValue parse_headers(const char *path) {
    FLValue hmap = fl_map_new();
    FILE *f = fopen(path, "r");
    if (!f) return hmap;
    char line[4096];
    int first = 1;
    while (fgets(line, sizeof(line), f)) {
        /* 첫 줄(HTTP/1.x ...) 스킵 */
        if (first) { first = 0; continue; }
        /* 빈 줄(헤더 끝) */
        if (line[0] == '\r' || line[0] == '\n') continue;
        char *colon = strchr(line, ':');
        if (!colon) continue;
        size_t klen = (size_t)(colon - line);
        char key[256] = {0};
        if (klen < sizeof(key)) {
            memcpy(key, line, klen);
            /* 소문자 변환 */
            for (size_t i = 0; i < klen; i++)
                if (key[i] >= 'A' && key[i] <= 'Z') key[i] += 32;
        }
        colon++;
        while (*colon == ' ') colon++;
        /* 끝 \r\n 제거 */
        size_t vlen = strlen(colon);
        while (vlen > 0 && (colon[vlen-1] == '\r' || colon[vlen-1] == '\n'))
            vlen--;
        char *val = malloc(vlen + 1);
        memcpy(val, colon, vlen);
        val[vlen] = '\0';
        hmap = fl_map_set(hmap, fl_str_val(key), fl_str_val(val));
        free(val);
    }
    fclose(f);
    return hmap;
}

/* ── URL shell escape (작은따옴표 방어) ── */
static char *escape_url(const char *url) {
    size_t len = strlen(url);
    /* 최악의 경우 각 문자가 4배 → 충분한 버퍼 */
    char *out = malloc(len * 4 + 8);
    char *p = out;
    *p++ = '\'';
    for (size_t i = 0; i < len; i++) {
        if (url[i] == '\'') {
            *p++ = '\''; *p++ = '\\'; *p++ = '\''; *p++ = '\'';
        } else {
            *p++ = url[i];
        }
    }
    *p++ = '\'';
    *p = '\0';
    return out;
}

/* ── 맵 헤더 → curl -H 인수 문자열 ── */
static char *map_to_curl_headers(FLValue hmap) {
    if (hmap.tag != FL_MAP) return strdup("");
    FLMap  *m   = (FLMap *)hmap.obj;
    size_t  cap = 4096;
    char   *out = malloc(cap);
    size_t  len = 0;
    out[0] = '\0';
    for (uint32_t i = 0; i < m->len; i++) {
        FLValue k = m->entries[i].key;
        FLValue v = m->entries[i].val;
        if (k.tag != FL_STRING || v.tag != FL_STRING) continue;
        const char *ks = ((FLString *)k.obj)->data;
        const char *vs = ((FLString *)v.obj)->data;
        /* " -H 'Key: Value'" */
        size_t need = strlen(ks) + strlen(vs) + 10;
        if (len + need + 1 > cap) {
            cap = (len + need + 1) * 2;
            out = realloc(out, cap);
        }
        snprintf(out + len, cap - len, " -H '%s: %s'", ks, vs);
        len += strlen(out + len);
    }
    return out;
}

/* ── 공통 실행 ── */
static FLValue do_curl(const char *method,
                       const char *url,
                       const char *post_body,   /* NULL = GET */
                       const char *extra_hdrs)  /* curl -H ... 문자열 */
{
    /* 임시 파일 */
    char body_path[64], hdr_path[64];
    snprintf(body_path, sizeof(body_path), "/tmp/_fl_http_body_%d", getpid());
    snprintf(hdr_path,  sizeof(hdr_path),  "/tmp/_fl_http_hdr_%d",  getpid());

    char *esc_url = escape_url(url);

    /* 명령어 조립 */
    size_t cmd_cap = strlen(esc_url) + strlen(extra_hdrs ? extra_hdrs : "") + 512;
    char  *cmd     = malloc(cmd_cap);

    if (post_body) {
        /* POST: body를 파일로 넘김 */
        char body_src[64];
        snprintf(body_src, sizeof(body_src), "/tmp/_fl_http_post_%d", getpid());
        FILE *bf = fopen(body_src, "wb");
        if (bf) { fwrite(post_body, 1, strlen(post_body), bf); fclose(bf); }

        snprintf(cmd, cmd_cap,
            "curl -s -X %s -D %s%s --data-binary @%s %s > %s 2>/dev/null",
            method,
            hdr_path,
            extra_hdrs ? extra_hdrs : "",
            body_src,
            esc_url,
            body_path);
    } else {
        snprintf(cmd, cmd_cap,
            "curl -s -D %s%s %s > %s 2>/dev/null",
            hdr_path,
            extra_hdrs ? extra_hdrs : "",
            esc_url,
            body_path);
    }

    int sys_ret = system(cmd);
    (void)sys_ret;
    free(esc_url);
    free(cmd);

    /* 결과 읽기 */
    size_t blen = 0;
    char  *body = read_file_str(body_path,  &blen);
    FLValue hmap = parse_headers(hdr_path);

    /* HTTP status: 헤더 첫 줄 파싱 */
    long status = 200;
    FILE *hf = fopen(hdr_path, "r");
    if (hf) {
        char first_line[256] = {0};
        if (fgets(first_line, sizeof(first_line), hf)) {
            /* "HTTP/1.1 200 OK" */
            char *sp = strchr(first_line, ' ');
            if (sp) status = atol(sp + 1);
        }
        fclose(hf);
    }

    /* 임시 파일 정리 */
    remove(body_path);
    remove(hdr_path);
    if (post_body) {
        char body_src[64];
        snprintf(body_src, sizeof(body_src), "/tmp/_fl_http_post_%d", getpid());
        remove(body_src);
    }

    FLValue kv[6] = {
        fl_str_val("status"), fl_int(status),
        fl_str_val("body"),   fl_str_val(body ? body : ""),
        fl_str_val("headers"), hmap
    };
    FLValue result = fl_map_from_pairs(kv, 3);
    free(body);
    return result;
}

/* ── 공개 API ── */

FLValue fl_http_get(FLValue url) {
    if (url.tag != FL_STRING) return fl_map_new();
    return do_curl("GET", ((FLString *)url.obj)->data, NULL, NULL);
}

FLValue fl_http_post(FLValue url, FLValue body, FLValue content_type) {
    if (url.tag != FL_STRING) return fl_map_new();
    const char *u  = ((FLString *)url.obj)->data;
    const char *b  = (body.tag == FL_STRING) ? ((FLString *)body.obj)->data : "";
    /* Content-Type 헤더 */
    char ct_hdr[512] = "";
    if (content_type.tag == FL_STRING)
        snprintf(ct_hdr, sizeof(ct_hdr),
                 " -H 'Content-Type: %s'",
                 ((FLString *)content_type.obj)->data);
    return do_curl("POST", u, b, ct_hdr[0] ? ct_hdr : NULL);
}

FLValue fl_http_get_headers(FLValue url, FLValue headers) {
    if (url.tag != FL_STRING) return fl_map_new();
    const char *u    = ((FLString *)url.obj)->data;
    char       *hdrs = map_to_curl_headers(headers);
    FLValue result   = do_curl("GET", u, NULL, hdrs[0] ? hdrs : NULL);
    free(hdrs);
    return result;
}

FLValue fl_http_post_headers(FLValue url, FLValue body, FLValue headers) {
    if (url.tag != FL_STRING) return fl_map_new();
    const char *u    = ((FLString *)url.obj)->data;
    const char *b    = (body.tag == FL_STRING) ? ((FLString *)body.obj)->data : "";
    char       *hdrs = map_to_curl_headers(headers);
    FLValue result   = do_curl("POST", u, b, hdrs[0] ? hdrs : NULL);
    free(hdrs);
    return result;
}
