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
#include <strings.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

enum { MIXED_ROUTE_COUNT = 5, ROUTE_COUNT = 6, STATUS_MAX = 600 };
static const char *route_names[ROUTE_COUNT] = {"ok", "static", "jwt", "read", "write", "slow300"};
static pthread_mutex_t gate_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t gate_cond = PTHREAD_COND_INITIALIZER;
static int gate_open;
static uint64_t start_ns;
static uint64_t deadline_ns;
static int server_port;
static unsigned stage_id;
static unsigned duration_seconds;
static int fixed_route = -1;

typedef struct {
    unsigned id;
    uint64_t requests;
    uint64_t route_requests[ROUTE_COUNT];
    uint64_t statuses[STATUS_MAX];
    uint64_t errors;
    uint64_t refused;
    uint64_t connect_timeout;
    uint64_t connect_other;
    uint64_t io_errors;
    uint64_t send_timeout;
    uint64_t send_other;
    uint64_t recv_timeout;
    uint64_t recv_other;
    uint64_t incomplete_response;
    uint64_t invalid_status;
    uint64_t write_200;
    uint64_t retry_after_missing;
    char **ack_ids;
    size_t ack_count;
    size_t ack_capacity;
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

static int response_body_complete(const char *response, size_t used) {
    const char *separator = strstr(response, "\r\n\r\n");
    if (!separator) return 0;
    const char *line = strstr(response, "\r\n") + 2;
    while (line < separator) {
        const char *end = strstr(line, "\r\n");
        if (!end || end > separator) return 0;
        if (strncasecmp(line, "Content-Length:", 15) == 0) {
            const char *value = line + 15;
            while (value < end && (*value == ' ' || *value == '\t')) value++;
            char *parsed_end = NULL;
            unsigned long long body_length = strtoull(value, &parsed_end, 10);
            if (parsed_end == value || parsed_end > end) return 0;
            size_t body_offset = (size_t)(separator - response) + 4;
            return body_offset <= used && body_length <= used - body_offset;
        }
        line = end + 2;
    }
    return 0;
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
    rc = poll(&item, 1, 3000);
    if (rc <= 0) { if (rc == 0) errno = ETIMEDOUT; return -1; }
    int error = 0;
    socklen_t error_length = sizeof(error);
    if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &error_length) != 0) return -1;
    if (error) { errno = error; return -1; }
    if (fcntl(fd, F_SETFL, flags) != 0) return -1;
    return 0;
}

static int remember_ack(Worker *worker, const char *request_id) {
    if (worker->ack_count == worker->ack_capacity) {
        size_t capacity = worker->ack_capacity ? worker->ack_capacity * 2 : 16;
        char **items = realloc(worker->ack_ids, capacity * sizeof(*items));
        if (!items) return 0;
        worker->ack_ids = items;
        worker->ack_capacity = capacity;
    }
    worker->ack_ids[worker->ack_count] = strdup(request_id);
    if (!worker->ack_ids[worker->ack_count]) return 0;
    worker->ack_count++;
    return 1;
}

