/* FreeLang cannot access sockets: this primitive exchanges bounded raw bytes only. */
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
FLValue _fl_http_exchange(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit) {
    if (host.tag != FL_STRING || wire.tag != FL_STRING || port.tag != FL_INT ||
        timeout.tag != FL_INT || limit.tag != FL_INT || port.i < 1 || port.i > 65535 ||
        timeout.i < 1 || timeout.i > 60000 || limit.i < 1 || limit.i > 16777216)
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
    char *buffer = malloc((size_t)limit.i + 2);
    if (!buffer) { close(fd); return transport_error("IO", "allocation failed"); }
    size_t used = 0;
    for (;;) {
        ready = transport_wait(fd, POLLIN, deadline);
        if (ready <= 0) { free(buffer); close(fd); return transport_error(ready == 0 ? "TIMEOUT" : "IO", "receive failed"); }
        ssize_t n = recv(fd, buffer + used, (size_t)limit.i + 1 - used, 0);
        if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
        if (n < 0) { free(buffer); close(fd); return transport_error("IO", "receive failed"); }
        if (!n) break;
        used += (size_t)n;
        if (used > (size_t)limit.i) { free(buffer); close(fd); return transport_error("RESPONSE_TOO_LARGE", "response byte limit exceeded"); }
    }
    close(fd);
    if (memchr(buffer, 0, used)) { free(buffer); return transport_error("HTTP_BINARY", "binary response unsupported"); }
    buffer[used] = 0;
    FLValue result = fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(true));
    result = fl_map_set(result, fl_str_val("value"), fl_str_val(buffer));
    free(buffer);
    return result;
}
