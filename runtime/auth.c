#define _GNU_SOURCE
#include "runtime.h"
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <errno.h>
#include <fcntl.h>
#include <ctype.h>
#include <math.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/random.h>
#include <unistd.h>

static const char *auth_string(FLValue value, const char *name) {
    if (value.tag != FL_STRING || !value.obj)
        fl_throw(fl_str_val(name));
    return ((FLString *)value.obj)->data;
}

static int auth_random(void *buffer, size_t length) {
    unsigned char *p = buffer;
    while (length) {
        ssize_t n = getrandom(p, length, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == ENOSYS || errno == EPERM)) break;
        if (n <= 0) return -1;
        p += n;
        length -= (size_t)n;
    }
    if (!length) return 0;
    int fd = open("/dev/urandom", O_RDONLY | O_CLOEXEC);
    if (fd < 0) return -1;
    while (length) {
        ssize_t n = read(fd, p, length);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) { close(fd); return -1; }
        p += n;
        length -= (size_t)n;
    }
    close(fd);
    return 0;
}

FLValue fl_auth_random_int(FLValue min_value, FLValue max_value) {
    if (min_value.tag != FL_INT || max_value.tag != FL_INT || min_value.i > max_value.i)
        fl_throw(fl_str_val("random_int expects ordered integer bounds"));
    uint64_t span = (uint64_t)max_value.i - (uint64_t)min_value.i + 1;
    uint64_t value;
    if (span == 0) {
        if (auth_random(&value, sizeof(value)) != 0) fl_throw(fl_str_val("secure random source failed"));
        return fl_int((int64_t)value);
    }
    uint64_t threshold = (uint64_t)(-span) % span;
    do {
        if (auth_random(&value, sizeof(value)) != 0) fl_throw(fl_str_val("secure random source failed"));
    } while (value < threshold);
    return fl_int((int64_t)((uint64_t)min_value.i + value % span));
}

FLValue fl_auth_random_token(FLValue bytes_value) {
    if (bytes_value.tag != FL_INT || bytes_value.i < 16 || bytes_value.i > 128)
        fl_throw(fl_str_val("auth-random-token expects 16 to 128 bytes"));
    size_t size = (size_t)bytes_value.i;
    unsigned char bytes[128];
    char hex[257];
    static const char digits[] = "0123456789abcdef";
    if (auth_random(bytes, size) != 0) fl_throw(fl_str_val("secure random source failed"));
    for (size_t i = 0; i < size; i++) {
        hex[i * 2] = digits[bytes[i] >> 4];
        hex[i * 2 + 1] = digits[bytes[i] & 15];
    }
    hex[size * 2] = '\0';
    OPENSSL_cleanse(bytes, sizeof(bytes));
    return fl_str_val(hex);
}

FLValue fl_auth_pbkdf2(FLValue password_value, FLValue salt_value, FLValue iterations_value) {
    const char *password = auth_string(password_value, "auth-pbkdf2 expects password string");
    const char *salt = auth_string(salt_value, "auth-pbkdf2 expects salt string");
    if (iterations_value.tag != FL_INT || iterations_value.i < 10000 || iterations_value.i > 1000000)
        fl_throw(fl_str_val("auth-pbkdf2 iterations must be between 10000 and 1000000"));
    unsigned char digest[32];
    char hex[65];
    static const char digits[] = "0123456789abcdef";
    if (strlen(password) > 4096 || strlen(salt) < 32 || strlen(salt) > 256 ||
        PKCS5_PBKDF2_HMAC(password, (int)strlen(password),
                          (const unsigned char *)salt, (int)strlen(salt),
                          (int)iterations_value.i, EVP_sha256(), sizeof(digest), digest) != 1)
        fl_throw(fl_str_val("PBKDF2-SHA256 failed"));
    for (size_t i = 0; i < sizeof(digest); i++) {
        hex[i * 2] = digits[digest[i] >> 4];
        hex[i * 2 + 1] = digits[digest[i] & 15];
    }
    hex[64] = '\0';
    OPENSSL_cleanse(digest, sizeof(digest));
    return fl_str_val(hex);
}

static int auth_hex(const char *value, size_t length) {
    if (length & 1) return 0;
    for (size_t i = 0; i < length; i++) {
        unsigned char c = (unsigned char)value[i];
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') ||
              (c >= 'A' && c <= 'F'))) return 0;
    }
    return 1;
}

