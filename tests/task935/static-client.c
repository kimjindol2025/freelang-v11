#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

static int passed, total;
static const char secret[] = "STATIC_SECRET_TASK935_EXAMPLE_ONLY";

static int request(int port, const char *path, char *response, size_t capacity) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return 0;
    struct timeval timeout = { .tv_sec = 3, .tv_usec = 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    struct sockaddr_in address = { .sin_family = AF_INET, .sin_port = htons((unsigned short)port) };
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(fd, (struct sockaddr *)&address, sizeof(address)) != 0) { close(fd); return 0; }
    char wire[8192];
    int length = snprintf(wire, sizeof(wire),
        "GET %s HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n", path);
    if (length < 0 || (size_t)length >= sizeof(wire)) { close(fd); return 0; }
    size_t sent = 0;
    while (sent < (size_t)length) {
        ssize_t n = send(fd, wire + sent, (size_t)length - sent, MSG_NOSIGNAL);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) { close(fd); return 0; }
        sent += (size_t)n;
    }
    size_t used = 0;
    while (used + 1 < capacity) {
        ssize_t n = recv(fd, response + used, capacity - used - 1, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) break;
        used += (size_t)n;
    }
    response[used] = '\0';
    close(fd);
    int status = 0;
    (void)sscanf(response, "HTTP/1.1 %d", &status);
    return status;
}

static void check(int port, const char *name, const char *path, int expected,
                  const char *expected_body) {
    char response[8192];
    response[0] = '\0';
    int status = request(port, path, response, sizeof(response));
    const char *body = strstr(response, "\r\n\r\n");
    body = body ? body + 4 : "";
    int secret_seen = strstr(response, secret) != NULL;
    int status_ok = expected ? status == expected : (status == 400 || status == 403 || status == 404);
    int body_ok = !expected_body || strcmp(body, expected_body) == 0;
    int ok = status_ok && !secret_seen && body_ok;
    passed += ok;
    total++;
    printf("STATIC_CASE=%s STATUS=%d SECRET=%s RESULT=%s\n",
           name, status, secret_seen ? "YES" : "NO", ok ? "PASS" : "FAIL");
}

int main(int argc, char **argv) {
    if (argc != 3) return 2;
    int port = atoi(argv[1]);
    char absolute[4096];
    int n = snprintf(absolute, sizeof(absolute), "/static/%%2F%s/../outside-secret.txt", argv[2]);
    if (n < 0 || (size_t)n >= sizeof(absolute)) return 2;
    check(port, "normal-index", "/static/index.html", 200, "STATIC_PUBLIC_OK\n");
    check(port, "normal-nested", "/static/sub/page.txt", 200, "STATIC_NESTED_OK\n");
    check(port, "path-dotdot", "/static/../outside-secret.txt", 0, NULL);
    check(port, "path-encoded-dotdot", "/static/%2e%2e/outside-secret.txt", 0, NULL);
    check(port, "path-double-encoded-dotdot", "/static/%252e%252e/outside-secret.txt", 0, NULL);
    check(port, "path-encoded-slash", "/static/%2e%2e%2foutside-secret.txt", 0, NULL);
    check(port, "path-backslash", "/static/..%5coutside-secret.txt", 0, NULL);
    check(port, "path-absolute", absolute, 0, NULL);
    check(port, "path-nul", "/static/%00outside-secret.txt", 0, NULL);
    check(port, "symlink-file", "/static/file-link.txt", 0, NULL);
    check(port, "symlink-directory-file", "/static/dir-link/hidden.txt", 0, NULL);
    check(port, "symlink-directory", "/static/dir-link", 0, NULL);
    check(port, "directory", "/static/sub", 0, NULL);
    check(port, "directory-trailing-slash", "/static/sub/", 0, NULL);
    check(port, "non-regular-file", "/static/pipe", 404, NULL);
    check(port, "missing-file", "/static/not-found.txt", 404, NULL);
    check(port, "malformed-percent", "/static/%2e%2e%zz/outside-secret.txt", 0, NULL);
    check(port, "empty-static-root-path", "/static/", 0, NULL);
    printf("STATIC_SUMMARY=%d/%d\n", passed, total);
    return passed == total ? 0 : 1;
}
