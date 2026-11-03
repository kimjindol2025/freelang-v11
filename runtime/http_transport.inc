/* Keep socket ownership native and deliver complete chunk frames to optional callbacks. */
#include <poll.h>
#include <fcntl.h>
#include <time.h>
#include <netinet/in.h>
#include <openssl/ssl.h>
#include <openssl/err.h>
#include <openssl/x509v3.h>

static int64_t transport_now(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}
static FLValue transport_error(const char *code, const char *message) {
    FLValue e = fl_map_new();
    e = fl_map_set(e, fl_str_val("code"), fl_str_val(code));
    e = fl_map_set(e, fl_str_val("message"), fl_str_val(message));
    FLValue r = fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(false));
    return fl_map_set(r, fl_str_val("error"), e);
}
static int transport_wait(int fd, short events, int64_t deadline) {
    for (;;) {
        int64_t left = deadline - transport_now();
        if (left <= 0) return 0;
        struct pollfd p = {fd, events, 0};
        int n = poll(&p, 1, (int)left);
        if (n < 0 && errno == EINTR) continue;
        return n;
    }
}
typedef struct { size_t cursor; int headers, chunked, stopped; } FLHTTPStreamState;
static const char *transport_find(const char *s, size_t n, const char *needle, size_t m) {
    if (m > n) return NULL;
    for (size_t i = 0; i <= n - m; i++) if (!memcmp(s + i, needle, m)) return s + i;
    return NULL;
}
static void transport_stream_available(char *buffer, size_t used, FLHTTPStreamState *state, FLValue callback) {
    if (callback.tag != FL_FN) return;
    if (!state->headers) {
        const char *end = transport_find(buffer, used, "\r\n\r\n", 4);
        if (!end || (size_t)(end - buffer) > 65536) return;
        state->headers = 1; state->cursor = (size_t)(end - buffer) + 4;
        const char *line = transport_find(buffer, state->cursor - 2, "\r\n", 2);
        if (!line) return;
        line += 2;
        while (line < end) {
            const char *line_end = transport_find(line, (size_t)(end - line), "\r\n", 2);
            if (!line_end) return;
            const char *colon = memchr(line, ':', (size_t)(line_end - line));
            if (colon && (size_t)(colon - line) == 17 && !strncasecmp(line, "transfer-encoding", 17)) {
                const char *value = colon + 1;
                while (value < line_end && (*value == ' ' || *value == '\t')) value++;
                const char *value_end = line_end;
                while (value_end > value && (value_end[-1] == ' ' || value_end[-1] == '\t')) value_end--;
                state->chunked = (size_t)(value_end - value) == 7 && !strncasecmp(value, "chunked", 7);
            }
            line = line_end + 2;
        }
    }
    if (!state->headers || !state->chunked || state->stopped) return;
    while (state->cursor < used) {
        const char *line_end = transport_find(buffer + state->cursor, used - state->cursor, "\r\n", 2);
        if (!line_end || line_end == buffer + state->cursor || (size_t)(line_end - (buffer + state->cursor)) > 16) return;
        size_t line_len = (size_t)(line_end - (buffer + state->cursor)), chunk_size = 0;
        for (size_t i = 0; i < line_len; i++) {
            unsigned char c = (unsigned char)buffer[state->cursor + i]; unsigned digit;
            if (c >= '0' && c <= '9') digit = c - '0';
            else if (c >= 'a' && c <= 'f') digit = c - 'a' + 10;
            else if (c >= 'A' && c <= 'F') digit = c - 'A' + 10;
            else { state->stopped = 1; return; }
            if (chunk_size > (2097152u - digit) / 16u) { state->stopped = 1; return; }
            chunk_size = chunk_size * 16u + digit;
        }
        size_t data = state->cursor + line_len + 2;
        if (!chunk_size) {
            size_t pos = data;
            for (;;) {
                const char *trailer_end = transport_find(buffer + pos, used - pos, "\r\n", 2);
                if (!trailer_end) return;
                if (trailer_end == buffer + pos) { state->stopped = 1; return; }
                if (!memchr(buffer + pos, ':', (size_t)(trailer_end - (buffer + pos)))) { state->stopped = 1; return; }
                pos = (size_t)(trailer_end - buffer) + 2;
            }
        }
        if (chunk_size > used - data || used - data - chunk_size < 2) return;
        if (buffer[data + chunk_size] != '\r' || buffer[data + chunk_size + 1] != '\n' || memchr(buffer + data, 0, chunk_size)) {
            state->stopped = 1; return;
        }
        char *text = fl_malloc(chunk_size + 1);
        if (!text) { state->stopped = 1; return; }
        memcpy(text, buffer + data, chunk_size); text[chunk_size] = '\0';
        FLValue part = fl_str_val(text); free(text);
        if (!fl_truthy(fl_fn_call(callback, 1, &part))) { state->stopped = 1; return; }
        state->cursor = data + chunk_size + 2;
    }
}
/* Return true when an HTTP response with an explicit body length is complete. */
static int transport_content_length_complete(const char *buffer, size_t used, const FLString *request) {
    const char *end = transport_find(buffer, used, "\r\n\r\n", 4);
    if (!end) return 0;
    size_t body_start = (size_t)(end - buffer) + 4;
    if (request->len >= 5 && !strncasecmp(request->data, "HEAD ", 5)) return 1;
    const char *line_end = transport_find(buffer, body_start - 2, "\r\n", 2);
    if (!line_end) return 0;
    const char *line = line_end + 2;
    if ((size_t)(line_end - buffer) >= 12 && !memcmp(buffer, "HTTP/", 5)) {
        const char *space = memchr(buffer, ' ', (size_t)(line_end - buffer));
        if (space && (size_t)(line_end - space) >= 4) {
            int status = (space[1] - '0') * 100 + (space[2] - '0') * 10 + (space[3] - '0');
            if ((status >= 100 && status < 200) || status == 204 || status == 304) return 1;
        }
    }
    size_t content_length = 0;
    int found = 0;
    const char *header_stop = end + 2;
    while (line < header_stop) {
        line_end = transport_find(line, (size_t)(header_stop - line), "\r\n", 2);
        if (!line_end) return 0;
        const char *colon = memchr(line, ':', (size_t)(line_end - line));
        if (colon && (size_t)(colon - line) == 14 && !strncasecmp(line, "content-length", 14)) {
            const char *value = colon + 1;
            while (value < line_end && (*value == ' ' || *value == '\t')) value++;
            if (value == line_end) return 0;
            size_t parsed = 0;
            for (; value < line_end; value++) {
                if (*value < '0' || *value > '9' || parsed > (SIZE_MAX - (size_t)(*value - '0')) / 10) return 0;
                parsed = parsed * 10 + (size_t)(*value - '0');
            }
            if (found && parsed != content_length) return 0;
            content_length = parsed;
            found = 1;
        }
        line = line_end + 2;
    }
    return found && content_length <= SIZE_MAX - body_start && used >= body_start + content_length;
}
/* Custom socket BIO preserves MSG_NOSIGNAL without changing process signal policy. */
static int transport_bio_create(BIO *b) { BIO_set_init(b, 1); return 1; }
static int transport_bio_destroy(BIO *b) { (void)b; return 1; }
static long transport_bio_ctrl(BIO *b, int cmd, long n, void *p) {
    (void)b; (void)n; (void)p; return cmd == BIO_CTRL_FLUSH ? 1 : 0;
}
static int transport_bio_read(BIO *b, char *out, int size) {
    BIO_clear_retry_flags(b);
    int n = (int)recv((int)(intptr_t)BIO_get_data(b), out, (size_t)size, 0);
    if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) BIO_set_retry_read(b);
    return n;
}
static int transport_bio_write(BIO *b, const char *in, int size) {
    BIO_clear_retry_flags(b);
    int n = (int)send((int)(intptr_t)BIO_get_data(b), in, (size_t)size, MSG_NOSIGNAL);
    if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) BIO_set_retry_write(b);
    return n;
}
/* Return 1 to retry, 0 for deadline, -1 for a TLS failure. */
static int transport_tls_wait(SSL *ssl, int result, int fd, int64_t deadline) {
    int error = SSL_get_error(ssl, result);
    if (error != SSL_ERROR_WANT_READ && error != SSL_ERROR_WANT_WRITE) return -1;
    return transport_wait(fd, error == SSL_ERROR_WANT_READ ? POLLIN : POLLOUT, deadline);
}
static void transport_close(int fd, SSL *ssl, SSL_CTX *ctx, BIO_METHOD *method) {
    /* Keep connection teardown nonblocking after HTTP framing is complete. */
    SSL_free(ssl); SSL_CTX_free(ctx); BIO_meth_free(method); close(fd);
}