FLValue fl_auth_hash_password(FLValue password_value) {
    const char *password = auth_string(password_value, "auth-hash-password expects password string");
    FLValue salt_value = fl_auth_random_token(fl_int(16));
    FLValue digest_value = fl_auth_pbkdf2(password_value, salt_value, fl_int(100000));
    const char *salt = ((FLString *)salt_value.obj)->data;
    const char *digest = ((FLString *)digest_value.obj)->data;
    char encoded[13 + 1 + 6 + 1 + 32 + 1 + 64 + 1];
    if (strlen(password) > 4096 || strlen(digest) != 64)
        fl_throw(fl_str_val("auth-hash-password failed"));
    snprintf(encoded, sizeof(encoded), "pbkdf2-sha256$100000$%s$%s", salt, digest);
    return fl_str_val(encoded);
}

FLValue fl_auth_verify_password(FLValue password_value, FLValue encoded_value) {
    (void)auth_string(password_value, "auth-verify-password expects password string");
    const char *encoded = auth_string(encoded_value, "auth-verify-password expects encoded hash string");
    static const char prefix[] = "pbkdf2-sha256$";
    if (strncmp(encoded, prefix, sizeof(prefix) - 1) != 0) return fl_bool(false);
    const char *rounds = encoded + sizeof(prefix) - 1;
    const char *rounds_end = strchr(rounds, '$');
    if (!rounds_end || rounds_end == rounds) return fl_bool(false);
    unsigned long iterations = 0;
    for (const char *p = rounds; p < rounds_end; p++) {
        if (*p < '0' || *p > '9' || iterations > 1000000) return fl_bool(false);
        iterations = iterations * 10 + (unsigned long)(*p - '0');
    }
    if (iterations < 10000 || iterations > 1000000)
        return fl_bool(false);
    const char *salt = rounds_end + 1;
    const char *salt_end = strchr(salt, '$');
    if (!salt_end) return fl_bool(false);
    size_t salt_length = (size_t)(salt_end - salt);
    const char *digest = salt_end + 1;
    size_t digest_length = strlen(digest);
    if (salt_length < 32 || salt_length > 256 || digest_length != 64 ||
        strchr(digest, '$') || !auth_hex(salt, salt_length) || !auth_hex(digest, digest_length))
        return fl_bool(false);
    char salt_copy[257];
    memcpy(salt_copy, salt, salt_length);
    salt_copy[salt_length] = '\0';
    FLValue computed = fl_auth_pbkdf2(password_value, fl_str_val(salt_copy), fl_int((int64_t)iterations));
    return fl_auth_constant_time_equal(computed, fl_str_val(digest));
}

FLValue fl_auth_constant_time_equal(FLValue left_value, FLValue right_value) {
    const char *left = auth_string(left_value, "auth-constant-time-equal expects strings");
    const char *right = auth_string(right_value, "auth-constant-time-equal expects strings");
    size_t left_length = strlen(left), right_length = strlen(right);
    size_t length = left_length > right_length ? left_length : right_length;
    size_t length_diff = left_length ^ right_length;
    unsigned char diff = 0;
    for (size_t i = 0; i < length; i++) {
        unsigned char a = i < left_length ? (unsigned char)left[i] : 0;
        unsigned char b = i < right_length ? (unsigned char)right[i] : 0;
        diff |= (unsigned char)(a ^ b);
    }
    return fl_bool(length_diff == 0 && diff == 0);
}

static int jwt_b64url_encode(const unsigned char *src, size_t len, char **out, size_t *out_len) {
    if (len > INT_MAX) return 0;
    size_t cap = 4 * ((len + 2) / 3) + 1;
    char *buf = fl_malloc(cap);
    if (!buf) return 0;
    int n = EVP_EncodeBlock((unsigned char *)buf, src, (int)len);
    if (n < 0) { free(buf); return 0; }
    while (n && buf[n - 1] == '=') n--;
    for (int i = 0; i < n; i++) {
        if (buf[i] == '+') buf[i] = '-';
        else if (buf[i] == '/') buf[i] = '_';
    }
    buf[n] = '\0'; *out = buf; *out_len = (size_t)n; return 1;
}

