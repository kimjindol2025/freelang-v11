#include "runtime.h"
#include "internal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/socket.h>
#include <poll.h>
#include <fcntl.h>
#include <time.h>
#include <limits.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <signal.h>
#include <errno.h>
#include <ctype.h>
#include <sys/select.h>

FLValue _fl_process_getcwd(void) {
    char buf[4096];
    if (!getcwd(buf, sizeof(buf))) return fl_nil();
    return fl_str_val(buf);
}
FLValue _fl_process_chdir(FLValue path) { return fl_bool(chdir(_strval(path)) == 0); }
FLValue _fl_process_pid(void)  { return fl_int((int64_t)getpid()); }
FLValue _fl_process_ppid(void) { return fl_int((int64_t)getppid()); }
FLValue _fl_process_kill(FLValue pid) { return fl_bool(kill((pid_t)pid.i, SIGTERM) == 0); }
FLValue _fl_process_exists(FLValue pid) { return fl_bool(kill((pid_t)pid.i, 0) == 0); }
FLValue _fl_process_wait(FLValue pid) {
    int status = 0;
    pid_t r = waitpid((pid_t)pid.i, &status, 0);
    return r < 0 ? fl_int(-1) : fl_int((int64_t)WEXITSTATUS(status));
}

/* popen으로 출력 캡처 — process-run */
FLValue _fl_process_run(FLValue cmd) {
    FILE* f = popen(_strval(cmd), "r");
    if (!f) return fl_nil();
    size_t sz = 0, cap = 4096;
    char* buf = malloc(cap);
    buf[0] = '\0';
    char tmp[1024];
    while (fgets(tmp, sizeof(tmp), f)) {
        size_t n = strlen(tmp);
        if (sz + n + 1 > cap) { cap = (sz + n + 1) * 2; buf = realloc(buf, cap); }
        memcpy(buf + sz, tmp, n); sz += n; buf[sz] = '\0';
    }
    pclose(f);
    FLValue r = fl_str_val(buf); free(buf); return r;
}

/* args 배열을 공백으로 join 후 popen */
FLValue _fl_process_run_args(FLValue cmd, FLValue args) {
    char full[8192];
    snprintf(full, sizeof(full), "%s", _strval(cmd));
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            strncat(full, " ", sizeof(full) - strlen(full) - 1);
            strncat(full, _strval(v->data[i]), sizeof(full) - strlen(full) - 1);
        }
    }
    return _fl_process_run(fl_str_val(full));
}

/* system()으로 상속 stdio 실행 */
FLValue _fl_run_inherit(FLValue cmd) {
    int r = system(_strval(cmd));
    return fl_int((int64_t)(r >= 0 ? WEXITSTATUS(r) : -1));
}

/* Keep the compiler's syntax gate on argv so output paths never pass through a shell. */
FLValue fl_gcc_syntax_check(FLValue source, FLValue include_dir) {
    if (source.tag != FL_STRING || include_dir.tag != FL_STRING)
        return fl_int(-1);
    char runtime_include[PATH_MAX];
    const char *include = _strval(include_dir);
    char header_path[PATH_MAX];
    snprintf(header_path, sizeof(header_path), "%s/runtime.h", include);
    if (access(header_path, R_OK) != 0) {
        const char *slash = strrchr(__FILE__, '/');
        size_t dir_len = slash ? (size_t)(slash - __FILE__) : 0;
        if (!dir_len || dir_len >= sizeof(runtime_include)) return fl_int(-1);
        memcpy(runtime_include, __FILE__, dir_len);
        runtime_include[dir_len] = '\0';
        snprintf(header_path, sizeof(header_path), "%s/runtime.h", runtime_include);
        if (access(header_path, R_OK) != 0) return fl_int(-1);
        include = runtime_include;
    }
    pid_t pid = fork();
    if (pid < 0) return fl_int(-1);
    if (pid == 0) {
        char *const argv[] = {
            (char *)"gcc", (char *)"-fsyntax-only", (char *)"-I", (char *)include,
            (char *)_strval(source), NULL
        };
        execvp(argv[0], argv);
        _exit(127);
    }
    int status = 0;
    pid_t waited;
    do { waited = waitpid(pid, &status, 0); } while (waited < 0 && errno == EINTR);
    if (waited != pid || !WIFEXITED(status)) return fl_int(-1);
    return fl_int(WEXITSTATUS(status));
}

