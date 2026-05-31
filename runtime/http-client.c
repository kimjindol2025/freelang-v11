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

/* ── SSE 스트리밍 ── */

/* "data: {...}" 줄에서 JSON 부분만 추출 */
static FLValue parse_sse_line(const char *line) {
    if (strncmp(line, "data: ", 6) != 0) return fl_nil();
    const char *json = line + 6;
    /* [DONE] 종료 신호 */
    if (strncmp(json, "[DONE]", 6) == 0) return fl_nil();
    /* 끝 개행 제거 */
    size_t len = strlen(json);
    while (len > 0 && (json[len-1] == '\n' || json[len-1] == '\r')) len--;
    if (len == 0) return fl_nil();
    char *buf = malloc(len + 1);
    memcpy(buf, json, len);
    buf[len] = '\0';
    FLValue r = fl_json_parse(fl_str_val(buf));
    free(buf);
    return r;
}

/* (http-post-stream url body headers handler)
 * handler: FL fn — (fn [chunk] ...)
 * chunk = 파싱된 SSE JSON 맵, nil이면 스킵
 * 반환: {:status N} */
FLValue fl_http_post_stream(FLValue url, FLValue body,
                             FLValue headers, FLValue handler) {
    if (url.tag != FL_STRING) return fl_map_new();

    const char *u = ((FLString *)url.obj)->data;
    const char *b = (body.tag == FL_STRING)
                    ? ((FLString *)body.obj)->data : "";
    char *hdrs = map_to_curl_headers(headers);

    /* 헤더 파일 (status 추출용) */
    char hdr_path[64];
    snprintf(hdr_path, sizeof(hdr_path), "/tmp/_fl_stream_hdr_%d", getpid());

    /* body 임시 파일 */
    char body_src[64];
    snprintf(body_src, sizeof(body_src), "/tmp/_fl_stream_body_%d", getpid());
    {
        FILE *bf = fopen(body_src, "wb");
        if (bf) { fwrite(b, 1, strlen(b), bf); fclose(bf); }
    }

    char *esc_url = escape_url(u);

    /* curl: -N = no-buffer, SSE 라인 단위 수신 */
    size_t cmd_cap = strlen(esc_url) + (hdrs ? strlen(hdrs) : 0) + 512;
    char  *cmd     = malloc(cmd_cap);
    snprintf(cmd, cmd_cap,
        "curl -s -N -X POST -D %s%s --data-binary @%s %s 2>/dev/null",
        hdr_path,
        hdrs && hdrs[0] ? hdrs : "",
        body_src,
        esc_url);

    free(esc_url);
    if (hdrs) free(hdrs);

    FILE *fp = popen(cmd, "r");
    free(cmd);

    long status = -1;
    if (fp) {
        char line[8192];
        while (fgets(line, sizeof(line), fp)) {
            FLValue chunk = parse_sse_line(line);
            if (chunk.tag != FL_NIL && handler.tag == FL_FN) {
                fl_fn_call(handler, 1, &chunk);
            }
        }
        pclose(fp);

        /* status 코드 읽기 */
        FILE *hf = fopen(hdr_path, "r");
        if (hf) {
            char first[256] = {0};
            if (fgets(first, sizeof(first), hf)) {
                char *sp = strchr(first, ' ');
                if (sp) status = atol(sp + 1);
            }
            fclose(hf);
        }
    }

    remove(hdr_path);
    remove(body_src);

    FLValue kv[2] = { fl_str_val("status"), fl_int(status) };
    return fl_map_from_pairs(kv, 1);
}

/* fl_http_stream_collect: SSE 청크에서 text_delta만 추출해 하나의 문자열로 반환
 * 반환: {:status N :text "전체텍스트" :chunks [{"text" "..."} ...]} */
FLValue fl_http_stream_collect(FLValue url, FLValue body, FLValue headers) {
    if (url.tag != FL_STRING) return fl_map_new();

    const char *u = ((FLString *)url.obj)->data;
    const char *b = (body.tag == FL_STRING)
                    ? ((FLString *)body.obj)->data : "";
    char *hdrs = map_to_curl_headers(headers);

    char hdr_path[64], body_src[64];
    snprintf(hdr_path,  sizeof(hdr_path),  "/tmp/_fl_sc_hdr_%d",  getpid());
    snprintf(body_src,  sizeof(body_src),   "/tmp/_fl_sc_body_%d", getpid());
    { FILE *bf = fopen(body_src, "wb");
      if (bf) { fwrite(b, 1, strlen(b), bf); fclose(bf); } }

    char *esc_url = escape_url(u);
    size_t cmd_cap = strlen(esc_url) + (hdrs ? strlen(hdrs) : 0) + 512;
    char  *cmd = malloc(cmd_cap);
    snprintf(cmd, cmd_cap,
        "curl -s -N -X POST -D %s%s --data-binary @%s %s 2>/dev/null",
        hdr_path,
        hdrs && hdrs[0] ? hdrs : "",
        body_src, esc_url);
    free(esc_url);
    if (hdrs) free(hdrs);

    /* 텍스트 축적 버퍼 */
    size_t txt_cap = 4096, txt_len = 0;
    char  *txt_buf = malloc(txt_cap);
    txt_buf[0] = '\0';

    FILE *fp = popen(cmd, "r");
    free(cmd);
    long status = 200;

    if (fp) {
        char line[8192];
        while (fgets(line, sizeof(line), fp)) {
            FLValue chunk = parse_sse_line(line);
            if (chunk.tag == FL_NIL) continue;
            /* type == "content_block_delta" && delta.type == "text_delta" */
            FLValue type  = fl_map_get(chunk, fl_str_val("type"));
            if (type.tag != FL_STRING) continue;
            if (strcmp(((FLString*)type.obj)->data, "content_block_delta") != 0) continue;
            FLValue delta = fl_map_get(chunk, fl_str_val("delta"));
            if (delta.tag != FL_MAP) continue;
            FLValue text  = fl_map_get(delta, fl_str_val("text"));
            if (text.tag != FL_STRING) continue;
            const char *t = ((FLString*)text.obj)->data;
            size_t tlen = strlen(t);
            if (txt_len + tlen + 1 > txt_cap) {
                txt_cap = (txt_len + tlen + 1) * 2;
                txt_buf = realloc(txt_buf, txt_cap);
            }
            memcpy(txt_buf + txt_len, t, tlen);
            txt_len += tlen;
            txt_buf[txt_len] = '\0';
        }
        pclose(fp);
        FILE *hf = fopen(hdr_path, "r");
        if (hf) {
            char first[256] = {0};
            if (fgets(first, sizeof(first), hf)) {
                char *sp = strchr(first, ' ');
                if (sp) status = atol(sp + 1);
            }
            fclose(hf);
        }
    }

    remove(hdr_path);
    remove(body_src);

    FLValue result_text = fl_str_val(txt_buf);
    free(txt_buf);

    FLValue kv[4] = {
        fl_str_val("status"), fl_int(status),
        fl_str_val("text"),   result_text
    };
    return fl_map_from_pairs(kv, 2);
}
