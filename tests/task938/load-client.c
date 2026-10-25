#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

enum { ROUTE_COUNT = 5, STATUS_MAX = 600 };
static const char *route_names[ROUTE_COUNT] = {"ok", "static", "jwt", "read", "write"};
static pthread_mutex_t gate_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t gate_cond = PTHREAD_COND_INITIALIZER;
static int gate_open;
static uint64_t start_ns;
static uint64_t deadline_ns;
static int server_port;
static unsigned stage_id;
static unsigned duration_seconds;

typedef struct {
    unsigned id;
    uint64_t requests;
    uint64_t route_requests[ROUTE_COUNT];
    uint64_t statuses[STATUS_MAX];
    uint64_t errors;
    uint64_t refused;
    uint64_t connect_other;
    uint64_t io_errors;
    uint64_t write_200;
    uint32_t *latency_us;
    size_t latency_count;
    size_t latency_capacity;
} Worker;

static uint64_t monotonic_ns(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) return 0;
    return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

static void add_latency(Worker *worker, uint64_t elapsed_ns) {
    if (worker->latency_count == worker->latency_capacity) {
        size_t capacity = worker->latency_capacity ? worker->latency_capacity * 2 : 256;
        uint32_t *samples = realloc(worker->latency_us, capacity * sizeof(*samples));
        if (!samples) return;
        worker->latency_us = samples;
        worker->latency_capacity = capacity;
    }
    uint64_t us = elapsed_ns / 1000;
    worker->latency_us[worker->latency_count++] = us > UINT32_MAX ? UINT32_MAX : (uint32_t)us;
}

static int send_all(int fd, const char *data, size_t length) {
    size_t sent = 0;
    while (sent < length) {
        ssize_t n = send(fd, data + sent, length - sent, MSG_NOSIGNAL);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return 0;
        sent += (size_t)n;
    }
    return 1;
}

static int connect_with_timeout(int fd, const struct sockaddr *address, socklen_t length) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) != 0) return -1;
    int rc = connect(fd, address, length);
    if (rc == 0) {
        (void)fcntl(fd, F_SETFL, flags);
        return 0;
    }
    if (errno != EINPROGRESS) return -1;
    struct pollfd item = {.fd = fd, .events = POLLOUT};
    rc = poll(&item, 1, 250);
    if (rc <= 0) { if (rc == 0) errno = ETIMEDOUT; return -1; }
    int error = 0;
    socklen_t error_length = sizeof(error);
    if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &error_length) != 0) return -1;
    if (error) { errno = error; return -1; }
    if (fcntl(fd, F_SETFL, flags) != 0) return -1;
    return 0;
}

static void do_request(Worker *worker, unsigned route) {
    uint64_t began = monotonic_ns();
    int status = 0;
    int io_error = 0;
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        worker->connect_other++;
        goto done;
    }

    struct timeval timeout = {.tv_sec = 1, .tv_usec = 0};
    (void)setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    (void)setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
    struct sockaddr_in address = {.sin_family = AF_INET, .sin_port = htons((uint16_t)server_port)};
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect_with_timeout(fd, (struct sockaddr *)&address, sizeof(address)) != 0) {
        if (errno == ECONNREFUSED) worker->refused++;
        else worker->connect_other++;
        close(fd);
        goto done;
    }

    char request[512];
    int length;
    if (route == 4) {
        length = snprintf(request, sizeof(request),
            "POST /write HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    } else {
        const char *path = route == 0 ? "/ok" : route == 1 ? "/static/sample.txt" :
                           route == 2 ? "/jwt" : "/read";
        length = snprintf(request, sizeof(request),
            "GET %s HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n", path);
    }
    if (length < 0 || (size_t)length >= sizeof(request) || !send_all(fd, request, (size_t)length)) {
        close(fd);
        io_error = 1;
        goto done;
    }

    char response[16384];
    size_t used = 0;
    int eof = 0;
    while (used + 1 < sizeof(response)) {
        ssize_t n = recv(fd, response + used, sizeof(response) - used - 1, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n < 0) { io_error = 1; break; }
        if (n == 0) { eof = 1; break; }
        used += (size_t)n;
        response[used] = '\0';
        if (!status && sscanf(response, "HTTP/1.%*d %d", &status) != 1) status = 0;
    }
    close(fd);
    if (!eof) io_error = 1;

done:
    if (status >= 0 && status < STATUS_MAX) worker->statuses[status]++;
    worker->requests++;
    worker->route_requests[route]++;
    if (status != 200 || io_error) worker->errors++;
    if (io_error) worker->io_errors++;
    if (route == 4 && status == 200 && !io_error) worker->write_200++;
    add_latency(worker, monotonic_ns() - began);
}

static void *worker_main(void *opaque) {
    Worker *worker = opaque;
    pthread_mutex_lock(&gate_mutex);
    while (!gate_open) pthread_cond_wait(&gate_cond, &gate_mutex);
    pthread_mutex_unlock(&gate_mutex);
    uint64_t sequence = 0;
    while (monotonic_ns() < deadline_ns) {
        unsigned route = (worker->id + (unsigned)sequence) % ROUTE_COUNT;
        do_request(worker, route);
        sequence++;
        if (monotonic_ns() < deadline_ns) {
            struct timespec pause = {.tv_sec = 1, .tv_nsec = 0};
            while (nanosleep(&pause, &pause) != 0 && errno == EINTR) {}
        }
    }
    return NULL;
}