static FLValue transport_exchange(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit, FLValue callback, int tls) {
    if (host.tag != FL_STRING || wire.tag != FL_STRING || port.tag != FL_INT ||
        timeout.tag != FL_INT || limit.tag != FL_INT || port.i < 1 || port.i > 65535 ||
        timeout.i < 1 || timeout.i > 60000 || limit.i < 1 || limit.i > 16777216 ||
        (callback.tag != FL_NIL && callback.tag != FL_FN))
        return transport_error("INVALID_OPTIONS", "invalid transport arguments");
    int capability = fl_cap_find("http");
    if (capability < 0 || !fl_caps[capability].enabled)
        return transport_error("CAPABILITY_DENIED", "HTTP capability is disabled");
    int64_t deadline = transport_now() + timeout.i;
    /* Bound DNS with the same deadline, including cancellation and child reaping. */
    int channel[2];
    if (pipe(channel)) return transport_error("DNS", "resolver pipe failed");
    pid_t child = fork();
    if (child == 0) {
        close(channel[0]);
        struct addrinfo hints = {0}, *addresses = NULL;
        hints.ai_family = AF_INET; hints.ai_socktype = SOCK_STREAM;
        if (!getaddrinfo(fl_cstr(host), NULL, &hints, &addresses)) {
            struct in_addr address = ((struct sockaddr_in *)addresses->ai_addr)->sin_addr;
            (void)write(channel[1], &address, sizeof(address));
            freeaddrinfo(addresses);
        }
        close(channel[1]); _exit(0);
    }
    close(channel[1]);
    if (child < 0) { close(channel[0]); return transport_error("DNS", "resolver fork failed"); }
    struct sockaddr_in address = {0};
    address.sin_family = AF_INET; address.sin_port = htons((uint16_t)port.i);
    int ready = transport_wait(channel[0], POLLIN, deadline);
    ssize_t count = ready > 0 ? read(channel[0], &address.sin_addr, sizeof(address.sin_addr)) : -1;
    close(channel[0]);
    if (ready <= 0) kill(child, SIGKILL);
    while (waitpid(child, NULL, 0) < 0 && errno == EINTR) {}
    if (ready == 0) return transport_error("TIMEOUT", "DNS deadline exceeded");
    if (count != sizeof(address.sin_addr)) return transport_error("DNS", "name resolution failed");
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return transport_error("CONNECT", "socket failed");
    if (fcntl(fd, F_SETFL, O_NONBLOCK) < 0) {
        close(fd); return transport_error("CONNECT", "nonblocking socket failed");
    }
    int connected = connect(fd, (struct sockaddr *)&address, sizeof(address));
    if (connected < 0 && errno != EINPROGRESS) {
        close(fd); return transport_error("CONNECT", "connection refused");
    }
    if (connected < 0) {
        ready = transport_wait(fd, POLLOUT, deadline);
        int error = 0; socklen_t size = sizeof(error);
        if (ready <= 0 || getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &size) || error) {
            close(fd); return transport_error(ready == 0 ? "TIMEOUT" : "CONNECT", "connection failed");
        }
    }
    SSL_CTX *ctx = NULL;
    SSL *ssl = NULL;
    BIO_METHOD *method = NULL;