/* process-exec: 현재 프로세스를 cmd로 교체 (execvp) */
FLValue _fl_process_exec(FLValue cmd) {
    char buf[4096]; strncpy(buf, _strval(cmd), sizeof(buf)-1); buf[4095]='\0';
    char* argv[256]; int argc = 0;
    char* tok = strtok(buf, " \t");
    while (tok && argc < 255) { argv[argc++] = tok; tok = strtok(NULL, " \t"); }
    argv[argc] = NULL;
    execvp(argv[0], argv);
    return fl_int(-1); /* execvp 실패 시만 도달 */
}

FLValue _fl_process_exec_args(FLValue cmd, FLValue args) {
    char full[8192]; snprintf(full, sizeof(full), "%s", _strval(cmd));
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            strncat(full, " ", sizeof(full)-strlen(full)-1);
            strncat(full, _strval(v->data[i]), sizeof(full)-strlen(full)-1);
        }
    }
    return _fl_process_exec(fl_str_val(full));
}

/* fork + exec → 자식 PID 반환 */
FLValue _fl_process_spawn(FLValue cmd, FLValue args) {
    char full[8192]; snprintf(full, sizeof(full), "%s", _strval(cmd));
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len; i++) {
            strncat(full, " ", sizeof(full)-strlen(full)-1);
            strncat(full, _strval(v->data[i]), sizeof(full)-strlen(full)-1);
        }
    }
    pid_t pid = fork();
    if (pid < 0) return fl_int(-1);
    if (pid == 0) { /* 자식 */
        _fl_process_exec(fl_str_val(full));
        _exit(1);
    }
    return fl_int((int64_t)pid);
}

/* ── capability registry (bootstrap.js defaults) ── */
static struct { const char* name; int enabled; } fl_caps[] = {
    {"tcp", 1}, {"file", 1}, {"http", 1}, {"db", 1}, {"process", 1}
};
static const int fl_caps_n = 5;

static int fl_cap_find(const char* name) {
    for (int i = 0; i < fl_caps_n; i++)
        if (strcmp(fl_caps[i].name, name) == 0) return i;
    return -1;
}

static const char* fl_cstr(FLValue v) {
    if (v.tag == FL_STRING && v.obj) return ((FLString*)v.obj)->data;
    return "";
}

FLValue capability_list(void) {
    FLValue r = fl_vec_new();
    for (int i = 0; i < fl_caps_n; i++) r = fl_vec_push(r, fl_str_val(fl_caps[i].name));
    return r;
}

FLValue capability_enable(FLValue name) {
    int i = fl_cap_find(fl_cstr(name));
    if (i < 0) return fl_str_val("not-found");
    fl_caps[i].enabled = 1;
    return fl_str_val("ok");
}

FLValue capability_disable(FLValue name) {
    int i = fl_cap_find(fl_cstr(name));
    if (i < 0) return fl_str_val("not-found");
    fl_caps[i].enabled = 0;
    return fl_str_val("ok");
}

FLValue capability_enabled_p(FLValue name) {
    int i = fl_cap_find(fl_cstr(name));
    return fl_bool(i >= 0 && fl_caps[i].enabled);
}

static void fl_cap_require(const char* name) {
    int i = fl_cap_find(name);
    if (i < 0 || !fl_caps[i].enabled) {
        char msg[128];
        snprintf(msg, sizeof msg, "capability denied: %s", name);
        fl_throw(fl_str_val(msg));
    }
}

#include "http_transport.inc"

static FLValue fl_ok(FLValue value) {
    FLValue kv[4] = { fl_str_val("_tag"), fl_str_val("Ok"), fl_str_val("value"), value };
    return fl_map_from_pairs(kv, 2);
}

static FLValue fl_err(const char* code) {
    FLValue kv[4] = { fl_str_val("_tag"), fl_str_val("Error"), fl_str_val("code"), fl_str_val(code) };
    return fl_map_from_pairs(kv, 2);
}

