#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int send_all(int fd, const char *s, size_t n) {
    while (n) { ssize_t k = send(fd, s, n, 0); if (k <= 0) return -1; s += k; n -= (size_t)k; }
    return 0;
}
static void response(int fd, const char *head, const char *body) {
    send_all(fd, head, strlen(head)); send_all(fd, body, strlen(body));
}
static void serve(int fd) {
    char request[8192]; size_t used = 0; request[0] = '\0';
    while (used + 1 < sizeof request && !strstr(request, "\r\n\r\n")) {
        ssize_t n = recv(fd, request + used, sizeof request - used - 1, 0);
        if (n <= 0) return;
        used += (size_t)n; request[used] = '\0';
    }
    char path[128] = {0}; sscanf(request, "POST %127s", path);
    char *end = strstr(request, "\r\n\r\n"); if (!end) return;
    size_t body_len = 0; char *cl = strcasestr(request, "\r\nContent-Length:");
    if (cl) body_len = (size_t)strtoul(cl + 17, NULL, 10);
    size_t header_len = (size_t)(end + 4 - request), have = used - header_len;
    while (have < body_len && used + 1 < sizeof request) {
        ssize_t n = recv(fd, request + used, sizeof request - used - 1, 0);
        if (n <= 0) return;
        used += (size_t)n; have += (size_t)n; request[used] = '\0';
    }
    if (!strcmp(path, "/echo")) {
        fputs("RAW_STREAM_REQUEST_BEGIN\n", stdout); fwrite(request, 1, header_len + body_len, stdout);
        fputs("\nRAW_STREAM_REQUEST_END\n", stdout); fflush(stdout);
        response(fd, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n", "ok");
    } else if (!strcmp(path, "/chunks") || !strcmp(path, "/stop")) {
        const char *head = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n";
        send_all(fd, head, strlen(head));
        send_all(fd, "3\r\none\r\n", 8); send_all(fd, "3\r\ntwo\r\n", 8);
        send_all(fd, "5\r\nthree\r\n0\r\n\r\n", 15);
    } else if (!strcmp(path, "/empty")) {
        response(fd, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n", "0\r\n\r\n");
    } else if (!strcmp(path, "/single")) {
        response(fd, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n", "4\r\nsolo\r\n0\r\n\r\n");
    } else if (!strcmp(path, "/bad")) {
        response(fd, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n", "Z\r\n");
    } else if (!strcmp(path, "/large")) {
        response(fd, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n", "200001\r\n");
    } else if (!strcmp(path, "/truncated")) {
        response(fd, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n", "5\r\nabc");
    } else if (!strcmp(path, "/timeout")) {
        const char *partial = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n5\r\nab";
        send_all(fd, partial, strlen(partial));
        sleep(6);
    } else if (!strcmp(path, "/plain")) {
        response(fd, "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\n", "plain");
    } else response(fd, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", "");
}
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    int fd = socket(AF_INET, SOCK_STREAM, 0); if (fd < 0) return 3;
    int yes = 1; setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);
    struct sockaddr_in a = {0}; a.sin_family = AF_INET; a.sin_addr.s_addr = htonl(INADDR_LOOPBACK); a.sin_port = 0;
    if (bind(fd, (struct sockaddr *)&a, sizeof a) || listen(fd, 16)) return 4;
    socklen_t n = sizeof a; if (getsockname(fd, (struct sockaddr *)&a, &n)) return 5;
    FILE *p = fopen(argv[1], "w"); if (!p) return 6; fprintf(p, "%u\n", ntohs(a.sin_port)); fclose(p);
    for (int i = 0; i < 12; i++) { int client = accept(fd, NULL, NULL); if (client < 0) return 7; serve(client); close(client); }
    close(fd); return 0;
}
