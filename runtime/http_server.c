#define _GNU_SOURCE
#define _POSIX_C_SOURCE 200809L
#include "runtime.h"
#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <netinet/in.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define HTTP_ROUTE_MAX 128
#define HTTP_HEADER_MAX 65536
#define HTTP_HEADER_COUNT_MAX 128
#define HTTP_DEFAULT_HEADER_TIMEOUT_MS 500
#define HTTP_DEFAULT_BODY_TIMEOUT_MS 500
#define HTTP_DEFAULT_BODY_LIMIT (1024 * 1024)
#define HTTP_STATIC_FILE_MAX (8 * 1024 * 1024)
#define HTTP_STATIC_PATH_MAX 4096
#define HTTP_MAX_WORKERS 256
#define HTTP_LISTEN_BACKLOG 1024

typedef struct {
    char method[16];
    char *pattern;
    FLValue handler;
    int static_root_fd;
    int is_static;
} FLHttpRoute;

static FLHttpRoute http_routes[HTTP_ROUTE_MAX];
static size_t http_route_count = 0;
static size_t http_body_limit = HTTP_DEFAULT_BODY_LIMIT;
static int http_header_timeout_ms = HTTP_DEFAULT_HEADER_TIMEOUT_MS;
static int http_body_timeout_ms = HTTP_DEFAULT_BODY_TIMEOUT_MS;
static int http_rate_max = 0;
static int64_t http_rate_window_ms = 0;
static int64_t http_rate_window_start = 0;
static int http_rate_count = 0;
static volatile sig_atomic_t http_stopping = 0;
static volatile sig_atomic_t http_child_changed = 0;
static int http_worker_limit = HTTP_MAX_WORKERS;
static int http_max_conn = 256;
static int http_pool_workers = 0;
static int http_pool_max_requests = 10000;
static unsigned http_pool_restarts = 0;
static pid_t http_workers[HTTP_MAX_WORKERS];
static size_t http_worker_count = 0;
typedef struct {
    volatile int lock;
    int64_t window_start;
    int count;
    volatile int active_connections;
    volatile int max_active_connections;
    volatile int total_requests;
    int worker_active[HTTP_MAX_WORKERS];
} FLHttpRateState;
static FLHttpRateState *http_rate_shared;
static int64_t http_now_ms(void);
static void http_handle_client(int fd);
static void http_send_busy(int fd);

static void http_shared_lock(void) {
    while (__sync_lock_test_and_set(&http_rate_shared->lock, 1)) { }
}

static void http_shared_unlock(void) {
    __sync_lock_release(&http_rate_shared->lock);
}

static int http_connection_enter(void) {
    int active = __sync_val_compare_and_swap(&http_rate_shared->active_connections, 0, 0);
    for (;;) {
        if (active >= http_max_conn) return 0;
        int previous = __sync_val_compare_and_swap(
            &http_rate_shared->active_connections, active, active + 1);
        if (previous == active) break;
        active = previous;
    }
    active++;
    int peak = __sync_val_compare_and_swap(&http_rate_shared->max_active_connections, 0, 0);
    while (active > peak) {
        int previous = __sync_val_compare_and_swap(
            &http_rate_shared->max_active_connections, peak, active);
        if (previous == peak) break;
        peak = previous;
    }
    return 1;
}

static int http_pool_connection_enter(size_t slot) {
    http_shared_lock();
    if (http_rate_shared->active_connections >= http_max_conn) {
        http_shared_unlock();
        return 0;
    }
    http_rate_shared->worker_active[slot] = 1;
    int active = ++http_rate_shared->active_connections;
    if (active > http_rate_shared->max_active_connections)
        http_rate_shared->max_active_connections = active;
    http_shared_unlock();
    return 1;
}

static void http_pool_connection_leave(size_t slot) {
    http_shared_lock();
    if (http_rate_shared->worker_active[slot]) {
        http_rate_shared->worker_active[slot] = 0;
        if (http_rate_shared->active_connections > 0)
            http_rate_shared->active_connections--;
    }
    http_shared_unlock();
}

static int http_pool_request_count(void) {
    return __sync_val_compare_and_swap(&http_rate_shared->total_requests, 0, 0);
}

static void http_pool_request_enter(void) {
    (void)__sync_add_and_fetch(&http_rate_shared->total_requests, 1);
}

static void http_stop_signal(int signal_number) {
    (void)signal_number;
    http_stopping = 1;
}

static void http_child_signal(int signal_number) {
    (void)signal_number;
    http_child_changed = 1;
}

static void http_reap_workers(void) {
    http_child_changed = 0;
    for (size_t i = 0; i < http_worker_count;) {
        pid_t result = waitpid(http_workers[i], NULL, WNOHANG);
        if (result == http_workers[i] || (result < 0 && errno == ECHILD)) {
            http_workers[i] = http_workers[--http_worker_count];
        } else {
            i++;
        }
    }
}

static void http_stop_workers(void) {
    for (size_t i = 0; i < http_worker_count; i++) {
        (void)kill(-http_workers[i], SIGTERM);
        (void)kill(http_workers[i], SIGTERM);
    }
    while (http_worker_count > 0) {
        int status;
        pid_t result = waitpid(-1, &status, 0);
        if (result > 0) {
            for (size_t i = 0; i < http_worker_count; i++) {
                if (http_workers[i] == result) {
                    http_workers[i] = http_workers[--http_worker_count];
                    break;
                }
            }
        } else if (errno != EINTR && errno != ECHILD) {
            break;
        } else if (errno == ECHILD) {
            http_worker_count = 0;
        }
    }
}

static int http_env_integer(const char *name, int fallback, int minimum, int maximum) {
    const char *text = getenv(name);
    if (!text || !*text) return fallback;
    char *end = NULL;
    long value = strtol(text, &end, 10);
    if (!end || *end || value < minimum || value > maximum) {
        char message[160];
        snprintf(message, sizeof(message), "%s must be between %d and %d",
                 name, minimum, maximum);
        fl_throw(fl_str_val(message));
    }
    return (int)value;
}