static void do_request(Worker *worker, unsigned route, uint64_t sequence) {
    uint64_t began = monotonic_ns();
    int status = 0;
    int io_error = 0;
    int recv_error = 0;
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        worker->connect_other++;
        goto done;
    }

    struct timeval timeout = {.tv_sec = 3, .tv_usec = 0};
    (void)setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
    (void)setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
    struct sockaddr_in address = {.sin_family = AF_INET, .sin_port = htons((uint16_t)server_port)};
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect_with_timeout(fd, (struct sockaddr *)&address, sizeof(address)) != 0) {
        if (errno == ECONNREFUSED) worker->refused++;
        else if (errno == ETIMEDOUT) worker->connect_timeout++;
        else worker->connect_other++;
        close(fd);
        goto done;
    }

    char request[512];
    int length;
    char request_id[96] = "";
    if (route == 4) {
        snprintf(request_id, sizeof(request_id), "s%u-w%u-q%llu", stage_id, worker->id,
                 (unsigned long long)sequence);
        length = snprintf(request, sizeof(request),
            "POST /write HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Request-ID: %s\r\n"
            "Connection: close\r\nContent-Length: 0\r\n\r\n", request_id);
    } else {
        const char *path = route == 0 ? "/ok" : route == 1 ? "/static/sample.txt" :
                           route == 2 ? "/jwt" : route == 3 ? "/read" :
                           route == 5 ? "/__slow300" : "/read";
        length = snprintf(request, sizeof(request),
            "GET %s HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n", path);
    }
    if (length < 0 || (size_t)length >= sizeof(request) || !send_all(fd, request, (size_t)length)) {
        if (errno == ETIMEDOUT || errno == EAGAIN || errno == EWOULDBLOCK)
            worker->send_timeout++;
        else
            worker->send_other++;
        close(fd);
        io_error = 1;
        goto done;
    }

    char response[16384] = {0};
    size_t used = 0;
    while (used + 1 < sizeof(response)) {
        ssize_t n = recv(fd, response + used, sizeof(response) - used - 1, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n < 0) {
            io_error = 1;
            recv_error = 1;
            if (errno == ETIMEDOUT || errno == EAGAIN || errno == EWOULDBLOCK)
                worker->recv_timeout++;
            else
                worker->recv_other++;
            break;
        }
        if (n == 0) break;
        used += (size_t)n;
        response[used] = '\0';
        if (!status && sscanf(response, "HTTP/1.%*d %d", &status) != 1) status = 0;
        if (status && response_body_complete(response, used)) break;
    }
    close(fd);
    if (!recv_error) {
        io_error = !response_body_complete(response, used);
        if (io_error) worker->incomplete_response++;
    }
    if (!status) worker->invalid_status++;
    if (status == 503 && !strstr(response, "Retry-After: 1")) worker->retry_after_missing++;

done:
    if (status >= 0 && status < STATUS_MAX) worker->statuses[status]++;
    worker->requests++;
    worker->route_requests[route]++;
    if (route == 4 && status == 200 && !io_error) {
        if (strstr(response, request_id) && remember_ack(worker, request_id)) worker->write_200++;
        else io_error = 1;
    }
    if (status != 200 || io_error) worker->errors++;
    if (io_error) worker->io_errors++;
    add_latency(worker, monotonic_ns() - began);
}

