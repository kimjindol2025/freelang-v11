#define _GNU_SOURCE
#define _POSIX_C_SOURCE 200809L
#include "runtime.h"
#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define HTTP_ROUTE_MAX 128
#define HTTP_HEADER_MAX 65536
#define HTTP_DEFAULT_BODY_LIMIT (1024 * 1024)
#define HTTP_MAX_WORKERS 128

typedef struct {
    char method[16];
    char *pattern;
    FLValue handler;
} FLHttpRoute;

static FLHttpRoute http_routes[HTTP_ROUTE_MAX];
static size_t http_route_count = 0;
static size_t http_body_limit = HTTP_DEFAULT_BODY_LIMIT;
static int http_rate_max = 0;
static int64_t http_rate_window_ms = 0;
static int64_t http_rate_window_start = 0;
static int http_rate_count = 0;
static volatile sig_atomic_t http_stopping = 0;
static volatile sig_atomic_t http_child_changed = 0;
static int http_worker_limit = 8;
static pid_t http_workers[HTTP_MAX_WORKERS];
static size_t http_worker_count = 0;
typedef struct {
    volatile int lock;
    int64_t window_start;
    int count;
} FLHttpRateState;
static FLHttpRateState *http_rate_shared;
static int64_t http_now_ms(void);

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

static void http_wait_for_worker_slot(void) {
    while (http_worker_count >= (size_t)http_worker_limit && !http_stopping) {
        http_child_changed = 0;
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
        } else {
            http_reap_workers();
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
        fl_throw(fl_str_val("HTTP worker count must be between 1 and 128"));
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
        case 404: return "Not Found";
        case 413: return "Payload Too Large";
        case 429: return "Too Many Requests";
        case 500: return "Internal Server Error";
        case 503: return "Service Unavailable";
        default: return "Response";
    }
}

static void http_send_raw(int fd, int status, const char *content_type,
                          const char *location, const char *body, size_t body_length) {
    char header[512];
    char location_header[256] = "";
    if (location) snprintf(location_header, sizeof(location_header), "Location: %s\r\n", location);
    int length = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %zu\r\n%s"
        "Connection: close\r\nX-Freelang: native\r\n\r\n",
        status, http_reason(status), content_type, body_length, location_header);
    if (length < 0 || (size_t)length >= sizeof(header)) return;
    if (length > 0) http_send_all(fd, header, (size_t)length);
    if (body_length) http_send_all(fd, body, body_length);
}

static void http_send_status(int fd, int status, const char *message) {
    char body[256];
    int length = snprintf(body, sizeof(body), "{\"error\":\"%s\"}", message);
    if (length < 0) return;
    http_send_raw(fd, status, "application/json", NULL, body, (size_t)length);
}

static char *http_trim(char *value) {
    while (*value && isspace((unsigned char)*value)) value++;
    char *end = value + strlen(value);
    while (end > value && isspace((unsigned char)end[-1])) *--end = '\0';
    return value;
}