static char* fl_read_fd(int fd) {
    size_t n = 0, cap = 256;
    char* buf = malloc(cap);
    buf[0] = 0;
    char tmp[512];
    ssize_t r;
    while ((r = read(fd, tmp, sizeof tmp)) > 0) {
        if (n + (size_t)r + 1 > cap) { cap = (n + (size_t)r + 1) * 2; buf = realloc(buf, cap); }
        memcpy(buf + n, tmp, (size_t)r); n += (size_t)r; buf[n] = 0;
    }
    return buf;
}

FLValue process_spawn(FLValue cmd, FLValue args) {
    fl_cap_require("process");
    const char* c = fl_cstr(cmd);
    if (!c[0]) return fl_err("E_PROCESS_SPAWN");
    char* argv[256];
    int argc = 0;
    argv[argc++] = (char*)c;
    if (args.tag == FL_VECTOR) {
        FLVector* v = (FLVector*)args.obj;
        for (uint32_t i = 0; i < v->len && argc < 254; i++)
            argv[argc++] = (char*)fl_cstr(v->data[i]);
    }
    argv[argc] = NULL;
    int outp[2], errp[2];
    if (pipe(outp) != 0 || pipe(errp) != 0) return fl_err("E_PROCESS_SPAWN");
    pid_t pid = fork();
    if (pid < 0) { close(outp[0]); close(outp[1]); close(errp[0]); close(errp[1]); return fl_err("E_PROCESS_SPAWN"); }
    if (pid == 0) {
        dup2(outp[1], 1); dup2(errp[1], 2);
        close(outp[0]); close(outp[1]); close(errp[0]); close(errp[1]);
        execvp(argv[0], argv);
        _exit(127);
    }
    close(outp[1]); close(errp[1]);
    /* Drain stdout and stderr together so a child that fills stderr
       (e.g. cat gcc.log) cannot deadlock against a parent that reads
       stdout to EOF first. */
    char *out = (char*)malloc(1); size_t olen = 0; out[0] = '\0';
    char *err = (char*)malloc(1); size_t elen = 0; err[0] = '\0';
    int oopen = 1, eopen = 1;
    while (oopen || eopen) {
        fd_set rfds;
        FD_ZERO(&rfds);
        int maxfd = -1;
        if (oopen) { FD_SET(outp[0], &rfds); maxfd = outp[0]; }
        if (eopen) { FD_SET(errp[0], &rfds); if (errp[0] > maxfd) maxfd = errp[0]; }
        if (select(maxfd + 1, &rfds, NULL, NULL, NULL) < 0) {
            if (errno == EINTR) continue;
            break;
        }
        char buf[4096];
        if (oopen && FD_ISSET(outp[0], &rfds)) {
            ssize_t n = read(outp[0], buf, sizeof buf);
            if (n <= 0) oopen = 0;
            else {
                char *p = (char*)realloc(out, olen + (size_t)n + 1);
                if (!p) break;
                out = p;
                memcpy(out + olen, buf, (size_t)n);
                olen += (size_t)n;
                out[olen] = '\0';
            }
        }
        if (eopen && FD_ISSET(errp[0], &rfds)) {
            ssize_t n = read(errp[0], buf, sizeof buf);
            if (n <= 0) eopen = 0;
            else {
                char *p = (char*)realloc(err, elen + (size_t)n + 1);
                if (!p) break;
                err = p;
                memcpy(err + elen, buf, (size_t)n);
                elen += (size_t)n;
                err[elen] = '\0';
            }
        }
    }
    close(outp[0]); close(errp[0]);
    int st = 0;
    pid_t waited;
    do { waited = waitpid(pid, &st, 0); } while (waited < 0 && errno == EINTR);
    int sig = waited >= 0 && WIFSIGNALED(st) ? WTERMSIG(st) : 0;
    int code = waited < 0 ? 1 : (WIFEXITED(st) ? WEXITSTATUS(st) : 128 + sig);
    FLValue kv[8] = {
        fl_str_val("stdout"), fl_str_val(out),
        fl_str_val("stderr"), fl_str_val(err),
        fl_str_val("code"), fl_int(code),
        fl_str_val("signal"), sig ? fl_int(sig) : fl_nil()
    };
    free(out); free(err);
    return fl_ok(fl_map_from_pairs(kv, 4));
}