#define TRANSPORT_FAIL(code, message) do { transport_close(fd, ssl, ctx, method); return transport_error(code, message); } while (0)
    if (tls) {
        ctx = SSL_CTX_new(TLS_client_method());
        if (!ctx) TRANSPORT_FAIL("TLS", "TLS context failed");
        SSL_CTX_set_verify(ctx, SSL_VERIFY_PEER, NULL);
        if (!SSL_CTX_set_default_verify_paths(ctx)) TRANSPORT_FAIL("TLS", "trust store unavailable");
        ssl = SSL_new(ctx);
        if (!ssl) TRANSPORT_FAIL("TLS", "TLS allocation failed");
        X509_VERIFY_PARAM *param = SSL_get0_param(ssl);
        X509_VERIFY_PARAM_set_hostflags(param, X509_CHECK_FLAG_NO_PARTIAL_WILDCARDS);
        struct in_addr ip;
        if (inet_pton(AF_INET, fl_cstr(host), &ip) == 1) {
            if (!X509_VERIFY_PARAM_set1_ip_asc(param, fl_cstr(host))) TRANSPORT_FAIL("TLS", "IP verification setup failed");
        } else {
            if (!SSL_set1_host(ssl, fl_cstr(host)) || !SSL_set_tlsext_host_name(ssl, fl_cstr(host)))
                TRANSPORT_FAIL("TLS", "hostname verification setup failed");
        }
        method = BIO_meth_new(BIO_TYPE_SOURCE_SINK, "FreeLang nonblocking socket");
        if (!method || !BIO_meth_set_create(method, transport_bio_create) ||
            !BIO_meth_set_destroy(method, transport_bio_destroy) ||
            !BIO_meth_set_read(method, transport_bio_read) ||
            !BIO_meth_set_write(method, transport_bio_write) ||
            !BIO_meth_set_ctrl(method, transport_bio_ctrl)) TRANSPORT_FAIL("TLS", "TLS socket setup failed");
        BIO *bio = BIO_new(method);
        if (!bio) TRANSPORT_FAIL("TLS", "TLS socket allocation failed");
        BIO_set_data(bio, (void *)(intptr_t)fd);
        SSL_set_bio(ssl, bio, bio);
        for (;;) {
            if (transport_now() >= deadline) TRANSPORT_FAIL("TIMEOUT", "TLS handshake deadline exceeded");
            ERR_clear_error();
            int n = SSL_connect(ssl);
            if (n == 1) break;
            int retry = transport_tls_wait(ssl, n, fd, deadline);
            if (retry <= 0) TRANSPORT_FAIL(retry == 0 ? "TIMEOUT" : "TLS", "TLS handshake or certificate verification failed");
        }
        if (SSL_get_verify_result(ssl) != X509_V_OK) TRANSPORT_FAIL("TLS", "certificate verification failed");
    }
    FLString *request = (FLString *)wire.obj;
    size_t sent = 0;
    while (sent < request->len) {
        if (transport_now() >= deadline) TRANSPORT_FAIL("TIMEOUT", "send deadline exceeded");
        ssize_t n;
        if (tls) {
            ERR_clear_error();
            n = SSL_write(ssl, request->data + sent, (int)(request->len - sent));
            if (n <= 0) {
                int retry = transport_tls_wait(ssl, (int)n, fd, deadline);
                if (retry > 0) continue;
                TRANSPORT_FAIL(retry == 0 ? "TIMEOUT" : "TLS", "TLS send failed");
            }
        } else {
            ready = transport_wait(fd, POLLOUT, deadline);
            if (ready <= 0) TRANSPORT_FAIL(ready == 0 ? "TIMEOUT" : "IO", "send failed");
            n = send(fd, request->data + sent, request->len - sent, MSG_NOSIGNAL);
            if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
            if (n <= 0) TRANSPORT_FAIL("IO", "send failed");
        }
        sent += (size_t)n;
    }
    char *buffer = fl_malloc((size_t)limit.i + 2);
    if (!buffer) TRANSPORT_FAIL("IO", "allocation failed");
    size_t used = 0;
    FLHTTPStreamState stream = {0};
    for (;;) {
        if (transport_now() >= deadline) { free(buffer); TRANSPORT_FAIL("TIMEOUT", "receive deadline exceeded"); }
        ssize_t n;
        if (tls) {
            ERR_clear_error();
            n = SSL_read(ssl, buffer + used, (int)((size_t)limit.i + 1 - used));
            if (n <= 0) {
                if (SSL_get_error(ssl, (int)n) == SSL_ERROR_ZERO_RETURN) break;
                int retry = transport_tls_wait(ssl, (int)n, fd, deadline);
                if (retry > 0) continue;
                free(buffer); TRANSPORT_FAIL(retry == 0 ? "TIMEOUT" : "TLS", "TLS receive failed");
            }
        } else {
            ready = transport_wait(fd, POLLIN, deadline);
            if (ready <= 0) { free(buffer); TRANSPORT_FAIL(ready == 0 ? "TIMEOUT" : "IO", "receive failed"); }
            n = recv(fd, buffer + used, (size_t)limit.i + 1 - used, 0);
            if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
            if (n < 0) { free(buffer); TRANSPORT_FAIL("IO", "receive failed"); }
            if (!n) break;
        }
        used += (size_t)n;
        if (used > (size_t)limit.i) { free(buffer); TRANSPORT_FAIL("RESPONSE_TOO_LARGE", "response byte limit exceeded"); }
        buffer[used] = '\0';
        transport_stream_available(buffer, used, &stream, callback);
        if (transport_content_length_complete(buffer, used, request)) break;
    }
    transport_close(fd, ssl, ctx, method);
#undef TRANSPORT_FAIL
    if (memchr(buffer, 0, used)) { free(buffer); return transport_error("HTTP_BINARY", "binary response unsupported"); }
    buffer[used] = 0;
    if (callback.tag == FL_FN && !stream.headers) transport_stream_available(buffer, used, &stream, callback);
    if (callback.tag == FL_FN && stream.headers && !stream.chunked && !stream.stopped) {
        const char *body = strstr(buffer, "\r\n\r\n");
        if (body && body[4]) {
            FLValue part = fl_str_val(body + 4);
            (void)fl_fn_call(callback, 1, &part);
        }
    }
    FLValue result = fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(true));
    result = fl_map_set(result, fl_str_val("value"), fl_str_val(buffer));
    free(buffer);
    return result;
}
FLValue _fl_http_exchange(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit) {
    return _fl_http_exchange_stream(host, port, wire, timeout, limit, fl_nil());
}
FLValue _fl_http_exchange_stream(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit, FLValue callback) {
    return transport_exchange(host, port, wire, timeout, limit, callback, 0);
}
FLValue _fl_https_exchange(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit) {
    return transport_exchange(host, port, wire, timeout, limit, fl_nil(), 1);
}
