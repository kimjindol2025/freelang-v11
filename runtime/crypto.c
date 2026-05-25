#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <openssl/evp.h>
#include <openssl/rand.h>

/* ── base64url ── */

static const char b64url[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

static char* base64url_encode(const unsigned char* src, size_t len, size_t* outlen) {
    size_t olen = ((len + 2) / 3) * 4 + 1;
    char* out = malloc(olen);
    size_t i = 0, j = 0;
    while (i < len) {
        unsigned int a = i < len ? src[i++] : 0;
        unsigned int b = i < len ? src[i++] : 0;
        unsigned int c = i < len ? src[i++] : 0;
        unsigned int triple = (a << 16) | (b << 8) | c;
        out[j++] = b64url[(triple >> 18) & 0x3F];
        out[j++] = b64url[(triple >> 12) & 0x3F];
        out[j++] = b64url[(triple >>  6) & 0x3F];
        out[j++] = b64url[(triple      ) & 0x3F];
    }
    /* base64url: padding 제거 */
    while (j > 0 && out[j-1] == '=') j--;
    out[j] = '\0';
    if (outlen) *outlen = j;
    return out;
}

static int b64url_val(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '-') return 62;
    if (c == '_') return 63;
    return -1;
}

static unsigned char* base64url_decode(const char* src, size_t slen, size_t* outlen) {
    size_t olen = (slen * 3) / 4 + 4;
    unsigned char* out = malloc(olen);
    size_t i = 0, j = 0;
    while (i + 1 < slen) {
        int a = b64url_val(src[i]);
        int b = b64url_val(src[i+1]);
        int c = (i+2 < slen) ? b64url_val(src[i+2]) : 0;
        int d = (i+3 < slen) ? b64url_val(src[i+3]) : 0;
        if (a < 0 || b < 0) break;
        out[j++] = (unsigned char)((a << 2) | (b >> 4));
        if (i+2 < slen && c >= 0) out[j++] = (unsigned char)((b << 4) | (c >> 2));
        if (i+3 < slen && d >= 0) out[j++] = (unsigned char)((c << 6) | d);
        i += 4;
    }
    out[j] = '\0';
    if (outlen) *outlen = j;
    return out;
}

/* ── HMAC-SHA256 ── */

static unsigned char* hmac_sha256(const char* key, size_t klen,
                                   const char* msg, size_t mlen,
                                   unsigned int* siglen) {
    unsigned char* sig = malloc(EVP_MAX_MD_SIZE);
    HMAC(EVP_sha256(), key, (int)klen, (unsigned char*)msg, mlen, sig, siglen);
    return sig;
}

/* ── JWT ── */

static const char* JWT_HEADER_B64 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"; /* {"alg":"HS256","typ":"JWT"} */

FLValue fl_jwt_sign(FLValue payload_map, FLValue secret, FLValue exp_sec) {
    if (payload_map.tag != FL_MAP || secret.tag != FL_STRING) return fl_nil();

    /* payload JSON 직렬화 + exp 추가 */
    FLValue with_exp = payload_map;
    if (exp_sec.tag == FL_INT && exp_sec.i > 0) {
        int64_t exp_ts = (int64_t)time(NULL) + exp_sec.i;
        with_exp = fl_map_set(with_exp, fl_str_val("exp"), fl_int(exp_ts));
    }
    FLValue payload_json = fl_json_stringify(with_exp);
    const char* pj = ((FLString*)payload_json.obj)->data;

    /* payload base64url */
    char* payload_b64 = base64url_encode((unsigned char*)pj, strlen(pj), NULL);

    /* signing input: header.payload */
    size_t sign_len = strlen(JWT_HEADER_B64) + 1 + strlen(payload_b64) + 1;
    char* sign_input = malloc(sign_len);
    snprintf(sign_input, sign_len, "%s.%s", JWT_HEADER_B64, payload_b64);

    /* HMAC-SHA256 */
    const char* sk = ((FLString*)secret.obj)->data;
    unsigned int siglen = 0;
    unsigned char* sig = hmac_sha256(sk, strlen(sk), sign_input, strlen(sign_input), &siglen);
    char* sig_b64 = base64url_encode(sig, siglen, NULL);

    /* token = header.payload.signature */
    size_t tlen = strlen(sign_input) + 1 + strlen(sig_b64) + 1;
    char* token = malloc(tlen);
    snprintf(token, tlen, "%s.%s", sign_input, sig_b64);

    FLValue result = fl_str_val(token);
    free(payload_b64); free(sign_input); free(sig); free(sig_b64); free(token);
    return result;
}