/* OS boundary only: the FreeLang callback owns assertions and JSON encoding.
   A fatal runtime error, signal, missing payload or timeout cannot become PASS. */
FLValue _fl_test_isolate(FLValue callback) {
    int fds[2];
    if (callback.tag != FL_FN || pipe(fds) != 0) return fl_err("TEST_PROCESS");
    fflush(NULL);
    pid_t pid = fork();
    if (pid < 0) { close(fds[0]); close(fds[1]); return fl_err("TEST_PROCESS"); }
    if (pid == 0) {
        close(fds[0]);
        alarm(10);
        FLValue result = fl_fn_call(callback, 0, NULL);
        if (result.tag != FL_STRING || !result.obj) _exit(2);
        const char *p = fl_cstr(result);
        size_t left = strlen(p);
        if (!left || left > 1048576) _exit(2);
        while (left) {
            ssize_t n = write(fds[1], p, left);
            if (n < 0 && errno == EINTR) continue;
            if (n <= 0) _exit(2);
            left -= (size_t)n; p += n;
        }
        close(fds[1]);
        _exit(0);
    }
    close(fds[1]);
    char *buf = malloc(1048577);
    size_t used = 0;
    int failed = !buf;
    while (!failed) {
        fd_set set; FD_ZERO(&set); FD_SET(fds[0], &set);
        struct timeval tv = {10, 0};
        int ready = select(fds[0] + 1, &set, NULL, NULL, &tv);
        if (ready < 0 && errno == EINTR) continue;
        if (ready <= 0) { failed = 1; break; }
        char part[4096];
        ssize_t n = read(fds[0], part, sizeof part);
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 || used + (size_t)n > 1048576) { failed = 1; break; }
        if (n == 0) break;
        memcpy(buf + used, part, (size_t)n); used += (size_t)n;
    }
    close(fds[0]);
    if (failed) kill(pid, SIGKILL);
    int status = 0;
    pid_t waited;
    do { waited = waitpid(pid, &status, 0); } while (waited < 0 && errno == EINTR);
    FLValue result = fl_err("TEST_PROCESS");
    if (!failed && waited == pid && WIFEXITED(status) && WEXITSTATUS(status) == 0 && used) {
        buf[used] = '\0'; result = fl_ok(fl_str_val(buf));
    }
    free(buf);
    return result;
}

FLValue _fl_exit(FLValue code) {
    exit(code.tag == FL_INT ? (int)code.i : 1);
    return fl_nil();
}

static FLValue git_finish(FLValue spawned) {
    if (spawned.tag != FL_MAP) return fl_err("E_GIT");
    FLValue tag = fl_map_get(spawned, fl_str_val("_tag"));
    if (!(tag.tag == FL_STRING && tag.obj && strcmp(((FLString*)tag.obj)->data, "Ok") == 0))
        return spawned;
    FLValue value = fl_map_get(spawned, fl_str_val("value"));
    FLValue code = fl_map_get(value, fl_str_val("code"));
    if (code.tag == FL_INT && code.i == 0) return spawned;
    return fl_err("E_GIT");
}

static FLValue git_run(FLValue root, const char* a, const char* b) {
    fl_cap_require("process");
    FLValue args = fl_vec_new();
    if (fl_cstr(root)[0]) {
        args = fl_vec_push(args, fl_str_val("-C"));
        args = fl_vec_push(args, root);
    }
    args = fl_vec_push(args, fl_str_val(a));
    if (b) args = fl_vec_push(args, fl_str_val(b));
    return git_finish(process_spawn(fl_str_val("git"), args));
}

FLValue git_status(FLValue root) { return git_run(root, "status", "--porcelain"); }
FLValue git_head(FLValue root) { return git_run(root, "rev-parse", "HEAD"); }
FLValue git_branch(FLValue root) {
    FLValue args = fl_vec_new();
    if (fl_cstr(root)[0]) {
        args = fl_vec_push(args, fl_str_val("-C"));
        args = fl_vec_push(args, root);
    }
    args = fl_vec_push(args, fl_str_val("rev-parse"));
    args = fl_vec_push(args, fl_str_val("--abbrev-ref"));
    args = fl_vec_push(args, fl_str_val("HEAD"));
    return git_finish(process_spawn(fl_str_val("git"), args));
}
FLValue git_diff_name_only(FLValue root) { return git_run(root, "diff", "--name-only"); }