static void http_pool_worker_loop(int server, size_t slot) {
    struct sigaction action;
    memset(&action, 0, sizeof(action));
    action.sa_handler = http_stop_signal;
    sigemptyset(&action.sa_mask);
    (void)sigaction(SIGINT, &action, NULL);
    (void)sigaction(SIGTERM, &action, NULL);
    (void)signal(SIGCHLD, SIG_DFL);
    http_stopping = 0;
    int served = 0;
    while (!http_stopping && served < http_pool_max_requests) {
        int client = accept(server, NULL, NULL);
        if (client < 0) {
            if (errno == EINTR || errno == ECONNABORTED || errno == EPROTO ||
                errno == EAGAIN || errno == EWOULDBLOCK) continue;
            if (errno == EMFILE || errno == ENFILE || errno == ENOBUFS || errno == ENOMEM) {
                struct timespec retry = {.tv_sec = 0, .tv_nsec = 10 * 1000 * 1000};
                while (nanosleep(&retry, &retry) != 0 && errno == EINTR && !http_stopping) {}
                continue;
            }
            break;
        }
        served++;
        http_pool_request_enter();
        if (http_pool_connection_enter(slot)) {
            http_handle_client(client);
            http_pool_connection_leave(slot);
        } else {
            http_send_busy(client);
        }
        close(client);
    }
    _exit(!http_stopping && served >= http_pool_max_requests ? 75 : 0);
}

static pid_t http_spawn_pool_worker(int server, size_t slot) {
    pid_t pid = fork();
    if (pid == 0) {
        (void)setpgid(0, 0);
        http_pool_worker_loop(server, slot);
    }
    if (pid > 0) {
        (void)setpgid(pid, pid);
        http_workers[slot] = pid;
        fprintf(stderr, "HTTP_WORKER_STARTED slot=%zu pid=%ld\n", slot, (long)pid);
        fflush(stderr);
    }
    return pid;
}

static void http_run_pool(int server, int max_requests) {
    size_t size = (size_t)http_pool_workers;
    http_worker_count = 0;
    for (size_t i = 0; i < size; i++) {
        if (http_spawn_pool_worker(server, i) > 0) http_worker_count++;
    }
    while (!http_stopping && (max_requests == 0 || http_pool_request_count() < max_requests)) {
        int status;
        pid_t ended;
        while ((ended = waitpid(-1, &status, WNOHANG)) > 0) {
            for (size_t slot = 0; slot < size; slot++) {
                if (http_workers[slot] != ended) continue;
                http_pool_connection_leave(slot);
                const char *reason = WIFSIGNALED(status) ? "signal" :
                    (WIFEXITED(status) && WEXITSTATUS(status) == 75 ? "request-limit" : "exit");
                int detail = WIFSIGNALED(status) ? WTERMSIG(status) :
                    (WIFEXITED(status) ? WEXITSTATUS(status) : status);
                http_workers[slot] = 0;
                if (http_worker_count) http_worker_count--;
                if (!http_stopping) {
                    pid_t replacement = http_spawn_pool_worker(server, slot);
                    http_pool_restarts++;
                    fprintf(stderr,
                        "HTTP_WORKER_RESTART slot=%zu old_pid=%ld reason=%s detail=%d count=%u new_pid=%ld\n",
                        slot, (long)ended, reason, detail, http_pool_restarts,
                        (long)(replacement > 0 ? replacement : 0));
                    fflush(stderr);
                    if (replacement > 0) http_worker_count++;
                }
                break;
            }
        }
        if (http_child_changed) http_child_changed = 0;
        for (size_t slot = 0; slot < size && !http_stopping; slot++) {
            if (http_workers[slot] != 0) continue;
            pid_t replacement = http_spawn_pool_worker(server, slot);
            if (replacement > 0) {
                http_worker_count++;
                http_pool_restarts++;
                fprintf(stderr,
                    "HTTP_WORKER_RESTART slot=%zu old_pid=0 reason=spawn-retry detail=0 count=%u new_pid=%ld\n",
                    slot, http_pool_restarts, (long)replacement);
                fflush(stderr);
            }
        }
        if (http_rate_shared->active_connections >= http_max_conn) {
            struct pollfd listener = {.fd = server, .events = POLLIN};
            int ready = poll(&listener, 1, 50);
            if (ready > 0 && (listener.revents & POLLIN)) {
                int client = accept(server, NULL, NULL);
                if (client >= 0) {
                    http_send_busy(client);
                    close(client);
                    http_pool_request_enter();
                }
            }
        } else {
            struct timespec pause = {.tv_sec = 0, .tv_nsec = 10 * 1000 * 1000};
            while (nanosleep(&pause, &pause) != 0 && errno == EINTR && !http_stopping) {}
        }
    }
}

static void http_stop_pool(void) {
    for (size_t i = 0; i < (size_t)http_pool_workers; i++) {
        if (http_workers[i] > 0) {
            (void)kill(-http_workers[i], SIGTERM);
            (void)kill(http_workers[i], SIGTERM);
        }
    }
    for (size_t i = 0; i < (size_t)http_pool_workers; i++) {
        if (http_workers[i] > 0) {
            while (waitpid(http_workers[i], NULL, 0) < 0 && errno == EINTR) {}
            http_workers[i] = 0;
        }
    }
    http_worker_count = 0;
}

static int http_rate_limited(void) {
    if (http_rate_max <= 0) return 0;
    if (!http_rate_shared) {
        int64_t now = http_now_ms();
        if (now - http_rate_window_start >= http_rate_window_ms) {
            http_rate_window_start = now;
            http_rate_count = 0;
        }
        return ++http_rate_count > http_rate_max;
    }
    while (__sync_lock_test_and_set(&http_rate_shared->lock, 1)) { }
    int64_t now = http_now_ms();
    if (now - http_rate_shared->window_start >= http_rate_window_ms) {
        http_rate_shared->window_start = now;
        http_rate_shared->count = 0;
    }
    int limited = ++http_rate_shared->count > http_rate_max;
    __sync_lock_release(&http_rate_shared->lock);
    return limited;
}

static const char *http_value_string(FLValue value, const char *what) {
    if (value.tag != FL_STRING || !value.obj) {
        char message[160];
        snprintf(message, sizeof(message), "%s expects a string", what);
        fl_throw(fl_str_val(message));
    }
    return ((FLString *)value.obj)->data;
}

static int64_t http_now_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) return 0;
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static FLValue http_response(int status, const char *content_type, FLValue body) {
    FLValue response = fl_map_new();
    response = fl_map_set(response, fl_str_val("_fl_http_response"), fl_bool(true));
    response = fl_map_set(response, fl_str_val("status"), fl_int(status));
    response = fl_map_set(response, fl_str_val("content_type"), fl_str_val(content_type));
    response = fl_map_set(response, fl_str_val("body"), body);
    return response;
}