FLValue fl_jwt_verify(FLValue token, FLValue secret) {
    if (token.tag != FL_STRING || secret.tag != FL_STRING) return fl_nil();
    const char* tok = ((FLString*)token.obj)->data;
    const char* sk  = ((FLString*)secret.obj)->data;

    /* 점(.) 위치 파악 */
    const char* p1 = strchr(tok, '.');
    if (!p1) return fl_nil();
    const char* p2 = strchr(p1 + 1, '.');
    if (!p2) return fl_nil();

    /* header.payload 부분 */
    size_t hp_len = (size_t)(p2 - tok);
    char* hp = malloc(hp_len + 1);
    memcpy(hp, tok, hp_len); hp[hp_len] = '\0';

    /* signature 재계산 후 비교 */
    unsigned int siglen = 0;
    unsigned char* sig = hmac_sha256(sk, strlen(sk), hp, hp_len, &siglen);
    char* expected = base64url_encode(sig, siglen, NULL);
    free(sig);

    int valid = (strcmp(expected, p2 + 1) == 0);
    free(expected); free(hp);
    if (!valid) return fl_nil();

    /* payload 디코딩 */
    size_t pl_len = (size_t)(p2 - p1 - 1);
    char* pl_b64 = malloc(pl_len + 1);
    memcpy(pl_b64, p1 + 1, pl_len); pl_b64[pl_len] = '\0';

    size_t json_len = 0;
    unsigned char* json_bytes = base64url_decode(pl_b64, pl_len, &json_len);
    free(pl_b64);

    FLValue parsed = fl_json_parse(fl_str_val((char*)json_bytes));
    free(json_bytes);

    /* exp 만료 확인 */
    if (parsed.tag == FL_MAP) {
        FLValue exp_v = fl_map_get(parsed, fl_str_val("exp"));
        if (exp_v.tag == FL_INT && exp_v.i < (int64_t)time(NULL))
            return fl_nil(); /* 만료 */
    }
    return parsed;
}

FLValue fl_jwt_expired(FLValue token) {
    if (token.tag != FL_STRING) return fl_bool(true);
    const char* tok = ((FLString*)token.obj)->data;
    const char* p1 = strchr(tok, '.');
    if (!p1) return fl_bool(true);
    const char* p2 = strchr(p1 + 1, '.');
    if (!p2) return fl_bool(true);

    size_t pl_len = (size_t)(p2 - p1 - 1);
    char* pl_b64 = malloc(pl_len + 1);
    memcpy(pl_b64, p1 + 1, pl_len); pl_b64[pl_len] = '\0';

    size_t json_len = 0;
    unsigned char* json_bytes = base64url_decode(pl_b64, pl_len, &json_len);
    free(pl_b64);

    FLValue parsed = fl_json_parse(fl_str_val((char*)json_bytes));
    free(json_bytes);

    if (parsed.tag != FL_MAP) return fl_bool(true);
    FLValue exp_v = fl_map_get(parsed, fl_str_val("exp"));
    if (exp_v.tag != FL_INT) return fl_bool(false);
    return fl_bool(exp_v.i < (int64_t)time(NULL));
}

/* ── 비밀번호 해싱 (scrypt via OpenSSL 3.x EVP_PBE_scrypt) ── */

#define SCRYPT_N  16384
#define SCRYPT_R  8
#define SCRYPT_P  1
#define SCRYPT_DK 32
#define SALT_LEN  16

FLValue fl_hash_password(FLValue pw) {
    if (pw.tag != FL_STRING) return fl_nil();
    const char* pass = ((FLString*)pw.obj)->data;

    /* 랜덤 salt */
    unsigned char salt[SALT_LEN];
    RAND_bytes(salt, SALT_LEN);

    /* salt hex */
    char salt_hex[SALT_LEN * 2 + 1];
    for (int i = 0; i < SALT_LEN; i++)
        snprintf(salt_hex + i*2, 3, "%02x", salt[i]);

    /* scrypt 파생키 */
    unsigned char dk[SCRYPT_DK];
    EVP_PBE_scrypt(pass, strlen(pass), salt, SALT_LEN,
                   SCRYPT_N, SCRYPT_R, SCRYPT_P, 0, dk, SCRYPT_DK);

    /* dk hex */
    char dk_hex[SCRYPT_DK * 2 + 1];
    for (int i = 0; i < SCRYPT_DK; i++)
        snprintf(dk_hex + i*2, 3, "%02x", dk[i]);

    /* 형식: scrypt$N$r$p$salt_hex$dk_hex */
    char buf[256];
    snprintf(buf, sizeof(buf), "scrypt$%d$%d$%d$%s$%s",
             SCRYPT_N, SCRYPT_R, SCRYPT_P, salt_hex, dk_hex);
    return fl_str_val(buf);
}

FLValue fl_verify_password(FLValue pw, FLValue hash) {
    if (pw.tag != FL_STRING || hash.tag != FL_STRING) return fl_bool(false);
    const char* pass = ((FLString*)pw.obj)->data;
    const char* h    = ((FLString*)hash.obj)->data;

    /* scrypt$N$r$p$salt$dk 파싱 */
    if (strncmp(h, "scrypt$", 7) != 0) return fl_bool(false);
    int N, r, p;
    char salt_hex[SALT_LEN*2+1], dk_hex[SCRYPT_DK*2+1];
    if (sscanf(h + 7, "%d$%d$%d$%32s$%64s", &N, &r, &p, salt_hex, dk_hex) != 5)
        return fl_bool(false);

    /* salt 복원 */
    unsigned char salt[SALT_LEN];
    for (int i = 0; i < SALT_LEN; i++) {
        unsigned int b; sscanf(salt_hex + i*2, "%02x", &b); salt[i] = (unsigned char)b;
    }

    /* scrypt 재계산 */
    unsigned char dk[SCRYPT_DK];
    EVP_PBE_scrypt(pass, strlen(pass), salt, SALT_LEN,
                   (uint64_t)N, (uint64_t)r, (uint64_t)p, 0, dk, SCRYPT_DK);

    /* 비교 */
    char cmp_hex[SCRYPT_DK*2+1];
    for (int i = 0; i < SCRYPT_DK; i++)
        snprintf(cmp_hex + i*2, 3, "%02x", dk[i]);

    return fl_bool(strcmp(cmp_hex, dk_hex) == 0);
}