FLValue shell_cwd(void) { return _fl_process_getcwd(); }

static int fl_http_parse_url(const char* url, char* host, size_t hs, char* path, size_t ps, int* port) {
    if (strncmp(url, "http://", 7) != 0) return -1;
    const char* p = url + 7;
    const char* slash = strchr(p, '/');
    const char* colon = strchr(p, ':');
    *port = 80;
    if (colon && (!slash || colon < slash)) {
        size_t n = (size_t)(colon - p);
        if (n >= hs) n = hs - 1;
        memcpy(host, p, n); host[n] = 0;
        *port = atoi(colon + 1);
    } else {
        size_t n = slash ? (size_t)(slash - p) : strlen(p);
        if (n >= hs) n = hs - 1;
        memcpy(host, p, n); host[n] = 0;
    }
    if (slash) snprintf(path, ps, "%s", slash);
    else snprintf(path, ps, "/");
    return 0;
}

FLValue http_get(FLValue url) {
    fl_cap_require("http");
    const char* u = fl_cstr(url);
    char host[256], path[1024];
    int port = 80;
    FLValue errm = fl_map_new();
    errm = fl_map_set(errm, fl_str_val("status"), fl_int(0));
    errm = fl_map_set(errm, fl_str_val("body"), fl_str_val(""));
    if (fl_http_parse_url(u, host, sizeof host, path, sizeof path, &port) != 0) {
        return fl_map_set(errm, fl_str_val("error"), fl_str_val("unsupported url"));
    }
    struct addrinfo hints, *res = NULL;
    memset(&hints, 0, sizeof hints);
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_family = AF_UNSPEC;
    char portstr[16];
    snprintf(portstr, sizeof portstr, "%d", port);
    if (getaddrinfo(host, portstr, &hints, &res) != 0) {
        return fl_map_set(errm, fl_str_val("error"), fl_str_val("getaddrinfo failed"));
    }
    int fd = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (fd < 0) { freeaddrinfo(res); return fl_map_set(errm, fl_str_val("error"), fl_str_val("socket failed")); }
    if (connect(fd, res->ai_addr, res->ai_addrlen) != 0) {
        char em[128];
        snprintf(em, sizeof em, "connect ECONNREFUSED %s:%d", host, port);
        close(fd); freeaddrinfo(res);
        return fl_map_set(errm, fl_str_val("error"), fl_str_val(em));
    }
    freeaddrinfo(res);
    char req[1400];
    snprintf(req, sizeof req, "GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n", path, host);
    if (write(fd, req, strlen(req)) < 0) { close(fd); return fl_map_set(errm, fl_str_val("error"), fl_str_val("write failed")); }
    char* raw = fl_read_fd(fd);
    close(fd);
    char* hdrend = strstr(raw, "\r\n\r\n");
    int status = 0;
    const char* body = "";
    if (hdrend) {
        sscanf(raw, "HTTP/%*s %d", &status);
        body = hdrend + 4;
    } else body = raw;
    FLValue out = fl_map_new();
    out = fl_map_set(out, fl_str_val("status"), fl_int(status));
    out = fl_map_set(out, fl_str_val("body"), fl_str_val(body));
    free(raw);
    return out;
}

FLValue fl_http_get(FLValue url) { return http_get(url); }

/* Loopback test sockets use monotonically increasing handles, never raw fds.
 * Closed handles cannot accidentally close a subsequently reused descriptor. */