FLValue fl_resp_json(FLValue value) {
    return http_response(200, "application/json", fl_json_stringify(value));
}

FLValue fl_resp_status(FLValue status, FLValue body) {
    FLValue encoded = body.tag == FL_STRING ? body : fl_json_stringify(body);
    int code = status.tag == FL_INT ? (int)status.i : 500;
    return http_response(code, "application/json", encoded);
}

FLValue fl_resp_redirect(FLValue location) {
    if (location.tag != FL_STRING || !location.obj)
        fl_throw(fl_str_val("server-redirect expects a string location"));
    const char *target = ((FLString *)location.obj)->data;
    if (target[0] != '/' || target[1] == '/' || strlen(target) > 240)
        fl_throw(fl_str_val("server-redirect expects a safe relative path"));
    for (const unsigned char *p = (const unsigned char *)target; *p; p++)
        if (iscntrl(*p)) fl_throw(fl_str_val("server-redirect expects a safe relative path"));
    FLValue response = http_response(303, "text/plain; charset=utf-8", fl_str_val(""));
    return fl_map_set(response, fl_str_val("location"), location);
}

FLValue fl_resp_html(FLValue body) {
    FLValue text = body.tag == FL_STRING ? body : fl_text(body);
    return http_response(200, "text/html; charset=utf-8", text);
}

static int http_safe_header_value(const char *text) {
    for (const unsigned char *p = (const unsigned char *)text; *p; p++)
        if (*p == '\r' || *p == '\n') return 0;
    return 1;
}

FLValue fl_resp_html_cookie(FLValue cookie, FLValue body) {
    const char *value = http_value_string(cookie, "server-html-cookie");
    if (!http_safe_header_value(value) || strlen(value) > 400)
        fl_throw(fl_str_val("server-html-cookie expects a safe cookie"));
    return fl_map_set(fl_resp_html(body), fl_str_val("set_cookie"), cookie);
}

FLValue fl_resp_set_cookie(FLValue response, FLValue name, FLValue value) {
    const char *key = http_value_string(name, "server-set-cookie");
    const char *text = http_value_string(value, "server-set-cookie");
    char cookie[512];
    if (response.tag != FL_MAP || strlen(key) > 64 || strlen(text) > 256)
        fl_throw(fl_str_val("server-set-cookie expects response and short values"));
    for (const unsigned char *p = (const unsigned char *)key; *p; p++)
        if (!(isalnum(*p) || *p == '_' || *p == '-'))
            fl_throw(fl_str_val("server-set-cookie expects a safe cookie name"));
    for (const unsigned char *p = (const unsigned char *)text; *p; p++)
        if (!(isalnum(*p) || *p == '_' || *p == '-' || *p == '.'))
            fl_throw(fl_str_val("server-set-cookie expects a safe cookie value"));
    snprintf(cookie, sizeof(cookie), "%s=%s; Path=/; HttpOnly; SameSite=Strict%s",
             key, text, *text ? "" : "; Max-Age=0");
    return fl_map_set(response, fl_str_val("set_cookie"), fl_str_val(cookie));
}

FLValue fl_http_route(FLValue method_value, FLValue path_value, FLValue handler) {
    const char *method = http_value_string(method_value, "server route method");
    const char *path = http_value_string(path_value, "server route path");
    if (http_route_count >= HTTP_ROUTE_MAX || handler.tag != FL_FN)
        fl_throw(fl_str_val("HTTP route capacity exceeded or handler is not a function"));
    if (strlen(method) >= sizeof(http_routes[0].method))
        fl_throw(fl_str_val("HTTP method is too long"));
    FLHttpRoute *route = &http_routes[http_route_count++];
    snprintf(route->method, sizeof(route->method), "%s", method);
    route->pattern = strdup(path);
    if (!route->pattern) fl_throw(fl_str_val("HTTP route allocation failed"));
    route->handler = handler;
    route->static_root_fd = -1;
    route->is_static = 0;
    return fl_bool(true);
}