static int jwt_b64url_decode(const char *src, size_t len, unsigned char **out, size_t *out_len) {
    if (!src || !len || len % 4 == 1 || len > 131072) return 0;
    size_t padded_len = (len + 3) & ~(size_t)3;
    char *padded = fl_malloc(padded_len + 1);
    unsigned char *decoded = fl_malloc(padded_len / 4 * 3 + 1);
    if (!padded || !decoded) { free(padded); free(decoded); return 0; }
    for (size_t i = 0; i < len; i++) {
        unsigned char c = (unsigned char)src[i];
        if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
              (c >= '0' && c <= '9') || c == '-' || c == '_')) {
            free(padded); free(decoded); return 0;
        }
        padded[i] = c == '-' ? '+' : c == '_' ? '/' : (char)c;
    }
    for (size_t i = len; i < padded_len; i++) padded[i] = '=';
    padded[padded_len] = '\0';
    int n = EVP_DecodeBlock(decoded, (unsigned char *)padded, (int)padded_len);
    free(padded);
    if (n < 0) { free(decoded); return 0; }
    size_t actual = (size_t)n - (padded_len - len);
    char *canonical = NULL; size_t canonical_len = 0;
    int ok = jwt_b64url_encode(decoded, actual, &canonical, &canonical_len) &&
             canonical_len == len && CRYPTO_memcmp(canonical, src, len) == 0;
    free(canonical);
    if (!ok) { free(decoded); return 0; }
    *out = decoded; *out_len = actual; return 1;
}

static int jwt_json_string(const char **pp) {
    const unsigned char *p = (const unsigned char *)*pp;
    if (*p++ != '"') return 0;
    while (*p && *p != '"') {
        if (*p < 0x20) return 0;
        if (*p++ == '\\') {
            if (!*p) return 0;
            if (*p == 'u') {
                if (strlen((const char *)p) < 5) return 0;
                for (int i = 1; i <= 4; i++) if (!isxdigit(p[i])) return 0;
                p += 5;
            } else if (strchr("\\\"/bfnrt", *p)) p++;
            else return 0;
        }
    }
    if (*p != '"') return 0;
    *pp = (const char *)p + 1; return 1;
}

static void jwt_json_ws(const char **p) { while (**p == ' ' || **p == '\t' || **p == '\r' || **p == '\n') (*p)++; }
static int jwt_json_value(const char **p, int depth);

static int jwt_json_number(const char **pp) {
    const char *p = *pp;
    if (*p == '-') p++;
    if (*p == '0') p++;
    else {
        if (*p < '1' || *p > '9') return 0;
        while (*p >= '0' && *p <= '9') p++;
    }
    if (*p == '.') { p++; if (*p < '0' || *p > '9') return 0; while (*p >= '0' && *p <= '9') p++; }
    if (*p == 'e' || *p == 'E') { p++; if (*p == '+' || *p == '-') p++; if (*p < '0' || *p > '9') return 0; while (*p >= '0' && *p <= '9') p++; }
    *pp = p; return 1;
}

static int jwt_json_value(const char **pp, int depth) {
    if (depth > 32) return 0;
    const char *p = *pp; jwt_json_ws(&p);
    if (*p == '"') { if (!jwt_json_string(&p)) return 0; *pp = p; return 1; }
    if (*p == '{') {
        p++; jwt_json_ws(&p); if (*p == '}') { *pp = p + 1; return 1; }
        for (;;) {
            if (*p != '"' || !jwt_json_string(&p)) return 0;
            jwt_json_ws(&p); if (*p++ != ':') return 0;
            if (!jwt_json_value(&p, depth + 1)) return 0;
            jwt_json_ws(&p); if (*p == '}') { *pp = p + 1; return 1; }
            if (*p++ != ',') return 0; jwt_json_ws(&p);
        }
    }
    if (*p == '[') {
        p++; jwt_json_ws(&p); if (*p == ']') { *pp = p + 1; return 1; }
        for (;;) {
            if (!jwt_json_value(&p, depth + 1)) return 0;
            jwt_json_ws(&p); if (*p == ']') { *pp = p + 1; return 1; }
            if (*p++ != ',') return 0; jwt_json_ws(&p);
        }
    }
    if (*p == '-' || (*p >= '0' && *p <= '9')) { if (!jwt_json_number(&p)) return 0; *pp = p; return 1; }
    if (!strncmp(p, "true", 4)) p += 4;
    else if (!strncmp(p, "false", 5)) p += 5;
    else if (!strncmp(p, "null", 4)) p += 4;
    else return 0;
    *pp = p; return 1;
}

