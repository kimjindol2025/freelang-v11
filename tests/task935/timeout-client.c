#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

static int passed, total;
static long long last_ms;

static long long now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static void pause_ms(long ms) {
    struct timespec remaining = { .tv_sec = ms / 1000, .tv_nsec = (ms % 1000) * 1000000 };
    while (nanosleep(&remaining, &remaining) != 0 && errno == EINTR) { }
}

static int send_all(int fd, const char *text) {
    size_t length = strlen(text), sent = 0;
    while (sent < length) {
        ssize_t n = send(fd, text + sent, length - sent, MSG_NOSIGNAL);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return 0;
        sent += (size_t)n;
    }
    return 1;
}

static int open_local(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;
    struct timeval timeout = { .tv_sec = 3, .tv_usec = 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    struct sockaddr_in address = { .sin_family = AF_INET, .sin_port = htons((unsigned short)port) };
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(fd, (struct sockaddr *)&address, sizeof(address)) != 0) { close(fd); return -1; }
    return fd;
}

static int receive_status(int fd) {
    char response[4096];
    size_t used = 0;
    while (used + 1 < sizeof(response)) {
        ssize_t n = recv(fd, response + used, sizeof(response) - used - 1, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) break;
        used += (size_t)n;
    }
    response[used] = '\0';
    int status = 0;
    (void)sscanf(response, "HTTP/1.1 %d", &status);
    return status;
}

static int slow_header(int port) {
    long long start = now_ms();
    int fd = open_local(port);
    if (fd < 0) { last_ms = now_ms() - start; return 0; }
    send_all(fd, "GET ");
    pause_ms(550);
    send_all(fd, "/ok ");
    pause_ms(550);
    send_all(fd, "HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
    int status = receive_status(fd);
    close(fd);
    last_ms = now_ms() - start;
    return status;
}

static int fast_health(int port) {
    long long start = now_ms();
    int fd = open_local(port);
    if (fd < 0) { last_ms = now_ms() - start; return 0; }
    send_all(fd, "GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
    int status = receive_status(fd);
    close(fd);
    last_ms = now_ms() - start;
    return status;
}

static long long timeout_request(int port, int body) {
    long long start = now_ms();
    int fd = open_local(port);
    if (fd < 0) { last_ms = now_ms() - start; return -1; }
    if (body)
        send_all(fd, "POST /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 3\r\n\r\na");
    else
        send_all(fd, "GET ");
    int status = receive_status(fd);
    close(fd);
    last_ms = now_ms() - start;
    return status;
}

static int slow_body(int port) {
    long long start = now_ms();
    int fd = open_local(port);
    if (fd < 0) { last_ms = now_ms() - start; return 0; }
    send_all(fd, "GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 3\r\n\r\na");
    pause_ms(550);
    send_all(fd, "b");
    pause_ms(550);
    send_all(fd, "c");
    int status = receive_status(fd);
    close(fd);
    last_ms = now_ms() - start;
    return status;
}

static void record(const char *name, int status, int expected) {
    int ok = status == expected;
    passed += ok;
    total++;
    printf("TIMEOUT_CASE=%s STATUS=%d EXPECTED=%d MS=%lld RESULT=%s\n",
           name, status, expected, last_ms, ok ? "PASS" : "FAIL");
}

int main(int argc, char **argv) {
    if (argc < 3 || argc > 4 || (argc == 4 && strcmp(argv[2], "precision") != 0)) return 2;
    int port = atoi(argv[1]);
    const char *mode = argv[2];
    if (strcmp(mode, "default") == 0) {
        record("default-header-500ms", slow_header(port), 408);
        record("default-body-500ms", slow_body(port), 408);
    } else if (strcmp(mode, "header-long") == 0) {
        record("configured-header-1100ms", slow_header(port), 200);
        record("body-remains-500ms", slow_body(port), 408);
    } else if (strcmp(mode, "body-long") == 0) {
        record("header-remains-500ms", slow_header(port), 408);
        record("configured-body-1100ms", slow_body(port), 200);
    } else if (strcmp(mode, "precision") == 0) {
        for (int body = 0; body <= 1; body++) {
            long long actual = timeout_request(port, body);
            long long configured = argc == 4 ? strtoll(argv[3], NULL, 10) : 0;
            int ok = actual == 408 && last_ms >= configured - 50 && last_ms <= configured + 200;
            passed += ok;
            total++;
            printf("TIMEPREC_CASE=%s CONFIG_MS=%lld ACTUAL_MS=%lld STATUS=%lld DELTA_MS=%lld RESULT=%s\n",
                   body ? "body" : "header", configured, last_ms, actual,
                   last_ms - configured, ok ? "PASS" : "FAIL");
        }
    } else {
        return 2;
    }
    if (strcmp(mode, "default") == 0) {
        record("fast-health-after-slow-header", fast_health(port), 200);
        record("fast-health-after-slow-body", fast_health(port), 200);
    }
    if (strcmp(mode, "precision") == 0) {
        printf("TIMEPREC_SUMMARY=%d/%d\n", passed, total);
        return passed == total ? 0 : 1;
    }
    printf("TIMEOUT_SUMMARY=%d/%d\n", passed, total);
    return passed == total ? 0 : 1;
}