FLValue fl_http_static(FLValue root_value, FLValue prefix_value) {
    const char *root = http_value_string(root_value, "server-static root");
    const char *prefix = http_value_string(prefix_value, "server-static prefix");
    size_t prefix_length = strlen(prefix);
    if (http_route_count >= HTTP_ROUTE_MAX || prefix_length == 0 || prefix[0] != '/' ||
        prefix_length >= 1024 || strchr(prefix, '?') || strchr(prefix, '#'))
        fl_throw(fl_str_val("server-static expects a URL prefix and an available route slot"));
    char *normalized_prefix = malloc(prefix_length + 2);
    if (!normalized_prefix) fl_throw(fl_str_val("server-static allocation failed"));
    memcpy(normalized_prefix, prefix, prefix_length + 1);
    if (normalized_prefix[prefix_length - 1] != '/') {
        normalized_prefix[prefix_length] = '/';
        normalized_prefix[prefix_length + 1] = '\0';
    }
    char *absolute_root = realpath(root, NULL);
    if (!absolute_root) {
        free(normalized_prefix);
        fl_throw(fl_str_val("server-static root does not exist"));
    }
    int root_fd = open(absolute_root, O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    free(absolute_root);
    if (root_fd < 0) {
        free(normalized_prefix);
        fl_throw(fl_str_val("server-static root is not a readable directory"));
    }
    FLHttpRoute *route = &http_routes[http_route_count++];
    snprintf(route->method, sizeof(route->method), "GET");
    route->pattern = normalized_prefix;
    route->handler = fl_nil();
    route->static_root_fd = root_fd;
    route->is_static = 1;
    return fl_bool(true);
}

FLValue server_put(FLValue path, FLValue handler) {
    return fl_http_route(fl_str_val("PUT"), path, handler);
}

FLValue server_delete(FLValue path, FLValue handler) {
    return fl_http_route(fl_str_val("DELETE"), path, handler);
}

FLValue server_workers(FLValue count) {
    if (count.tag != FL_INT || count.i < 1 || count.i > HTTP_MAX_WORKERS)
        fl_throw(fl_str_val("HTTP worker count must be between 1 and 256"));
    http_worker_limit = (int)count.i;
    return fl_int(http_worker_limit);
}

FLValue server_body_limit(FLValue bytes) {
    if (bytes.tag != FL_INT || bytes.i < 1 || bytes.i > 64 * 1024 * 1024)
        fl_throw(fl_str_val("HTTP body limit must be between 1 and 67108864 bytes"));
    http_body_limit = (size_t)bytes.i;
    return fl_int((int64_t)http_body_limit);
}

FLValue server_rate_limit(FLValue count, FLValue window_ms) {
    if (count.tag != FL_INT || count.i < 1 ||
        window_ms.tag != FL_INT || window_ms.i < 1)
        fl_throw(fl_str_val("HTTP rate limit values must be positive integers"));
    http_rate_max = (int)count.i;
    http_rate_window_ms = window_ms.i;
    http_rate_window_start = http_now_ms();
    http_rate_count = 0;
    return fl_bool(true);
}

FLValue server_req_header(FLValue request, FLValue name_value) {
    const char *name = http_value_string(name_value, "server-req-header");
    char lower[256];
    size_t n = strlen(name);
    if (n >= sizeof(lower)) return fl_nil();
    for (size_t i = 0; i <= n; i++) lower[i] = (char)tolower((unsigned char)name[i]);
    return fl_map_get(fl_map_get(request, fl_str_val("headers")), fl_str_val(lower));
}

FLValue server_req_json(FLValue request) {
    FLValue body = fl_map_get(request, fl_str_val("body"));
    if (body.tag != FL_STRING || !body.obj) return fl_nil();
    if (fl_try_top >= FL_TRY_MAX) return fl_nil();
    if (setjmp(fl_try_stack[fl_try_top].buf) == 0) {
        fl_try_top++;
        FLValue parsed = fl_json_parse(body);
        fl_try_top--;
        return parsed;
    }
    fl_try_top--;
    return fl_nil();
}

static void http_send_all(int fd, const char *buffer, size_t length) {
    size_t sent = 0;
    while (sent < length) {
        /* A timed-out client can close before its handler finishes. */
        ssize_t n = send(fd, buffer + sent, length - sent, MSG_NOSIGNAL);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return;
        sent += (size_t)n;
    }
}

static const char *http_reason(int status) {
    switch (status) {
        case 200: return "OK";
        case 201: return "Created";
        case 204: return "No Content";
        case 303: return "See Other";
        case 400: return "Bad Request";
        case 401: return "Unauthorized";
        case 403: return "Forbidden";
        case 404: return "Not Found";
        case 408: return "Request Timeout";
        case 413: return "Payload Too Large";
        case 431: return "Request Header Fields Too Large";
        case 429: return "Too Many Requests";
        case 500: return "Internal Server Error";
        case 503: return "Service Unavailable";
        default: return "Response";
    }
}

static void http_send_raw(int fd, int status, const char *content_type,
                          const char *location, const char *set_cookie,
                          const char *body, size_t body_length) {
    char header[1024];
    char location_header[256] = "";
    char cookie_header[512] = "";
    if (location) snprintf(location_header, sizeof(location_header), "Location: %s\r\n", location);
    if (set_cookie) snprintf(cookie_header, sizeof(cookie_header), "Set-Cookie: %s\r\n", set_cookie);
    int length = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %zu\r\n%s%s"
        "Connection: close\r\nX-Freelang: native\r\n\r\n",
        status, http_reason(status), content_type, body_length, location_header, cookie_header);
    if (length < 0 || (size_t)length >= sizeof(header)) return;
    if (length > 0) http_send_all(fd, header, (size_t)length);
    if (body_length) http_send_all(fd, body, body_length);
}

static void http_send_status(int fd, int status, const char *message) {
    char body[256];
    int length = snprintf(body, sizeof(body), "{\"error\":\"%s\"}", message);
    if (length < 0) return;
    http_send_raw(fd, status, "application/json", NULL, NULL, body, (size_t)length);
}

static void http_send_busy(int fd) {
    static const char body[] = "{\"error\":\"server busy\"}";
    char response[256];
    int length = snprintf(response, sizeof(response),
        "HTTP/1.1 503 Service Unavailable\r\n"
        "Content-Type: application/json\r\nContent-Length: %zu\r\n"
        "Retry-After: 1\r\nConnection: close\r\nX-Freelang: native\r\n\r\n%s",
        sizeof(body) - 1, body);
    if (length > 0 && (size_t)length < sizeof(response))
        http_send_all(fd, response, (size_t)length);
}

static char *http_trim(char *value) {
    while (*value && isspace((unsigned char)*value)) value++;
    char *end = value + strlen(value);
    while (end > value && isspace((unsigned char)end[-1])) *--end = '\0';
    return value;
}

static int http_wait_readable(int fd, int64_t deadline_ms) {
    for (;;) {
        int64_t remaining = deadline_ms - http_now_ms();
        if (remaining <= 0) return 0;
        struct pollfd item = { .fd = fd, .events = POLLIN };
        int ready = poll(&item, 1, remaining > INT_MAX ? INT_MAX : (int)remaining);
        if (ready < 0 && errno == EINTR) continue;
        return ready;
    }
}