static FLValue jwt_parse_object(const unsigned char *src, size_t len) {
    if (!src || !len || len > 65500 || memchr(src, 0, len)) return fl_nil();
    char *json = fl_malloc(len + 1); if (!json) return fl_nil();
    memcpy(json, src, len); json[len] = '\0';
    const char *p = json; jwt_json_ws(&p);
    int valid = *p == '{' && jwt_json_value(&p, 0);
    jwt_json_ws(&p); valid = valid && *p == '\0';
    FLValue result = valid ? fl_json_parse(fl_str_val(json)) : fl_nil();
    free(json);
    return result.tag == FL_MAP ? result : fl_nil();
}

typedef struct { char *parts[3]; size_t lengths[3]; const char *signing; size_t signing_len; } JwtParts;
static int jwt_parts(const char *token, JwtParts *parts) {
    if (!token || strlen(token) > 131072) return 0;
    const char *a = strchr(token, '.'); if (!a) return 0;
    const char *b = strchr(a + 1, '.'); if (!b || strchr(b + 1, '.')) return 0;
    if (a == token || b == a + 1 || !b[1]) return 0;
    const char *start[3] = { token, a + 1, b + 1 };
    const size_t lens[3] = { (size_t)(a-token), (size_t)(b-a-1), strlen(b+1) };
    for (int i = 0; i < 3; i++) {
        parts->parts[i] = NULL; parts->lengths[i] = lens[i];
        if (!jwt_b64url_decode(start[i], lens[i], (unsigned char **)&parts->parts[i], &parts->lengths[i])) {
            for (int j=0;j<i;j++) free(parts->parts[j]); return 0;
        }
    }
    parts->signing = token; parts->signing_len = (size_t)(b-token); return 1;
}
static void jwt_parts_free(JwtParts *p) { for (int i=0;i<3;i++) free(p->parts[i]); }

static int jwt_hmac(const char *key, size_t key_len, const char *message, size_t message_len, unsigned char out[32]) {
    unsigned int out_len = 0;
    return key_len <= INT_MAX && message_len <= INT_MAX &&
        HMAC(EVP_sha256(), key, (int)key_len, (const unsigned char *)message, message_len, out, &out_len) && out_len == 32;
}

static int jwt_header_hs256(const char *json, size_t len) {
    if (!json || memchr(json, 0, len)) return 0;
    char *copy = fl_malloc(len + 1); if (!copy) return 0;
    memcpy(copy, json, len); copy[len] = 0;
    FLValue header = jwt_parse_object((const unsigned char *)copy, len);
    int count = 0; const char *p = copy;
    while ((p = strstr(p, "\"alg\"")) != NULL) { count++; p += 5; }
    FLValue alg = header.tag == FL_MAP ? fl_map_get(header, fl_str_val("alg")) : fl_nil();
    int ok = count == 1 && alg.tag == FL_STRING && !strcmp(((FLString *)alg.obj)->data, "HS256");
    free(copy); return ok;
}

static int jwt_claim_times(FLValue payload, int64_t now, int skew) {
    const char *names[] = { "exp", "nbf" };
    for (int i=0; i<2; i++) {
        FLValue v = fl_map_get(payload, fl_str_val(names[i]));
        if (v.tag == FL_NIL) {
            if (i == 0) return 0;
            continue;
        }
        double t;
        if (v.tag == FL_INT) t = (double)v.i;
        else if (v.tag == FL_FLOAT && isfinite(v.f)) t = v.f;
        else return 0;
        if (i == 0 && t < 0) return 0;
        if (i == 0 && (double)now > t + skew) return 0;
        if (i == 1 && (double)now + skew < t) return 0;
    }
    return 1;
}