static void *worker_main(void *opaque) {
    Worker *worker = opaque;
    pthread_mutex_lock(&gate_mutex);
    while (!gate_open) pthread_cond_wait(&gate_cond, &gate_mutex);
    pthread_mutex_unlock(&gate_mutex);
    uint64_t sequence = 0;
    while (monotonic_ns() < deadline_ns) {
        unsigned route = fixed_route >= 0 ? (unsigned)fixed_route :
                         (worker->id + (unsigned)sequence) % MIXED_ROUTE_COUNT;
        do_request(worker, route, sequence);
        sequence++;
        if (fixed_route == -1 && monotonic_ns() < deadline_ns) {
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
    if (argc != 6 && argc != 7) {
        fprintf(stderr, "usage: load-client <port> <concurrency> <seconds> <stage-id> <ack-sql> [mixed|ok|static|jwt|read|write|slow300]\n");
        return 2;
    }
    server_port = atoi(argv[1]);
    unsigned concurrency = (unsigned)strtoul(argv[2], NULL, 10);
    duration_seconds = (unsigned)strtoul(argv[3], NULL, 10);
    stage_id = (unsigned)strtoul(argv[4], NULL, 10);
    const char *ack_path = argv[5];
    if (argc == 7 && strcmp(argv[6], "mixed") == 0) {
        fixed_route = -2;
    } else if (argc == 7) {
        for (unsigned i = 0; i < ROUTE_COUNT; i++) {
            if (strcmp(argv[6], route_names[i]) == 0) fixed_route = (int)i;
        }
        if (fixed_route < 0) return 2;
    }
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

    uint64_t requests = 0, errors = 0, refused = 0, connect_timeout = 0, connect_other = 0, io_errors = 0, write_200 = 0, retry_after_missing = 0;
    uint64_t send_timeout = 0, send_other = 0, recv_timeout = 0, recv_other = 0, incomplete_response = 0, invalid_status = 0;
    size_t ack_count = 0;
    uint64_t statuses[STATUS_MAX] = {0}, other_http = 0, route_requests[ROUTE_COUNT] = {0};
    size_t sample_count = 0;
    for (unsigned i = 0; i < created; i++) {
        requests += workers[i].requests;
        errors += workers[i].errors;
        refused += workers[i].refused;
        connect_timeout += workers[i].connect_timeout;
        connect_other += workers[i].connect_other;
        io_errors += workers[i].io_errors;
        send_timeout += workers[i].send_timeout;
        send_other += workers[i].send_other;
        recv_timeout += workers[i].recv_timeout;
        recv_other += workers[i].recv_other;
        incomplete_response += workers[i].incomplete_response;
        invalid_status += workers[i].invalid_status;
        write_200 += workers[i].write_200;
        retry_after_missing += workers[i].retry_after_missing;
        ack_count += workers[i].ack_count;
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
    uint64_t overload_rejected = statuses[503] + refused;
    double rejection_pct = errors ? 100.0 * (double)overload_rejected / (double)errors : 0.0;
    printf("LOAD_STAGE stage=%u concurrency=%u created=%u create_failures=%u duration_s=%u elapsed_s=%.3f requests=%llu rps=%.2f p50_ms=%.3f p99_ms=%.3f max_ms=%.3f errors=%llu error_pct=%.3f connect_refused=%llu connect_timeout=%llu connect_other=%llu io_errors=%llu other_http=%llu status_503=%llu retry_after_missing=%llu overload_rejected=%llu rejection_pct=%.3f write_http_200=%llu send_timeout=%llu send_other=%llu recv_timeout=%llu recv_other=%llu incomplete_response=%llu invalid_status=%llu route_counts=",
        stage_id, concurrency, created, concurrency - created, duration_seconds, elapsed,
        (unsigned long long)requests, elapsed > 0 ? requests / elapsed : 0.0,
        p50 / 1000.0, p99 / 1000.0, maximum / 1000.0,
        (unsigned long long)errors, error_pct, (unsigned long long)refused,
        (unsigned long long)connect_timeout,
        (unsigned long long)connect_other, (unsigned long long)io_errors,
        (unsigned long long)other_http,
        (unsigned long long)statuses[503], (unsigned long long)retry_after_missing,
        (unsigned long long)overload_rejected,
        rejection_pct,
        (unsigned long long)write_200,
        (unsigned long long)send_timeout, (unsigned long long)send_other,
        (unsigned long long)recv_timeout, (unsigned long long)recv_other,
        (unsigned long long)incomplete_response, (unsigned long long)invalid_status);
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
    FILE *ack_file = fopen(ack_path, "a");
    if (!ack_file) return 2;
    for (unsigned i = 0; i < created; i++) {
        for (size_t j = 0; j < workers[i].ack_count; j++) {
            if (fprintf(ack_file, "INSERT INTO acknowledged_ids(request_id) VALUES('%s');\n",
                        workers[i].ack_ids[j]) < 0) return 2;
            free(workers[i].ack_ids[j]);
        }
        free(workers[i].ack_ids);
        free(workers[i].latency_us);
    }
    if (fclose(ack_file) != 0) return 2;
    printf("LOAD_ACK_IDS_SAVED=%zu\n", ack_count);
    free(samples);
    free(workers);
    free(threads);
    return created == concurrency ? 0 : 1;
}