static int compare_u32(const void *left, const void *right) {
    uint32_t a = *(const uint32_t *)left, b = *(const uint32_t *)right;
    return (a > b) - (a < b);
}

int main(int argc, char **argv) {
    if (argc != 5) {
        fprintf(stderr, "usage: load-client <port> <concurrency> <seconds> <stage-id>\n");
        return 2;
    }
    server_port = atoi(argv[1]);
    unsigned concurrency = (unsigned)strtoul(argv[2], NULL, 10);
    duration_seconds = (unsigned)strtoul(argv[3], NULL, 10);
    stage_id = (unsigned)strtoul(argv[4], NULL, 10);
    if (server_port < 1 || server_port > 65535 || !concurrency || concurrency > 1000 ||
        !duration_seconds || duration_seconds > 60) return 2;
    signal(SIGPIPE, SIG_IGN);

    pthread_t *threads = calloc(concurrency, sizeof(*threads));
    Worker *workers = calloc(concurrency, sizeof(*workers));
    if (!threads || !workers) return 2;
    pthread_attr_t attr;
    if (pthread_attr_init(&attr) != 0 || pthread_attr_setstacksize(&attr, 256 * 1024) != 0) return 2;
    unsigned created = 0;
    for (unsigned i = 0; i < concurrency; i++) {
        workers[i].id = i;
        int rc = pthread_create(&threads[i], &attr, worker_main, &workers[i]);
        if (rc != 0) break;
        created++;
    }
    pthread_attr_destroy(&attr);
    if (!created) return 2;

    pthread_mutex_lock(&gate_mutex);
    start_ns = monotonic_ns();
    deadline_ns = start_ns + (uint64_t)duration_seconds * 1000000000ull;
    gate_open = 1;
    pthread_cond_broadcast(&gate_cond);
    pthread_mutex_unlock(&gate_mutex);
    for (unsigned i = 0; i < created; i++) pthread_join(threads[i], NULL);
    uint64_t ended = monotonic_ns();
    double elapsed = (double)(ended - start_ns) / 1000000000.0;

    uint64_t requests = 0, errors = 0, refused = 0, connect_other = 0, io_errors = 0, write_200 = 0;
    uint64_t statuses[STATUS_MAX] = {0}, other_http = 0, route_requests[ROUTE_COUNT] = {0};
    size_t sample_count = 0;
    for (unsigned i = 0; i < created; i++) {
        requests += workers[i].requests;
        errors += workers[i].errors;
        refused += workers[i].refused;
        connect_other += workers[i].connect_other;
        io_errors += workers[i].io_errors;
        write_200 += workers[i].write_200;
        sample_count += workers[i].latency_count;
        for (unsigned route = 0; route < ROUTE_COUNT; route++) route_requests[route] += workers[i].route_requests[route];
        for (int code = 0; code < STATUS_MAX; code++) {
            statuses[code] += workers[i].statuses[code];
            if (code != 0 && code != 200 && code != 503) other_http += workers[i].statuses[code];
        }
    }
    uint32_t *samples = malloc((sample_count ? sample_count : 1) * sizeof(*samples));
    if (!samples) return 2;
    size_t offset = 0;
    for (unsigned i = 0; i < created; i++) {
        memcpy(samples + offset, workers[i].latency_us, workers[i].latency_count * sizeof(*samples));
        offset += workers[i].latency_count;
    }
    qsort(samples, sample_count, sizeof(*samples), compare_u32);
    uint32_t p50 = sample_count ? samples[(sample_count - 1) * 50 / 100] : 0;
    uint32_t p99 = sample_count ? samples[(sample_count - 1) * 99 / 100] : 0;
    uint32_t maximum = sample_count ? samples[sample_count - 1] : 0;
    double error_pct = requests ? 100.0 * (double)errors / (double)requests : 0.0;
    printf("LOAD_STAGE stage=%u concurrency=%u created=%u create_failures=%u duration_s=%u elapsed_s=%.3f requests=%llu rps=%.2f p50_ms=%.3f p99_ms=%.3f max_ms=%.3f errors=%llu error_pct=%.3f connect_refused=%llu connect_other=%llu io_errors=%llu other_http=%llu write_http_200=%llu route_counts=",
        stage_id, concurrency, created, concurrency - created, duration_seconds, elapsed,
        (unsigned long long)requests, elapsed > 0 ? requests / elapsed : 0.0,
        p50 / 1000.0, p99 / 1000.0, maximum / 1000.0,
        (unsigned long long)errors, error_pct, (unsigned long long)refused,
        (unsigned long long)connect_other, (unsigned long long)io_errors,
        (unsigned long long)other_http,
        (unsigned long long)write_200);
    for (unsigned route = 0; route < ROUTE_COUNT; route++) {
        printf("%s%s:%llu", route ? "," : "", route_names[route],
               (unsigned long long)route_requests[route]);
    }
    printf(" status_codes=");
    int comma = 0;
    for (int code = 0; code < STATUS_MAX; code++) {
        if (!statuses[code]) continue;
        printf("%s%d:%llu", comma ? "," : "", code,
               (unsigned long long)statuses[code]);
        comma = 1;
    }
    printf("\n");
    for (unsigned i = 0; i < created; i++) free(workers[i].latency_us);
    free(samples);
    free(workers);
    free(threads);
    return created == concurrency ? 0 : 1;
}