static int http_read_headers(int fd, char *buffer, size_t capacity,
                             size_t *received, size_t *header_length,
                             int64_t deadline_ms) {
    *received = 0;
    buffer[0] = '\0';
    while (*received < capacity - 1) {
        int ready = http_wait_readable(fd, deadline_ms);
        if (ready == 0) return -3;
        if (ready < 0) return -1;
        ssize_t n = recv(fd, buffer + *received, capacity - 1 - *received, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return -1;
        *received += (size_t)n;
        buffer[*received] = '\0';
        char *end = strstr(buffer, "\r\n\r\n");
        if (end) {
            *header_length = (size_t)(end - buffer) + 4;
            return 0;
        }
    }
    return -2;
}

static int http_header_token_char(unsigned char c) {
    return isalnum(c) || strchr("!#$%&'*+-.^_`|~", c) != NULL;
}

static FLValue http_parse_request(int fd, FLValue *out_request, int *out_status) {
    char buffer[HTTP_HEADER_MAX + 1];
    size_t received = 0, header_length = 0;
    int64_t header_deadline_ms = http_now_ms() + http_header_timeout_ms;
    int header_result = http_read_headers(fd, buffer, sizeof(buffer), &received, &header_length,
                                          header_deadline_ms);
    if (header_result != 0) {
        *out_status = header_result == -2 ? 431 : (header_result == -3 ? 408 : 400);
        return fl_nil();
    }
    char *header_end = strstr(buffer, "\r\n\r\n");
    if (!header_end) { *out_status = 400; return fl_nil(); }
    if (memchr(buffer, '\0', (size_t)(header_end - buffer))) { *out_status = 400; return fl_nil(); }
    char *raw_header = NULL;
#ifdef FL_HTTP_CAPTURE_RAW_TEST
    {
        raw_header = (char *)fl_malloc(header_length);
        if (!raw_header) { *out_status = 500; return fl_nil(); }
        memcpy(raw_header, buffer, header_length);
    }
#endif
    *header_end = '\0';
    char *line_end = strstr(buffer, "\r\n");
    if (!line_end) { free(raw_header); *out_status = 400; return fl_nil(); }
    *line_end = '\0';
    char method[16], target[2048], version[16];
    size_t request_line_length = (size_t)(line_end - buffer);
    if (memchr(buffer, '\0', request_line_length)) {
        free(raw_header); *out_status = 400; return fl_nil();
    }
    char *first_space = memchr(buffer, ' ', request_line_length);
    char *second_space = first_space ? memchr(first_space + 1, ' ',
        request_line_length - (size_t)(first_space + 1 - buffer)) : NULL;
    if (!first_space || !second_space || first_space == buffer || second_space == first_space + 1 ||
        second_space + 1 >= line_end || memchr(second_space + 1, ' ',
            (size_t)(line_end - second_space - 1))) {
        free(raw_header);
        *out_status = 400;
        return fl_nil();
    }
    *first_space = '\0'; *second_space = '\0';
    size_t method_length = strlen(buffer), target_length = strlen(first_space + 1);
    if (method_length >= sizeof(method) || target_length >= sizeof(target) ||
        (strcmp(second_space + 1, "HTTP/1.0") != 0 && strcmp(second_space + 1, "HTTP/1.1") != 0) ||
        first_space[1] != '/' || first_space[1] == '\0') {
        free(raw_header); *out_status = 400; return fl_nil();
    }
    for (size_t i = 0; i < method_length; i++)
        if (!http_header_token_char((unsigned char)buffer[i])) {
            free(raw_header); *out_status = 400; return fl_nil();
        }
    for (size_t i = 0; i < target_length; i++) {
        unsigned char c = (unsigned char)first_space[1 + i];
        if (c <= 0x20 || c == 0x7f) { free(raw_header); *out_status = 400; return fl_nil(); }
    }
    memcpy(method, buffer, method_length + 1);
    memcpy(target, first_space + 1, target_length + 1);
    memcpy(version, second_space + 1, strlen(second_space + 1) + 1);

    FLValue headers = fl_map_new();
    size_t body_length = 0;
    int has_transfer_encoding = 0;
    int has_content_length = 0;
    size_t header_count = 0;
    char *cursor = line_end + 2;
    while (cursor && *cursor) {
        char *next = strstr(cursor, "\r\n");
        if (next) *next = '\0';
        char *colon = strchr(cursor, ':');
        if (++header_count > HTTP_HEADER_COUNT_MAX) { free(raw_header); *out_status = 431; return fl_nil(); }
        if (!colon || colon == cursor || cursor[0] == ' ' || cursor[0] == '\t') {
            free(raw_header); *out_status = 400; return fl_nil();
        }
        *colon = '\0';
        for (char *p = cursor; *p; p++) {
            if (!http_header_token_char((unsigned char)*p)) { free(raw_header); *out_status = 400; return fl_nil(); }
            *p = (char)tolower((unsigned char)*p);
        }
        char *value = http_trim(colon + 1);
        for (const unsigned char *p = (const unsigned char *)value; *p; p++)
            if ((*p < 0x20 && *p != '\t') || *p == 0x7f) { free(raw_header); *out_status = 400; return fl_nil(); }
        headers = fl_map_set(headers, fl_str_val(cursor), fl_str_val(value));
        if (strcmp(cursor, "content-length") == 0) {
            if (has_content_length || !*value) { free(raw_header); *out_status = 400; return fl_nil(); }
            has_content_length = 1;
            size_t parsed = 0;
            for (const unsigned char *p = (const unsigned char *)value; *p; p++) {
                if (*p < '0' || *p > '9') { free(raw_header); *out_status = 400; return fl_nil(); }
                unsigned digit = (unsigned)(*p - '0');
                if (parsed > (SIZE_MAX - digit) / 10) { free(raw_header); *out_status = 413; return fl_nil(); }
                parsed = parsed * 10 + digit;
                if (parsed > http_body_limit) { free(raw_header); *out_status = 413; return fl_nil(); }
            }
            body_length = parsed;
        } else if (strcmp(cursor, "transfer-encoding") == 0) {
            has_transfer_encoding = 1;
        }
        if (!next) break;
        cursor = next + 2;
    }
    if (has_transfer_encoding) { free(raw_header); *out_status = 400; return fl_nil(); }
    if (body_length > http_body_limit) { free(raw_header); *out_status = 413; return fl_nil(); }

    size_t body_available = received - header_length;
    if (body_available > body_length) { free(raw_header); *out_status = 400; return fl_nil(); }
    size_t body_received = body_available < body_length ? body_available : body_length;
    int64_t body_deadline_ms = http_now_ms() + http_body_timeout_ms;
    char *body = fl_malloc(body_length + 1);
    if (!body) { free(raw_header); *out_status = 500; return fl_nil(); }
    if (body_received) memcpy(body, buffer + header_length, body_received);
    while (body_received < body_length) {
        int ready = http_wait_readable(fd, body_deadline_ms);
        if (ready == 0) { free(raw_header); free(body); *out_status = 408; return fl_nil(); }
        if (ready < 0) { free(raw_header); free(body); *out_status = 400; return fl_nil(); }
        ssize_t n = recv(fd, body + body_received, body_length - body_received, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) { free(raw_header); free(body); *out_status = 400; return fl_nil(); }
        body_received += (size_t)n;
    }
    body[body_length] = '\0';

    FLValue raw_request = fl_nil();
    if (raw_header) {
        char *raw = (char *)fl_malloc(header_length + body_length + 1);
        if (!raw) { free(raw_header); free(body); *out_status = 500; return fl_nil(); }
        memcpy(raw, raw_header, header_length);
        memcpy(raw + header_length, body, body_length);
        raw[header_length + body_length] = '\0';
        raw_request = fl_str_val(raw);
        free(raw); free(raw_header);
    }

    char *query = strchr(target, '?');
    const char *query_text = "";
    if (query) {
        *query = '\0';
        query_text = query + 1;
    }
    FLValue request = fl_map_new();
    request = fl_map_set(request, fl_str_val("method"), fl_str_val(method));
    request = fl_map_set(request, fl_str_val("path"), fl_str_val(target));
    request = fl_map_set(request, fl_str_val("query"), fl_str_val(query_text));
    request = fl_map_set(request, fl_str_val("headers"), headers);
    request = fl_map_set(request, fl_str_val("body"), fl_str_val(body));
    if (raw_request.tag != FL_NIL)
        request = fl_map_set(request, fl_str_val("raw"), raw_request);
    free(body);
    *out_request = request;
    *out_status = 200;
    return request;
}

static int http_match_path(const char *pattern, const char *path, FLValue *params) {
    *params = fl_map_new();
    const char *p = pattern, *q = path;
    while (*p || *q) {
        const char *p_end = strchr(p, '/');
        const char *q_end = strchr(q, '/');
        size_t p_len = p_end ? (size_t)(p_end - p) : strlen(p);
        size_t q_len = q_end ? (size_t)(q_end - q) : strlen(q);
        if (p_len > 0 && p[0] == ':') {
            char key[256];
            if (p_len >= sizeof(key) || q_len >= 2048) return 0;
            memcpy(key, p + 1, p_len - 1);
            key[p_len - 1] = '\0';
            char value[2048];
            memcpy(value, q, q_len);
            value[q_len] = '\0';
            *params = fl_map_set(*params, fl_str_val(key), fl_str_val(value));
        } else if (p_len != q_len || strncmp(p, q, p_len) != 0) {
            return 0;
        }
        if (!p_end || !q_end) return p_end == NULL && q_end == NULL;
        p = p_end + 1;
        q = q_end + 1;
    }
    return 1;
}

static int http_hex_value(unsigned char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

static int http_static_decode_path(const char *encoded, char *decoded, size_t capacity) {
    size_t out = 0;
    for (size_t i = 0; encoded[i]; i++) {
        unsigned char c = (unsigned char)encoded[i];
        if (c == '%') {
            int hi = http_hex_value((unsigned char)encoded[i + 1]);
            int lo = encoded[i + 1] ? http_hex_value((unsigned char)encoded[i + 2]) : -1;
            if (hi < 0 || lo < 0) return 0;
            c = (unsigned char)((hi << 4) | lo);
            i += 2;
        }
        if (out + 1 >= capacity || c == '\0' || c == '\\' || c < 0x20 || c == 0x7f)
            return 0;
        decoded[out++] = (char)c;
    }
    decoded[out] = '\0';
    if (!out || decoded[0] == '/') return 0;
    for (size_t i = 0; i < out; i++) {
        if (decoded[i] == '%' && decoded[i + 1] && decoded[i + 2] &&
            http_hex_value((unsigned char)decoded[i + 1]) >= 0 &&
            http_hex_value((unsigned char)decoded[i + 2]) >= 0)
            return 0;
    }
    for (char *segment = decoded; segment;) {
        char *slash = strchr(segment, '/');
        size_t length = slash ? (size_t)(slash - segment) : strlen(segment);
        if (length == 0 || (length == 1 && segment[0] == '.') ||
            (length == 2 && segment[0] == '.' && segment[1] == '.'))
            return 0;
        if (!slash) break;
        segment = slash + 1;
        if (!*segment) return 0;
    }
    return 1;
}

static FLValue http_static_error(int status, const char *message) {
    char body[96];
    snprintf(body, sizeof(body), "{\"error\":\"%s\"}", message);
    return http_response(status, "application/json", fl_str_val(body));
}

static FLValue http_static_bytes(const unsigned char *bytes, size_t length) {
    FLString *object = malloc(sizeof(*object) + length + 1);
    if (!object) return fl_nil();
    object->base.type = FL_STRING;
    object->base.rc = 1;
    object->len = (uint32_t)length;
    memcpy(object->data, bytes, length);
    object->data[length] = '\0';
    FLValue value = { .tag = FL_STRING, .obj = (FLObject *)object };
    return value;
}

static const char *http_static_content_type(const char *path) {
    const char *extension = strrchr(path, '.');
    if (!extension) return "application/octet-stream";
    if (strcasecmp(extension, ".html") == 0 || strcasecmp(extension, ".htm") == 0)
        return "text/html; charset=utf-8";
    if (strcasecmp(extension, ".css") == 0) return "text/css; charset=utf-8";
    if (strcasecmp(extension, ".js") == 0) return "application/javascript; charset=utf-8";
    if (strcasecmp(extension, ".json") == 0) return "application/json; charset=utf-8";
    if (strcasecmp(extension, ".svg") == 0) return "image/svg+xml";
    if (strcasecmp(extension, ".txt") == 0) return "text/plain; charset=utf-8";
    if (strcasecmp(extension, ".png") == 0) return "image/png";
    if (strcasecmp(extension, ".jpg") == 0 || strcasecmp(extension, ".jpeg") == 0)
        return "image/jpeg";
    if (strcasecmp(extension, ".gif") == 0) return "image/gif";
    return "application/octet-stream";
}

static FLValue http_static_serve(const FLHttpRoute *route, const char *path, int *status) {
    size_t prefix_length = strlen(route->pattern);
    char relative[HTTP_STATIC_PATH_MAX];
    if (strncmp(path, route->pattern, prefix_length) != 0 ||
        !http_static_decode_path(path + prefix_length, relative, sizeof(relative))) {
        *status = 403;
        return http_static_error(403, "forbidden");
    }
    int directory_fd = dup(route->static_root_fd);
    if (directory_fd < 0) {
        *status = 500;
        return http_static_error(500, "file open failed");
    }
    char content_path[HTTP_STATIC_PATH_MAX];
    memcpy(content_path, relative, strlen(relative) + 1);
    char *cursor = relative;
    int file_fd = -1;
    while (cursor) {
        char *slash = strchr(cursor, '/');
        if (slash) *slash = '\0';
        int flags = O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK;
        if (slash) flags |= O_DIRECTORY;
        file_fd = openat(directory_fd, cursor, flags);
        close(directory_fd);
        if (file_fd < 0) {
            *status = errno == ELOOP ? 403 : 404;
            return http_static_error(*status, *status == 403 ? "forbidden" : "not found");
        }
        if (!slash) break;
        directory_fd = file_fd;
        cursor = slash + 1;
    }
    struct stat info;
    if (fstat(file_fd, &info) != 0 || !S_ISREG(info.st_mode)) {
        close(file_fd);
        *status = 404;
        return http_static_error(404, "not found");
    }
    if (info.st_size < 0 || (uint64_t)info.st_size > HTTP_STATIC_FILE_MAX) {
        close(file_fd);
        *status = 413;
        return http_static_error(413, "file too large");
    }
    size_t length = (size_t)info.st_size;
    unsigned char *content = malloc(length ? length : 1);
    if (!content) {
        close(file_fd);
        *status = 500;
        return http_static_error(500, "file read failed");
    }
    size_t received = 0;
    while (received < length) {
        ssize_t n = read(file_fd, content + received, length - received);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) break;
        received += (size_t)n;
    }
    close(file_fd);
    if (received != length) {
        free(content);
        *status = 500;
        return http_static_error(500, "file read failed");
    }
    FLValue body = http_static_bytes(content, length);
    free(content);
    if (body.tag != FL_STRING) {
        *status = 500;
        return http_static_error(500, "response allocation failed");
    }
    *status = 200;
    return http_response(200, http_static_content_type(content_path), body);
}

static FLValue http_dispatch(FLValue request, int *status) {
    const char *method = ((FLString *)fl_map_get(request, fl_str_val("method")).obj)->data;
    const char *path = ((FLString *)fl_map_get(request, fl_str_val("path")).obj)->data;
    for (size_t i = 0; i < http_route_count; i++) {
        FLHttpRoute *route = &http_routes[i];
        if (strcmp(method, route->method) != 0) continue;
        if (route->is_static) {
            if (strncmp(path, route->pattern, strlen(route->pattern)) != 0) continue;
            return http_static_serve(route, path, status);
        }
        FLValue params;
        if (!http_match_path(route->pattern, path, &params)) continue;
        request = fl_map_set(request, fl_str_val("params"), params);
        *status = 200;
        FLValue response = fl_fn_call(route->handler, 1, &request);
        FLValue marker = fl_map_get(response, fl_str_val("_fl_http_response"));
        if (response.tag != FL_MAP || !fl_truthy(marker)) {
            *status = 500;
            return http_response(500, "application/json", fl_str_val("{\"error\":\"invalid response\"}"));
        }
        return response;
    }
    *status = 404;
    return http_response(404, "application/json", fl_str_val("{\"error\":\"not found\"}"));
}

static void http_handle_client(int fd) {
    FLValue request = fl_nil();
    int status = 400;
    (void)http_parse_request(fd, &request, &status);
    if (request.tag == FL_NIL) {
        const char *message = status == 408 ? "request timeout" :
            (status == 413 ? "payload too large" :
            (status == 431 ? "headers too large" : "bad request"));
        http_send_status(fd, status, message);
        return;
    }
    if (http_rate_limited()) {
        http_send_status(fd, 429, "rate limit exceeded");
        return;
    }
    FLValue response = http_dispatch(request, &status);
    FLValue body = fl_map_get(response, fl_str_val("body"));
    FLValue type = fl_map_get(response, fl_str_val("content_type"));
    FLValue location_value = fl_map_get(response, fl_str_val("location"));
    FLValue cookie_value = fl_map_get(response, fl_str_val("set_cookie"));
    const char *body_text = body.tag == FL_STRING && body.obj ? ((FLString *)body.obj)->data : "";
    const char *content_type = type.tag == FL_STRING && type.obj ? ((FLString *)type.obj)->data : "application/octet-stream";
    const char *location = location_value.tag == FL_STRING && location_value.obj
        ? ((FLString *)location_value.obj)->data : NULL;
    const char *cookie = cookie_value.tag == FL_STRING && cookie_value.obj
        ? ((FLString *)cookie_value.obj)->data : NULL;
    int response_status = fl_map_get(response, fl_str_val("status")).tag == FL_INT
        ? (int)fl_map_get(response, fl_str_val("status")).i : status;
    size_t body_length = body.tag == FL_STRING && body.obj ? ((FLString *)body.obj)->len : strlen(body_text);
    http_send_raw(fd, response_status, content_type, location, cookie, body_text, body_length);
}

static int http_timeout_setting(const char *name, int default_value) {
    const char *text = getenv(name);
    if (!text || !*text) return default_value;
    char *end = NULL;
    long value = strtol(text, &end, 10);
    if (!end || *end || value < 1 || value > 60000) {
        char message[128];
        snprintf(message, sizeof(message), "%s must be between 1 and 60000", name);
        fl_throw(fl_str_val(message));
    }
    return (int)value;
}

FLValue fl_http_start(FLValue port_value) {
    http_header_timeout_ms = http_timeout_setting("FL_HTTP_HEADER_TIMEOUT_MS", HTTP_DEFAULT_HEADER_TIMEOUT_MS);
    http_body_timeout_ms = http_timeout_setting("FL_HTTP_BODY_TIMEOUT_MS", HTTP_DEFAULT_BODY_TIMEOUT_MS);
    http_pool_workers = http_env_integer("FL_HTTP_WORKERS", 0, 0, HTTP_MAX_WORKERS);
    http_pool_max_requests = http_env_integer("FL_HTTP_WORKER_MAX_REQ", 10000, 1, INT_MAX);
    int port = port_value.tag == FL_INT ? (int)port_value.i : -1;
    const char *override = getenv("FL_HTTP_PORT");
    if (override && *override) {
        char *end = NULL;
        long parsed = strtol(override, &end, 10);
        if (end && !*end && parsed >= 0 && parsed <= 65535) port = (int)parsed;
    }
    if (port < 0 || port > 65535) {
        fl_throw(fl_str_val("HTTP port must be between 0 and 65535"));
    }
    int max_requests = 0;
    const char *max_env = getenv("FL_HTTP_MAX_REQUESTS");
    if (max_env && *max_env) {
        char *end = NULL;
        long parsed = strtol(max_env, &end, 10);
        if (!end || *end || parsed < 1 || parsed > 100000) {
            fl_throw(fl_str_val("FL_HTTP_MAX_REQUESTS must be a positive integer"));
        }
        max_requests = (int)parsed;
    }
    const char *conn_env = getenv("FL_HTTP_MAX_CONN");
    http_max_conn = 256;
    if (conn_env && *conn_env) {
        char *end = NULL;
        long parsed = strtol(conn_env, &end, 10);
        if (!end || *end || parsed < 1 || parsed > HTTP_MAX_WORKERS) {
            fl_throw(fl_str_val("FL_HTTP_MAX_CONN must be between 1 and 256"));
        }
        http_max_conn = (int)parsed;
    }

    int server = socket(AF_INET, SOCK_STREAM, 0);
    if (server < 0) return fl_nil();
    int reuse = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons((uint16_t)port);
    if (bind(server, (struct sockaddr *)&address, sizeof(address)) != 0 ||
        listen(server, HTTP_LISTEN_BACKLOG) != 0) {
        close(server);
        return fl_nil();
    }
    socklen_t address_length = sizeof(address);
    if (getsockname(server, (struct sockaddr *)&address, &address_length) != 0) {
        close(server);
        return fl_nil();
    }
    http_rate_shared = mmap(NULL, sizeof(*http_rate_shared), PROT_READ | PROT_WRITE,
                            MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    if (http_rate_shared == MAP_FAILED) {
        http_rate_shared = NULL;
        close(server);
        return fl_nil();
    }
    memset(http_rate_shared, 0, sizeof(*http_rate_shared));
    http_rate_shared->window_start = http_rate_window_start;
    printf("HTTP_LISTENING=127.0.0.1:%u\n", (unsigned)ntohs(address.sin_port));
    fprintf(stderr, "HTTP_LISTEN_BACKLOG=%d\n", HTTP_LISTEN_BACKLOG);
    fprintf(stderr, "HTTP_MAX_CONN=%d\n", http_max_conn);
    fprintf(stderr, "HTTP_WORKER_LIMIT=%d\n", http_worker_limit);
    fprintf(stderr, "FL_HTTP_WORKERS=%d\n", http_pool_workers);
    fprintf(stderr, "FL_HTTP_WORKER_MAX_REQ=%d\n", http_pool_max_requests);
    fflush(stdout);
    struct sigaction stop_action, child_action, old_int, old_term, old_child;
    memset(&stop_action, 0, sizeof(stop_action));
    stop_action.sa_handler = http_stop_signal;
    sigemptyset(&stop_action.sa_mask);
    memset(&child_action, 0, sizeof(child_action));
    child_action.sa_handler = http_child_signal;
    sigemptyset(&child_action.sa_mask);
    child_action.sa_flags = 0;
    http_stopping = 0;
    http_child_changed = 0;
    http_worker_count = 0;
    (void)sigaction(SIGINT, &stop_action, &old_int);
    (void)sigaction(SIGTERM, &stop_action, &old_term);
    (void)sigaction(SIGCHLD, &child_action, &old_child);
    if (http_pool_workers > 0) {
        http_run_pool(server, max_requests);
        close(server);
        http_stop_pool();
        fprintf(stderr, "HTTP_WORKER_RESTARTS_TOTAL=%u\n", http_pool_restarts);
        fprintf(stderr, "HTTP_ACTIVE_CONNECTIONS_MAX=%d\n",
                http_rate_shared->max_active_connections);
        (void)sigaction(SIGINT, &old_int, NULL);
        (void)sigaction(SIGTERM, &old_term, NULL);
        (void)sigaction(SIGCHLD, &old_child, NULL);
        (void)munmap(http_rate_shared, sizeof(*http_rate_shared));
        http_rate_shared = NULL;
        printf("HTTP_SERVER_STOPPED worker_pool=%d restarts=%u\n",
               http_pool_workers, http_pool_restarts);
        fflush(stdout);
        return fl_int(0);
    }
    int served = 0;
    while (!http_stopping && (max_requests == 0 || served < max_requests)) {
        if (http_child_changed) http_reap_workers();
        int client = accept(server, NULL, NULL);
        if (client < 0) {
            if (errno == EINTR || errno == ECONNABORTED || errno == EPROTO ||
                errno == EAGAIN || errno == EWOULDBLOCK) continue;
            if (errno == EMFILE || errno == ENFILE || errno == ENOBUFS || errno == ENOMEM) {
                struct timespec retry = {.tv_sec = 0, .tv_nsec = 10 * 1000 * 1000};
                while (nanosleep(&retry, &retry) != 0 && errno == EINTR && !http_stopping) {}
                continue;
            }
            break;
        }
        if (http_worker_count >= (size_t)http_worker_limit ||
            http_worker_count >= (size_t)http_max_conn) {
            http_send_busy(client);
            close(client);
            served++;
            continue;
        }
        pid_t worker = fork();
        if (worker == 0) {
            (void)setpgid(0, 0);
            close(server);
            (void)signal(SIGINT, SIG_DFL);
            (void)signal(SIGTERM, SIG_DFL);
            (void)signal(SIGCHLD, SIG_DFL);
            if (http_connection_enter()) {
                http_handle_client(client);
                (void)__sync_sub_and_fetch(&http_rate_shared->active_connections, 1);
            } else {
                http_send_busy(client);
            }
            close(client);
            _exit(0);
        }
        if (worker < 0) {
            http_send_busy(client);
            close(client);
        } else {
            (void)setpgid(worker, worker);
            http_workers[http_worker_count++] = worker;
            close(client);
        }
        served++;
    }
    close(server);
    http_stop_workers();
    fprintf(stderr, "HTTP_ACTIVE_CONNECTIONS_MAX=%d\n",
            http_rate_shared->max_active_connections);
    (void)sigaction(SIGINT, &old_int, NULL);
    (void)sigaction(SIGTERM, &old_term, NULL);
    (void)sigaction(SIGCHLD, &old_child, NULL);
    (void)munmap(http_rate_shared, sizeof(*http_rate_shared));
    http_rate_shared = NULL;
    printf("HTTP_SERVER_STOPPED requests=%d\n", served);
    fflush(stdout);
    return fl_int(served);
}

FLValue fl_http_stop(void) {
    http_stopping = 1;
    return fl_bool(true);
}