static int http_read_headers(int fd, char *buffer, size_t capacity,
                             size_t *received, size_t *header_length) {
    *received = 0;
    buffer[0] = '\0';
    while (*received < capacity - 1) {
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
    return -1;
}

static FLValue http_parse_request(int fd, FLValue *out_request, int *out_status) {
    char buffer[HTTP_HEADER_MAX + 1];
    size_t received = 0, header_length = 0;
    if (http_read_headers(fd, buffer, sizeof(buffer), &received, &header_length) != 0) {
        *out_status = 400;
        return fl_nil();
    }
    char *header_end = strstr(buffer, "\r\n\r\n");
    if (!header_end) { *out_status = 400; return fl_nil(); }
    *header_end = '\0';
    char *line_end = strstr(buffer, "\r\n");
    if (!line_end) { *out_status = 400; return fl_nil(); }
    *line_end = '\0';
    char method[16], target[2048], version[16];
    if (sscanf(buffer, "%15s %2047s %15s", method, target, version) != 3 ||
        strncmp(version, "HTTP/1.", 7) != 0) {
        *out_status = 400;
        return fl_nil();
    }

    FLValue headers = fl_map_new();
    size_t body_length = 0;
    int has_transfer_encoding = 0;
    char *cursor = line_end + 2;
    while (cursor && *cursor) {
        char *next = strstr(cursor, "\r\n");
        if (next) *next = '\0';
        char *colon = strchr(cursor, ':');
        if (colon) {
            *colon = '\0';
            char *name = http_trim(cursor);
            char *value = http_trim(colon + 1);
            for (char *p = name; *p; p++) *p = (char)tolower((unsigned char)*p);
            headers = fl_map_set(headers, fl_str_val(name), fl_str_val(value));
            if (strcmp(name, "content-length") == 0) {
                char *end = NULL;
                unsigned long long parsed = strtoull(value, &end, 10);
                if (!end || *end || parsed > (unsigned long long)SIZE_MAX) {
                    *out_status = 400;
                    return fl_nil();
                }
                body_length = (size_t)parsed;
            } else if (strcmp(name, "transfer-encoding") == 0) {
                has_transfer_encoding = 1;
            }
        }
        if (!next) break;
        cursor = next + 2;
    }
    if (has_transfer_encoding) { *out_status = 400; return fl_nil(); }
    if (body_length > http_body_limit) { *out_status = 413; return fl_nil(); }

    size_t body_available = received - header_length;
    size_t body_received = body_available < body_length ? body_available : body_length;
    char *body = malloc(body_length + 1);
    if (!body) { *out_status = 500; return fl_nil(); }
    if (body_received) memcpy(body, buffer + header_length, body_received);
    while (body_received < body_length) {
        ssize_t n = recv(fd, body + body_received, body_length - body_received, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) { free(body); *out_status = 400; return fl_nil(); }
        body_received += (size_t)n;
    }
    body[body_length] = '\0';

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

static FLValue http_dispatch(FLValue request, int *status) {
    const char *method = ((FLString *)fl_map_get(request, fl_str_val("method")).obj)->data;
    const char *path = ((FLString *)fl_map_get(request, fl_str_val("path")).obj)->data;
    for (size_t i = 0; i < http_route_count; i++) {
        FLHttpRoute *route = &http_routes[i];
        if (strcmp(method, route->method) != 0) continue;
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
        http_send_status(fd, status, status == 413 ? "payload too large" : "bad request");
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
    const char *body_text = body.tag == FL_STRING && body.obj ? ((FLString *)body.obj)->data : "";
    const char *content_type = type.tag == FL_STRING && type.obj ? ((FLString *)type.obj)->data : "application/octet-stream";
    const char *location = location_value.tag == FL_STRING && location_value.obj
        ? ((FLString *)location_value.obj)->data : NULL;
    int response_status = fl_map_get(response, fl_str_val("status")).tag == FL_INT
        ? (int)fl_map_get(response, fl_str_val("status")).i : status;
    http_send_raw(fd, response_status, content_type, location, body_text, strlen(body_text));
}

FLValue fl_http_start(FLValue port_value) {
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

    int server = socket(AF_INET, SOCK_STREAM, 0);
    if (server < 0) return fl_nil();
    int reuse = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons((uint16_t)port);
    if (bind(server, (struct sockaddr *)&address, sizeof(address)) != 0 || listen(server, 32) != 0) {
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
    fflush(stdout);
    struct sigaction stop_action, child_action, old_int, old_term, old_child;
    memset(&stop_action, 0, sizeof(stop_action));
    stop_action.sa_handler = http_stop_signal;
    sigemptyset(&stop_action.sa_mask);
    memset(&child_action, 0, sizeof(child_action));
    child_action.sa_handler = http_child_signal;
    sigemptyset(&child_action.sa_mask);
    http_stopping = 0;
    http_child_changed = 0;
    http_worker_count = 0;
    (void)sigaction(SIGINT, &stop_action, &old_int);
    (void)sigaction(SIGTERM, &stop_action, &old_term);
    (void)sigaction(SIGCHLD, &child_action, &old_child);
    int served = 0;
    while (!http_stopping && (max_requests == 0 || served < max_requests)) {
        if (http_child_changed) http_reap_workers();
        http_wait_for_worker_slot();
        if (http_stopping) break;
        int client = accept(server, NULL, NULL);
        if (client < 0) {
            if (errno == EINTR) continue;
            break;
        }
        pid_t worker = fork();
        if (worker == 0) {
            (void)setpgid(0, 0);
            close(server);
            (void)signal(SIGINT, SIG_DFL);
            (void)signal(SIGTERM, SIG_DFL);
            (void)signal(SIGCHLD, SIG_DFL);
            http_handle_client(client);
            close(client);
            _exit(0);
        }
        if (worker < 0) {
            http_send_status(client, 503, "server busy");
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