typedef struct FLTcpSocket { int64_t id; int fd, listening; struct FLTcpSocket *next; } FLTcpSocket;
static FLTcpSocket *tcp_sockets;
static int64_t tcp_next_id = 1;
static FLValue tcp_error(const char *code) {
    FLValue error = fl_map_set(fl_map_new(), fl_str_val("code"), fl_str_val(code));
    return fl_map_set(fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(false)), fl_str_val("error"), error);
}
static FLTcpSocket *tcp_lookup(FLValue handle) {
    if (handle.tag != FL_INT) return NULL;
    for (FLTcpSocket *s = tcp_sockets; s; s = s->next) if (s->id == handle.i) return s;
    return NULL;
}
static FLValue tcp_register(int fd, int listening) {
    FLTcpSocket *s = malloc(sizeof(*s));
    if (!s || tcp_next_id == INT64_MAX) { free(s); close(fd); return tcp_error("RESOURCE"); }
    s->id = tcp_next_id++; s->fd = fd; s->listening = listening;
    s->next = tcp_sockets; tcp_sockets = s;
    return fl_int(s->id);
}
FLValue fl_tcp_bind(FLValue address, FLValue port) {
    fl_cap_require("tcp");
    if (address.tag != FL_STRING || !address.obj || port.tag != FL_INT || port.i < 0 || port.i > 65535)
        return tcp_error("INVALID_ARGUMENT");
    FLString *text = (FLString *)address.obj;
    if (strcmp(text->data, "127.0.0.1") != 0 || length(address).i != 9) return tcp_error("ADDRESS");
    int fd = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
    if (fd < 0) return tcp_error("SOCKET");
    struct sockaddr_in target = {0};
    target.sin_family = AF_INET; target.sin_port = htons((uint16_t)port.i);
    target.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(fd, (struct sockaddr *)&target, sizeof target) != 0) { close(fd); return tcp_error("BIND"); }
    return tcp_register(fd, 0);
}
FLValue fl_tcp_close(FLValue handle) {
    FLTcpSocket *s = tcp_lookup(handle);
    if (!s) return tcp_error("INVALID_SOCKET");
    FLTcpSocket **link = &tcp_sockets;
    while (*link != s) link = &(*link)->next;
    *link = s->next;
    int result = close(s->fd); free(s);
    return result == 0 ? fl_bool(true) : tcp_error("CLOSE");
}
FLValue fl_tcp_listen(FLValue address, FLValue port) {
    FLValue handle = fl_tcp_bind(address, port);
    FLTcpSocket *s = tcp_lookup(handle);
    if (!s) return handle;
    if (listen(s->fd, 32) != 0) { fl_tcp_close(handle); return tcp_error("LISTEN"); }
    s->listening = 1;
    return handle;
}
FLValue fl_tcp_local_port(FLValue handle) {
    FLTcpSocket *s = tcp_lookup(handle);
    if (!s) return tcp_error("INVALID_SOCKET");
    struct sockaddr_in address; socklen_t size = sizeof address;
    if (getsockname(s->fd, (struct sockaddr *)&address, &size) != 0) return tcp_error("SOCKET");
    return fl_int(ntohs(address.sin_port));
}
FLValue fl_tcp_accept(FLValue handle, FLValue timeout) {
    FLTcpSocket *s = tcp_lookup(handle);
    if (!s || !s->listening) return tcp_error("INVALID_SOCKET");
    if (timeout.tag != FL_INT || timeout.i < 0 || timeout.i > 60000) return tcp_error("INVALID_ARGUMENT");
    /* Monotonic deadline preserves the upper bound across interrupted polls. */
    struct timespec now;
    if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return tcp_error("SOCKET");
    int64_t deadline = now.tv_sec * 1000LL + now.tv_nsec / 1000000 + timeout.i;
    int remaining = (int)timeout.i;
    struct pollfd p = {s->fd, POLLIN, 0};
    for (;;) {
        int result = poll(&p, 1, remaining);
        if (result == 0) return tcp_error("TIMEOUT");
        if (result > 0) break;
        if (errno != EINTR || clock_gettime(CLOCK_MONOTONIC, &now) != 0) return tcp_error("ACCEPT");
        int64_t left = deadline - (now.tv_sec * 1000LL + now.tv_nsec / 1000000);
        if (left <= 0) return tcp_error("TIMEOUT");
        remaining = (int)left;
    }
    if (!(p.revents & POLLIN)) return tcp_error("ACCEPT");
    int fd = accept(s->fd, NULL, NULL);
    if (fd < 0) return tcp_error(errno == EAGAIN || errno == EWOULDBLOCK ? "TIMEOUT" : "ACCEPT");
    if (fcntl(fd, F_SETFD, FD_CLOEXEC) < 0) { close(fd); return tcp_error("ACCEPT"); }
    return tcp_register(fd, 0);
}

/* ── try/catch 런타임 ── */
extern FLTryFrame fl_try_stack[FL_TRY_MAX];
extern int fl_try_top;
