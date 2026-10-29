#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

static int passed, total;

static long long now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static int connect_local(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;
    struct timeval timeout = { .tv_sec = 4, .tv_usec = 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    struct sockaddr_in address = { .sin_family = AF_INET, .sin_port = htons((unsigned short)port) };
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(fd, (struct sockaddr *)&address, sizeof(address)) != 0) { close(fd); return -1; }
    return fd;
}

static int send_all(int fd, const void *data, size_t length) {
    const char *p = data;
    while (length) {
        ssize_t n = send(fd, p, length, MSG_NOSIGNAL);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return 0;
        p += n;
        length -= (size_t)n;
    }
    return 1;
}

static int read_response(int fd, int *closed, char *buffer, size_t capacity, long long *elapsed) {
    size_t used = 0;
    char chunk[1024];
    long long start = now_ms();
    *closed = 0;
    while (used + 1 < capacity) {
        ssize_t n = recv(fd, chunk, sizeof(chunk), 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) { *closed = 1; break; }
        size_t take = (size_t)n < capacity - used - 1 ? (size_t)n : capacity - used - 1;
        memcpy(buffer + used, chunk, take);
        used += take;
    }
    buffer[used] = '\0';
    if (elapsed) *elapsed = now_ms() - start;
    int status = 0;
    (void)sscanf(buffer, "HTTP/1.1 %d", &status);
    return status;
}

static int record_case(const char *name, int status, int closed, int expected,
                       long long ms, int extra_ok) {
    int ok = status == expected && closed && extra_ok;
    total++;
    passed += ok;
    printf("CASE=%s STATUS=%d CLOSED=%d MS=%lld RESULT=%s\n",
           name, status, closed, ms, ok ? "PASS" : "FAIL");
    return ok;
}

static int request_case(int port, const char *name, const void *request, size_t length,
                        int expected, int shutdown_write) {
    int fd = connect_local(port);
    if (fd < 0) return record_case(name, 0, 0, expected, -1, 0);
    long long start = now_ms();
    (void)send_all(fd, request, length);
    if (shutdown_write) shutdown(fd, SHUT_WR);
    char response[8192]; int closed; long long elapsed;
    int status = read_response(fd, &closed, response, sizeof(response), &elapsed);
    close(fd);
    return record_case(name, status, closed, expected, now_ms() - start, 1);
}

static char *repeat_request(const char *prefix, size_t repeated, const char *suffix,
                            size_t *length) {
    size_t a = strlen(prefix), b = strlen(suffix);
    char *text = malloc(a + repeated + b + 1);
    if (!text) return NULL;
    memcpy(text, prefix, a);
    memset(text + a, 'A', repeated);
    memcpy(text + a + repeated, suffix, b);
    text[a + repeated + b] = '\0';
    *length = a + repeated + b;
    return text;
}

static int slow_request_case(int port, const char *name, int body) {
    int fd = connect_local(port);
    if (fd < 0) return record_case(name, 0, 0, 408, -1, 0);
    const char *partial = body ? "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 3\r\n\r\na" : "G";
    long long start = now_ms();
    (void)send_all(fd, partial, strlen(partial));
    struct timespec pause = { .tv_sec = 0, .tv_nsec = 700000000 };
    nanosleep(&pause, NULL);
    char response[8192]; int closed; long long elapsed;
    int status = read_response(fd, &closed, response, sizeof(response), &elapsed);
    close(fd);
    return record_case(name, status, closed, 408, now_ms() - start, 1);
}