FLValue fl_jwt_sign(FLValue payload_value, FLValue secret_value, FLValue expiry_value) {
    if (payload_value.tag != FL_MAP || secret_value.tag != FL_STRING || !secret_value.obj) return fl_nil();
    FLString *key = (FLString *)secret_value.obj;
    if (key->len < 32 || key->len > 4096) return fl_nil();
    int64_t ttl = expiry_value.tag == FL_INT ? expiry_value.i : 3600;
    if (ttl <= 0 || ttl > 315360000) return fl_nil();
    int64_t now = (int64_t)time(NULL);
    FLValue payload = payload_value;
    if (fl_map_get(payload, fl_str_val("iat")).tag == FL_NIL)
        payload = fl_map_set(payload, fl_str_val("iat"), fl_int(now));
    if (fl_map_get(payload, fl_str_val("exp")).tag == FL_NIL)
        payload = fl_map_set(payload, fl_str_val("exp"), fl_int(now + ttl));
    FLValue json_value = fl_json_stringify(payload);
    FLString *json = (FLString *)json_value.obj;
    if (json_value.tag != FL_STRING || json->len >= 65000) return fl_nil();
    FLValue checked = jwt_parse_object((unsigned char *)json->data, json->len);
    if (checked.tag != FL_MAP) return fl_nil();
    const char *header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    char *h64 = NULL, *p64 = NULL; size_t hl=0, pl=0;
    if (!jwt_b64url_encode((unsigned char *)header, strlen(header), &h64, &hl) ||
        !jwt_b64url_encode((unsigned char *)json->data, json->len, &p64, &pl)) { free(h64); free(p64); return fl_nil(); }
    size_t input_len = hl + 1 + pl;
    char *input = fl_malloc(input_len + 1);
    if (!input) { free(h64); free(p64); return fl_nil(); }
    memcpy(input,h64,hl); input[hl]='.'; memcpy(input+hl+1,p64,pl); input[input_len]=0;
    unsigned char mac[32]; char *sig=NULL; size_t sl=0;
    int ok = jwt_hmac(key->data,key->len,input,input_len,mac) && jwt_b64url_encode(mac,sizeof(mac),&sig,&sl);
    FLValue result = fl_nil();
    if (ok) { char *token=fl_malloc(hl+pl+sl+3); if(token) { snprintf(token,hl+pl+sl+3,"%s.%s.%s",h64,p64,sig); result=fl_str_val(token); free(token); } }
    OPENSSL_cleanse(mac,sizeof(mac)); free(h64);free(p64);free(sig);free(input); return result;
}

FLValue fl_jwt_verify(FLValue token_value, FLValue secret_value) {
    if (token_value.tag != FL_STRING || !token_value.obj || secret_value.tag != FL_STRING || !secret_value.obj) return fl_nil();
    FLString *key=(FLString *)secret_value.obj; if(key->len<32 || key->len>4096) return fl_nil();
    JwtParts p={0}; if(!jwt_parts(((FLString *)token_value.obj)->data,&p)) return fl_nil();
    FLValue result=fl_nil(); unsigned char expected[32];
    if (jwt_header_hs256(p.parts[0],p.lengths[0]) && jwt_hmac(key->data,key->len,p.signing,p.signing_len,expected) &&
        p.lengths[2]==sizeof(expected) && CRYPTO_memcmp(expected,p.parts[2],sizeof(expected))==0) {
        FLValue payload=jwt_parse_object((unsigned char *)p.parts[1],p.lengths[1]);
        if(payload.tag==FL_MAP && jwt_claim_times(payload,(int64_t)time(NULL),60)) result=payload;
    }
    OPENSSL_cleanse(expected,sizeof(expected)); jwt_parts_free(&p); return result;
}

/* Unverified payload only: never use this result to make authentication decisions. */
FLValue fl_jwt_decode(FLValue token_value) {
    if(token_value.tag!=FL_STRING || !token_value.obj) return fl_nil();
    JwtParts p={0}; if(!jwt_parts(((FLString *)token_value.obj)->data,&p)) return fl_nil();
    FLValue result=jwt_parse_object((unsigned char *)p.parts[1],p.lengths[1]); jwt_parts_free(&p); return result;
}

FLValue fl_jwt_expired(FLValue token_value) {
    FLValue payload=fl_jwt_decode(token_value); if(payload.tag!=FL_MAP) return fl_bool(true);
    FLValue exp=fl_map_get(payload,fl_str_val("exp"));
    if(exp.tag==FL_NIL) return fl_bool(false);
    if(exp.tag==FL_INT) return fl_bool((double)exp.i<(double)time(NULL));
    if(exp.tag==FL_FLOAT && isfinite(exp.f)) return fl_bool(exp.f<(double)time(NULL));
    return fl_bool(true);
}
