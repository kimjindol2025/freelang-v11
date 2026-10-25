#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

static uint32_t state = 0x937a51e1u;
static uint32_t rnd(void) { state ^= state << 13; state ^= state >> 17; state ^= state << 5; return state; }
static int port;

static int one(unsigned i, unsigned *issues) {
    char req[512]; size_t n = 0;
    switch (i % 10) {
    case 0: n = (size_t)snprintf(req, sizeof(req), "GET /ok HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"); break;
    case 1: n = (size_t)snprintf(req, sizeof(req), "G E T /ok HTTP/1.1\r\nHost: x\r\n\r\n"); break;
    case 2: n = (size_t)snprintf(req, sizeof(req), "GET /ok HTTP/1.1\r\nBad Header: x\r\n\r\n"); break;
    case 3: n = (size_t)snprintf(req, sizeof(req), "POST /ok HTTP/1.1\r\nHost: x\r\nContent-Length: -%u\r\n\r\n", rnd()); break;
    case 4: n = (size_t)snprintf(req, sizeof(req), "POST /ok HTTP/1.1\r\nHost: x\r\nContent-Length: %u\r\n\r\na", rnd()); break;
    case 5: n = (size_t)snprintf(req, sizeof(req), "GET /ok HTTP/9.%u\r\nHost: x\r\n\r\n", rnd() % 10); break;
    case 6: n = (size_t)snprintf(req, sizeof(req), "GET /ok HTTP/1.1\r\nHost: x\r\nX-%c: v\r\n\r\n", (char)(rnd() & 0x1f)); break;
    case 7: n = (size_t)snprintf(req, sizeof(req), "POST /ok HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\nZ\r\n"); break;
    case 8: n = (size_t)snprintf(req, sizeof(req), "GET /%08x HTTP/1.1\r\nHost: x\r\n\r\n", rnd()); break;
    default: {
        static const char alphabet[] = "GET /HTTP.1\r\nHost: xyz0123456789!@#$%^&*";
        n = 16 + rnd() % 120;
        if (n >= sizeof(req)) n = sizeof(req) - 1;
        for (size_t j = 0; j < n; j++) req[j] = alphabet[rnd() % (sizeof(alphabet) - 1)];
        req[n] = 0;
    }}
    int fd = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (fd < 0) { (*issues)++; return 0; }
    struct timeval tv = {.tv_sec=2}; setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    struct sockaddr_in a = {.sin_family=AF_INET, .sin_port=htons((unsigned short)port), .sin_addr.s_addr=htonl(INADDR_LOOPBACK)};
    if (connect(fd, (struct sockaddr *)&a, sizeof(a)) != 0) { close(fd); (*issues)++; return 0; }
    size_t sent = 0;
    while (sent < n) {
        ssize_t k = send(fd, req + sent, n - sent, MSG_NOSIGNAL);
        if (k < 0 && errno == EINTR) continue;
        if (k <= 0) break;
        sent += (size_t)k;
    }
    shutdown(fd, SHUT_WR);
    char response[256] = {0}; ssize_t got = recv(fd, response, sizeof(response)-1, 0); close(fd);
    if (got > 0) {
        int status = 0; (void)sscanf(response, "HTTP/1.1 %d", &status);
        if (!(status == 200 || status == 400 || status == 404 || status == 408 || status == 413 || status == 431)) {
            if ((*issues)++ == 0) { FILE *f=fopen("tests/fuzz-crashers/http-first.txt","wb"); if(f){fwrite(req,1,n,f);fclose(f);} }
        }
    }
    return 1;
}

int main(int argc, char **argv) {
    if (argc != 3) return 2;
    port = atoi(argv[1]); unsigned count = (unsigned)strtoul(argv[2], NULL, 10), issues = 0, completed = 0;
    if (port < 1 || !count) return 2;
    for (unsigned i=0; i<count; i++) completed += (unsigned)one(i, &issues);
    printf("HTTP_FUZZ iterations=%u completed=%u issues=%u seed=0x937a51e1\n", count, completed, issues);
    return issues || completed != count;
}