int main(int argc, char **argv) {
    if (argc != 2) return 2;
    int port = atoi(argv[1]);
    size_t length = 0;
    char *request = repeat_request("GET /", 1024 * 1024,
        " HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n", &length);
    if (!request) return 2;
    request_case(port, "request-line-1m", request, length, 431, 0);
    free(request);
    request = repeat_request("GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Large: ", 1024 * 1024,
        "\r\n\r\n", &length);
    if (!request) return 2;
    request_case(port, "header-value-1m", request, length, 431, 0);
    free(request);

    size_t many_cap = 50000, many_used = 0;
    char *many = malloc(many_cap);
    if (!many) return 2;
    many_used += (size_t)snprintf(many + many_used, many_cap - many_used, "GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\n");
    for (int i = 0; i < 3000; i++) many_used += (size_t)snprintf(many + many_used, many_cap - many_used, "X-%d: a\r\n", i);
    memcpy(many + many_used, "\r\n", 3);
    request_case(port, "header-count-3000", many, many_used + 2, 431, 0);
    free(many);

    const char *bad_line = "G E T /ok HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    const char *bad_version = "GET /ok FTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    const char *negative_cl = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: -1\r\n\r\n";
    const char *text_cl = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: nope\r\n\r\n";
    const char *duplicate_cl = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 1\r\nContent-Length: 1\r\n\r\nx";
    const char *short_body = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 8\r\n\r\nabc";
    const char *long_body = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 1\r\n\r\nabc";
    const char *large_body = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 1048577\r\n\r\n";
    const char *chunked = "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\n\r\nZ\r\n";
    request_case(port, "malformed-request-line", bad_line, strlen(bad_line), 400, 1);
    request_case(port, "bad-http-version", bad_version, strlen(bad_version), 400, 1);
    request_case(port, "negative-content-length", negative_cl, strlen(negative_cl), 400, 1);
    request_case(port, "nonnumeric-content-length", text_cl, strlen(text_cl), 400, 1);
    request_case(port, "duplicate-content-length", duplicate_cl, strlen(duplicate_cl), 400, 1);
    request_case(port, "truncated-body", short_body, strlen(short_body), 400, 1);
    request_case(port, "excess-body", long_body, strlen(long_body), 400, 0);
    request_case(port, "body-over-limit", large_body, strlen(large_body), 413, 1);
    request_case(port, "invalid-chunked", chunked, strlen(chunked), 400, 1);

    const char *traversal[] = {
        "GET /../private HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
        "GET /%2e%2e/private HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
        "GET /%252e%252e/private HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"
    };
    const char *traversal_names[] = { "path-dotdot", "path-encoded-dotdot", "path-double-encoded-dotdot" };
    char response[8192]; long long elapsed;
    for (size_t i = 0; i < 3; i++)
        request_case(port, traversal_names[i], traversal[i], strlen(traversal[i]), 404, 1);
    const char nul_path[] = "GET /ok\0/../private HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    request_case(port, "path-nul", nul_path, sizeof(nul_path) - 1, 400, 1);
    slow_request_case(port, "slow-one-byte", 0);
    slow_request_case(port, "slow-body-byte", 1);

    int idle[50], idle_ok = 1;
    for (int i = 0; i < 50; i++) {
        idle[i] = connect_local(port);
        if (idle[i] < 0) { idle_ok = 0; for (int j = 0; j < i; j++) close(idle[j]); break; }
    }
    int healthy = connect_local(port);
    int fast_status = 0, fast_closed = 0; long long fast_ms = -1;
    if (healthy >= 0) {
        const char *fast = "GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
        long long start = now_ms();
        (void)send_all(healthy, fast, strlen(fast)); shutdown(healthy, SHUT_WR);
        fast_status = read_response(healthy, &fast_closed, response, sizeof(response), &elapsed);
        fast_ms = now_ms() - start;
        close(healthy);
    }
    record_case("50-idle-do-not-block-health", fast_status, fast_closed, 200, fast_ms, idle_ok);
    struct timespec settle = { .tv_sec = 0, .tv_nsec = 700000000 };
    nanosleep(&settle, NULL);
    int idle_closed = 0;
    if (idle_ok) for (int i = 0; i < 50; i++) {
        int closed_idle = 0; long long ignored;
        int status = read_response(idle[i], &closed_idle, response, sizeof(response), &ignored);
        if (closed_idle && (status == 408 || status == 0)) idle_closed++;
        close(idle[i]);
    }
    total++;
    passed += idle_closed == 50;
    printf("CASE=idle-50-timeout STATUS=408 CLOSED=%d MS=700 RESULT=%s\n",
           idle_closed, idle_closed == 50 ? "PASS" : "FAIL");

    const char *health = "GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    request_case(port, "server-recovers-200", health, strlen(health), 200, 1);
    printf("HTTPATK_SUMMARY=%d/%d\n", passed, total);
    return passed == total ? 0 : 1;
}
