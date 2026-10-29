/* Keep socket ownership native and deliver complete chunk frames to optional callbacks. */
#include <poll.h>
#include <fcntl.h>
#include <time.h>
#include <netinet/in.h>

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
FLValue _fl_http_exchange_stream(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit, FLValue callback) {
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
    FLString *request = (FLString *)wire.obj;
    size_t sent = 0;
    while (sent < request->len) {
        ready = transport_wait(fd, POLLOUT, deadline);
        if (ready <= 0) { close(fd); return transport_error(ready == 0 ? "TIMEOUT" : "IO", "send failed"); }
        ssize_t n = send(fd, request->data + sent, request->len - sent, MSG_NOSIGNAL);
        if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
        if (n <= 0) { close(fd); return transport_error("IO", "send failed"); }
        sent += (size_t)n;
    }
    char *buffer = fl_malloc((size_t)limit.i + 2);
    if (!buffer) { close(fd); return transport_error("IO", "allocation failed"); }
    size_t used = 0;
    FLHTTPStreamState stream = {0};
    for (;;) {
        ready = transport_wait(fd, POLLIN, deadline);
        if (ready <= 0) { free(buffer); close(fd); return transport_error(ready == 0 ? "TIMEOUT" : "IO", "receive failed"); }
        ssize_t n = recv(fd, buffer + used, (size_t)limit.i + 1 - used, 0);
        if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
        if (n < 0) { free(buffer); close(fd); return transport_error("IO", "receive failed"); }
        if (!n) break;
        used += (size_t)n;
        if (used > (size_t)limit.i) { free(buffer); close(fd); return transport_error("RESPONSE_TOO_LARGE", "response byte limit exceeded"); }
        buffer[used] = '\0';
        transport_stream_available(buffer, used, &stream, callback);
    }
    close(fd);
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
