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
#include <sys/random.h>
#include <math.h>

FLValue format_date(FLValue timestamp_ms, FLValue format_value) {
    if ((timestamp_ms.tag != FL_INT && timestamp_ms.tag != FL_FLOAT) ||
        format_value.tag != FL_STRING || !format_value.obj)
        fl_throw(fl_str_val("format_date expects timestamp and format string"));
    double milliseconds = timestamp_ms.tag == FL_INT ? (double)timestamp_ms.i : timestamp_ms.f;
    if (!isfinite(milliseconds) || milliseconds < (double)INT64_MIN * 1000.0 ||
        milliseconds > (double)INT64_MAX * 1000.0)
        fl_throw(fl_str_val("format_date timestamp out of range"));
    double seconds = floor(milliseconds / 1000.0);
    time_t epoch = (time_t)seconds;
    struct tm date;
    if (!localtime_r(&epoch, &date)) fl_throw(fl_str_val("format_date timestamp out of range"));
    int ms = (int)(milliseconds - seconds * 1000.0);
    char values[7][16];
    snprintf(values[0], sizeof(values[0]), "%04d", date.tm_year + 1900);
    snprintf(values[1], sizeof(values[1]), "%02d", date.tm_mon + 1);
    snprintf(values[2], sizeof(values[2]), "%02d", date.tm_mday);
    snprintf(values[3], sizeof(values[3]), "%02d", date.tm_hour);
    snprintf(values[4], sizeof(values[4]), "%02d", date.tm_min);
    snprintf(values[5], sizeof(values[5]), "%02d", date.tm_sec);
    snprintf(values[6], sizeof(values[6]), "%03d", ms);
    static const char *tokens[] = { "YYYY", "MM", "DD", "HH", "mm", "ss", "SSS" };
    size_t token_lengths[] = { 4, 2, 2, 2, 2, 2, 3 };
    int replaced[7] = {0};
    FLString *format = (FLString *)format_value.obj;
    if (format->len > 4096) fl_throw(fl_str_val("format_date format too long"));
    size_t capacity = (size_t)format->len + 64;
    char *output = malloc(capacity);
    if (!output) fl_throw(fl_str_val("format_date allocation failed"));
    size_t i = 0, used = 0;
    while (i < format->len) {
        int match = -1;
        for (int t = 0; t < 7; t++)
            if (!replaced[t] && i + token_lengths[t] <= format->len &&
                memcmp(format->data + i, tokens[t], token_lengths[t]) == 0) { match = t; break; }
        if (match >= 0) {
            size_t length = strlen(values[match]);
            memcpy(output + used, values[match], length);
            used += length; i += token_lengths[match]; replaced[match] = 1;
        } else output[used++] = format->data[i++];
    }
    output[used] = '\0';
    FLValue result = fl_str_val(output);
    free(output);
    return result;
}

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
    char* buf = fl_malloc(cap);
    buf[0] = '\0';
    char tmp[1024];
    while (fgets(tmp, sizeof(tmp), f)) {
        size_t n = strlen(tmp);
        if (sz + n + 1 > cap) { cap = (sz + n + 1) * 2; buf = fl_realloc(buf, cap); }
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
    char* buf = fl_malloc(cap);
    buf[0] = 0;
    char tmp[512];
    ssize_t r;
    while ((r = read(fd, tmp, sizeof tmp)) > 0) {
        if (n + (size_t)r + 1 > cap) { cap = (n + (size_t)r + 1) * 2; buf = fl_realloc(buf, cap); }
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
    char *out = (char*)fl_malloc(1); size_t olen = 0; out[0] = '\0';
    char *err = (char*)fl_malloc(1); size_t elen = 0; err[0] = '\0';
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
                char *p = (char*)fl_realloc(out, olen + (size_t)n + 1);
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
                char *p = (char*)fl_realloc(err, elen + (size_t)n + 1);
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

FLValue shell(FLValue command) {
    FLValue args[2] = { fl_str_val("-c"), command };
    FLValue result = process_spawn(fl_str_val("sh"), fl_vec_from(args, 2));
    FLValue tag = fl_map_get(result, fl_str_val("_tag"));
    if (tag.tag != FL_STRING || strcmp(((FLString *)tag.obj)->data, "Ok") != 0)
        fl_throw(result);
    FLValue value = fl_map_get(result, fl_str_val("value"));
    FLValue code = fl_map_get(value, fl_str_val("code"));
    if (code.tag != FL_INT || code.i != 0) fl_throw(fl_map_get(value, fl_str_val("stderr")));
    return fl_map_get(value, fl_str_val("stdout"));
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
    char *buf = fl_malloc(1048577);
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

#define FL_PARALLEL_LIMIT 8
#define FL_PARALLEL_RESULT_MAX (2u * 1024u * 1024u)
#define FL_PARALLEL_TIMEOUT_MS 5000

static int fl_parallel_json_size(FLValue v, size_t *size, unsigned depth) {
    if (depth > 256) return 0;
    size_t n = 0;
    char number[64];
    if (v.tag == FL_NIL) n = 4;
    else if (v.tag == FL_BOOL) n = v.b ? 4 : 5;
    else if (v.tag == FL_INT) {
        int k = snprintf(number, sizeof number, "%lld", (long long)v.i);
        if (k < 0) return 0;
        n = (size_t)k;
    } else if (v.tag == FL_FLOAT) {
        if (!isfinite(v.f)) return 0;
        int k = snprintf(number, sizeof number, "%.17g", v.f);
        if (k < 0) return 0;
        n = (size_t)k;
    } else if (v.tag == FL_STRING && v.obj) {
        FLString *s = (FLString*)v.obj;
        n = 2;
        for (uint32_t i = 0; i < s->len; i++) {
            unsigned char c = (unsigned char)s->data[i];
            size_t add = (c == '"' || c == '\\' || c == '\b' || c == '\f' || c == '\n' || c == '\r' || c == '\t') ? 2 : (c < 0x20 ? 6 : 1);
            if (add > FL_PARALLEL_RESULT_MAX || n > FL_PARALLEL_RESULT_MAX - add) return -1;
            n += add;
        }
    } else if (v.tag == FL_VECTOR && v.obj) {
        FLVector *vec = (FLVector*)v.obj;
        n = 2;
        for (uint32_t i = 0; i < vec->len; i++) {
            size_t part = 0;
            int valid = fl_parallel_json_size(vec->data[i], &part, depth + 1);
            if (valid <= 0) return valid;
            if (part > FL_PARALLEL_RESULT_MAX || n > FL_PARALLEL_RESULT_MAX - part) return -1;
            n += part + (i ? 1 : 0);
        }
    } else if (v.tag == FL_MAP && v.obj) {
        FLMap *map = (FLMap*)v.obj;
        n = 2;
        for (uint32_t i = 0; i < map->len; i++) {
            size_t key = 0, val = 0;
            if (map->entries[i].key.tag != FL_STRING) return 0;
            int key_valid = fl_parallel_json_size(map->entries[i].key, &key, depth + 1);
            int val_valid = fl_parallel_json_size(map->entries[i].val, &val, depth + 1);
            if (key_valid <= 0) return key_valid;
            if (val_valid <= 0) return val_valid;
            if (key > FL_PARALLEL_RESULT_MAX || val > FL_PARALLEL_RESULT_MAX ||
                n > FL_PARALLEL_RESULT_MAX - key || n + key > FL_PARALLEL_RESULT_MAX - val - 1) return -1;
            n += key + val + 1 + (i ? 1 : 0);
        }
    } else return 0;
    if (n > FL_PARALLEL_RESULT_MAX || *size > FL_PARALLEL_RESULT_MAX - n) return -1;
    *size += n;
    return 1;
}

static int64_t fl_parallel_now_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) return 0;
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static FLValue fl_parallel_error(const char *code) {
    return fl_err(code);
}

typedef struct {
    pid_t pid;
    int fd, reaped, eof, failed, parsed, status;
    int64_t start_ms;
    size_t len;
    char *data;
} FLParallelChild;

static void fl_parallel_child(FLValue callback, int fd) {
    FLValue result = fl_fn_call(callback, 0, NULL);
    size_t expected = 0;
    int size_status = fl_parallel_json_size(result, &expected, 0);
    if (size_status <= 0) _exit(size_status < 0 ? 3 : 2);
    FLValue encoded = fl_json_stringify(result);
    if (encoded.tag != FL_STRING || !encoded.obj) _exit(2);
    FLString *s = (FLString*)encoded.obj;
    if (s->len != expected || s->len > FL_PARALLEL_RESULT_MAX) _exit(3);
    size_t off = 0;
    while (off < s->len) {
        ssize_t n = write(fd, s->data + off, s->len - off);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) _exit(4);
        off += (size_t)n;
    }
    close(fd);
    _exit(0);
}

FLValue fl_run_parallel(FLValue jobs, FLValue workers_value) {
    if (jobs.tag != FL_VECTOR || !jobs.obj) fl_throw(fl_str_val("run-parallel expects a vector of functions"));
    int workers_limit = workers_value.tag == FL_INT ? (int)workers_value.i : FL_PARALLEL_LIMIT;
    if (workers_limit < 1) workers_limit = 1;
    if (workers_limit > FL_PARALLEL_LIMIT) workers_limit = FL_PARALLEL_LIMIT;
    FLVector *items = (FLVector*)jobs.obj;
    if (!items->len) return fl_vec_new();
    FLValue *results = fl_calloc(items->len, sizeof *results);
    if (!results) fl_throw(fl_str_val("run-parallel allocation failed"));
    for (uint32_t base = 0; base < items->len; base += (uint32_t)workers_limit) {
        FLParallelChild child[FL_PARALLEL_LIMIT];
        memset(child, 0, sizeof child);
        int count = (int)(items->len - base);
        if (count > workers_limit) count = workers_limit;
        for (int i = 0; i < count; i++) {
            child[i].fd = -1;
            if (items->data[base + (uint32_t)i].tag != FL_FN) {
                results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_NOT_FUNCTION");
                child[i].reaped = child[i].eof = 1;
                continue;
            }
            int fds[2];
            if (pipe(fds) != 0) {
                results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_PIPE");
                child[i].reaped = child[i].eof = 1;
                continue;
            }
            fflush(NULL);
            pid_t pid = fork();
            if (pid < 0) {
                close(fds[0]); close(fds[1]);
                results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_FORK");
                child[i].reaped = child[i].eof = 1;
                continue;
            }
            if (pid == 0) {
                close(fds[0]);
                for (int j = 0; j < i; j++) if (child[j].fd >= 0) close(child[j].fd);
                fl_parallel_child(items->data[base + (uint32_t)i], fds[1]);
            }
            close(fds[1]);
            int flags = fcntl(fds[0], F_GETFL, 0);
            if (flags >= 0) (void)fcntl(fds[0], F_SETFL, flags | O_NONBLOCK);
            child[i].pid = pid;
            child[i].fd = fds[0];
            child[i].start_ms = fl_parallel_now_ms();
            child[i].data = fl_malloc(FL_PARALLEL_RESULT_MAX + 1u);
            if (!child[i].data) {
                child[i].failed = 1;
                results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_MEMORY");
                kill(pid, SIGKILL);
                close(child[i].fd); child[i].fd = -1; child[i].eof = 1;
            }
        }
        for (;;) {
            int active = 0;
            int64_t now = fl_parallel_now_ms();
            struct pollfd pfds[FL_PARALLEL_LIMIT];
            int pmap[FL_PARALLEL_LIMIT], pn = 0;
            for (int i = 0; i < count; i++) {
                FLParallelChild *c = &child[i];
                if (!c->reaped || !c->eof) active++;
                if (c->pid > 0 && !c->reaped && !c->failed && now - c->start_ms >= FL_PARALLEL_TIMEOUT_MS) {
                    c->failed = 1;
                    results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_TIMEOUT");
                    kill(c->pid, SIGKILL);
                    if (c->fd >= 0) { close(c->fd); c->fd = -1; c->eof = 1; }
                }
                if (c->fd >= 0 && !c->eof) {
                    pfds[pn].fd = c->fd; pfds[pn].events = POLLIN | POLLHUP | POLLERR; pfds[pn].revents = 0;
                    pmap[pn++] = i;
                }
            }
            if (!active) break;
            int pr = poll(pfds, (nfds_t)pn, 50);
            if (pr < 0 && errno != EINTR) {
                for (int i = 0; i < count; i++) if (child[i].pid > 0 && !child[i].reaped) kill(child[i].pid, SIGKILL);
            }
            if (pr > 0) for (int p = 0; p < pn; p++) if (pfds[p].revents) {
                int i = pmap[p]; FLParallelChild *c = &child[i];
                for (;;) {
                    char part[8192];
                    ssize_t n = read(c->fd, part, sizeof part);
                    if (n < 0 && errno == EINTR) continue;
                    if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) break;
                    if (n <= 0) {
                        close(c->fd); c->fd = -1; c->eof = 1;
                        break;
                    }
                    if ((size_t)n > FL_PARALLEL_RESULT_MAX - c->len) {
                        c->failed = 1;
                        results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_RESULT_TOO_LARGE");
                        kill(c->pid, SIGKILL);
                        close(c->fd); c->fd = -1; c->eof = 1;
                        break;
                    }
                    memcpy(c->data + c->len, part, (size_t)n); c->len += (size_t)n;
                }
            }
            for (int i = 0; i < count; i++) {
                FLParallelChild *c = &child[i];
                if (c->pid <= 0 || c->reaped) continue;
                pid_t w = waitpid(c->pid, &c->status, WNOHANG);
                if (w == c->pid) {
                    c->reaped = 1;
                    if (!c->failed && (!WIFEXITED(c->status) || WEXITSTATUS(c->status) != 0)) {
                        c->failed = 1;
                        const char *reason = WIFEXITED(c->status) && WEXITSTATUS(c->status) == 2
                            ? "E_RUN_PARALLEL_UNSUPPORTED_RESULT"
                            : WIFEXITED(c->status) && WEXITSTATUS(c->status) == 3
                                ? "E_RUN_PARALLEL_RESULT_TOO_LARGE" : "E_RUN_PARALLEL_CHILD";
                        results[base + (uint32_t)i] = fl_parallel_error(reason);
                    }
                } else if (w < 0 && errno != EINTR) {
                    c->reaped = c->failed = 1;
                    results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_WAIT");
                }
            }
            for (int i = 0; i < count; i++) {
                FLParallelChild *c = &child[i];
                if (c->pid > 0 && c->reaped && c->eof && !c->failed && !c->parsed) {
                    c->parsed = 1;
                    if (!c->len) results[base + (uint32_t)i] = fl_parallel_error("E_RUN_PARALLEL_NO_RESULT");
                    else {
                        c->data[c->len] = '\0';
                        results[base + (uint32_t)i] = fl_json_parse(fl_str_val(c->data));
                    }
                }
            }
        }
        for (int i = 0; i < count; i++) {
            if (child[i].fd >= 0) close(child[i].fd);
            free(child[i].data);
        }
    }
    FLValue out = fl_vec_from(results, items->len);
    free(results);
    return out;
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

static FLValue http_client_error(const char *code, const char *message) {
    FLValue error = fl_map_new();
    error = fl_map_set(error, fl_str_val("code"), fl_str_val(code));
    error = fl_map_set(error, fl_str_val("message"), fl_str_val(message));
    FLValue result = fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(false));
    return fl_map_set(result, fl_str_val("error"), error);
}

static int http_client_parse_url(FLValue value, char *host, size_t host_cap,
                                 char *authority, size_t authority_cap,
                                 char *path, size_t path_cap, int64_t *port) {
    if (value.tag != FL_STRING || !value.obj) return -1;
    const char *url = ((FLString *)value.obj)->data;
    if (strncmp(url, "http://", 7) != 0) return -1;
    const char *begin = url + 7, *end = begin;
    while (*end && *end != '/' && *end != '?') {
        if ((unsigned char)*end <= 32 || *end == '#' || *end == '@') return -1;
        end++;
    }
    size_t authority_len = (size_t)(end - begin);
    if (!authority_len || authority_len >= authority_cap) return -1;
    memcpy(authority, begin, authority_len); authority[authority_len] = '\0';
    const char *colon = memchr(begin, ':', authority_len);
    size_t host_len = colon ? (size_t)(colon - begin) : authority_len;
    if (!host_len || host_len >= host_cap || memchr(begin, '[', authority_len) ||
        memchr(begin, ']', authority_len) || (colon && memchr(colon + 1, ':', (size_t)(end - colon - 1)))) return -1;
    memcpy(host, begin, host_len); host[host_len] = '\0';
    *port = 80;
    if (colon) {
        const char *p = colon + 1;
        if (p == end) return -1;
        int64_t n = 0;
        for (; p < end; p++) {
            if (*p < '0' || *p > '9') return -1;
            n = n * 10 + (*p - '0');
            if (n > 65535) return -1;
        }
        if (n < 1) return -1;
        *port = n;
    }
    if (*end == '?') {
        if (snprintf(path, path_cap, "/%s", end) >= (int)path_cap) return -1;
    } else if (snprintf(path, path_cap, "%s", *end ? end : "/") >= (int)path_cap) return -1;
    for (const unsigned char *p = (const unsigned char *)path; *p; p++)
        if (*p <= 32 || *p == 127 || *p == '#') return -1;
    return 0;
}

static int http_header_token(const char *name, size_t length) {
    if (!length) return 0;
    for (size_t i = 0; i < length; i++) {
        unsigned char c = (unsigned char)name[i];
        if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
              (c >= '0' && c <= '9') || strchr("!#$%&'*+-.^_`|~", c))) return 0;
    }
    return 1;
}

static int http_header_forbidden(const char *name, size_t length) {
    char lower[64];
    if (!length || length >= sizeof lower) return 1;
    for (size_t i = 0; i < length; i++) lower[i] = (char)tolower((unsigned char)name[i]);
    lower[length] = '\0';
    return !strcmp(lower, "host") || !strcmp(lower, "connection") ||
           !strcmp(lower, "content-length") || !strcmp(lower, "transfer-encoding");
}

static int http_wire_append(char *wire, size_t capacity, size_t *used,
                            const char *text, size_t length) {
    if (length > capacity - *used) return -1;
    memcpy(wire + *used, text, length); *used += length;
    return 0;
}

static FLValue http_client_request(const char *method, FLValue url, FLValue headers, FLValue body, FLValue callback) {
    char host[256], authority[320], path[2048];
    int64_t port;
    if (http_client_parse_url(url, host, sizeof host, authority, sizeof authority,
                              path, sizeof path, &port) != 0)
        return http_client_error("INVALID_URL", "expected a valid plain HTTP URL");
    if (headers.tag != FL_MAP || body.tag != FL_STRING || !body.obj)
        return http_client_error("INVALID_REQUEST", "headers must be a map and body a string");
    FLString *payload = (FLString *)body.obj;
    if (payload->len > 1048576) return http_client_error("REQUEST_TOO_LARGE", "request body exceeds 1048576 bytes");
    FLMap *map = (FLMap *)headers.obj;
    size_t capacity = strlen(path) + strlen(authority) + payload->len + 512;
    for (uint32_t i = 0; i < map->len; i++) {
        FLValue key = map->entries[i].key, val = map->entries[i].val;
        if (key.tag != FL_STRING || !key.obj || val.tag != FL_STRING || !val.obj)
            return http_client_error("INVALID_REQUEST", "header names and values must be strings");
        FLString *k = (FLString *)key.obj, *v = (FLString *)val.obj;
        if (!http_header_token(k->data, k->len) || http_header_forbidden(k->data, k->len))
            return http_client_error("INVALID_REQUEST", "invalid or reserved header name");
        for (uint32_t j = 0; j < v->len; j++)
            if (v->data[j] == '\r' || v->data[j] == '\n')
                return http_client_error("INVALID_REQUEST", "header values cannot contain CR or LF");
        if ((size_t)k->len + (size_t)v->len + 4 > SIZE_MAX - capacity)
            return http_client_error("REQUEST_TOO_LARGE", "request size overflow");
        capacity += (size_t)k->len + (size_t)v->len + 4;
    }
    if (capacity > 2097152) return http_client_error("REQUEST_TOO_LARGE", "request exceeds 2097152 bytes");
    char *wire = (char *)fl_malloc(capacity);
    if (!wire) return http_client_error("IO", "request allocation failed");
    size_t used = 0; char line[512];
    int n = snprintf(line, sizeof line, "%s %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\nContent-Length: %u\r\n",
                     method, path, authority, payload->len);
    if (n < 0 || (size_t)n >= sizeof line || http_wire_append(wire, capacity, &used, line, (size_t)n) != 0) {
        free(wire); return http_client_error("REQUEST_TOO_LARGE", "request header overflow");
    }
    for (uint32_t i = 0; i < map->len; i++) {
        FLString *key = (FLString *)map->entries[i].key.obj;
        FLString *value = (FLString *)map->entries[i].val.obj;
        if (http_wire_append(wire, capacity, &used, key->data, key->len) != 0 ||
            http_wire_append(wire, capacity, &used, ": ", 2) != 0 ||
            http_wire_append(wire, capacity, &used, value->data, value->len) != 0 ||
            http_wire_append(wire, capacity, &used, "\r\n", 2) != 0) {
            free(wire); return http_client_error("REQUEST_TOO_LARGE", "request header overflow");
        }
    }
    if (http_wire_append(wire, capacity, &used, "\r\n", 2) != 0 ||
        http_wire_append(wire, capacity, &used, payload->data, payload->len) != 0) {
        free(wire); return http_client_error("REQUEST_TOO_LARGE", "request overflow");
    }
    wire[used] = '\0';
    FLValue exchange = _fl_http_exchange_stream(fl_str_val(host), fl_int(port), fl_str_val(wire), fl_int(5000), fl_int(2097152), callback);
    free(wire);
    if (!fl_truthy(fl_map_get(exchange, fl_str_val("ok")))) return exchange;
    FLValue raw_value = fl_map_get(exchange, fl_str_val("value"));
    if (raw_value.tag != FL_STRING || !raw_value.obj) return http_client_error("HTTP_PROTOCOL", "missing response data");
    FLString *raw = (FLString *)raw_value.obj;
    const char *split = strstr(raw->data, "\r\n\r\n");
    int status = 0;
    if (!split || sscanf(raw->data, "HTTP/%*u.%*u %d", &status) != 1 || status < 100 || status > 599 ||
        (size_t)(split - raw->data) > 65536)
        return http_client_error("HTTP_PROTOCOL", "malformed response");
    FLValue response_headers = fl_map_new();
    const char *cursor = strstr(raw->data, "\r\n");
    if (!cursor || cursor >= split) return http_client_error("HTTP_PROTOCOL", "missing status line");
    cursor += 2;
    while (cursor < split) {
        const char *end = strstr(cursor, "\r\n");
        if (!end || end > split) return http_client_error("HTTP_PROTOCOL", "malformed response header");
        const char *colon = memchr(cursor, ':', (size_t)(end - cursor));
        if (!colon || colon == cursor) return http_client_error("HTTP_PROTOCOL", "malformed response header");
        size_t key_len = (size_t)(colon - cursor), value_len = (size_t)(end - colon - 1);
        char key[256];
        if (key_len >= sizeof key) return http_client_error("HTTP_PROTOCOL", "response header name too long");
        memcpy(key, cursor, key_len); key[key_len] = '\0';
        for (size_t i = 0; i < key_len; i++) key[i] = (char)tolower((unsigned char)key[i]);
        const char *value = colon + 1;
        while (value_len && (*value == ' ' || *value == '\t')) { value++; value_len--; }
        while (value_len && (value[value_len - 1] == ' ' || value[value_len - 1] == '\t')) value_len--;
        char *copy = (char *)fl_malloc(value_len + 1);
        if (!copy) return http_client_error("IO", "response allocation failed");
        memcpy(copy, value, value_len); copy[value_len] = '\0';
        response_headers = fl_map_set(response_headers, fl_str_val(key), fl_str_val(copy));
        free(copy); cursor = end + 2;
    }
    FLValue transfer = fl_map_get(response_headers, fl_str_val("transfer-encoding"));
    int chunked = 0;
    if (transfer.tag != FL_NIL) {
        if (transfer.tag != FL_STRING || !transfer.obj ||
            strcasecmp(((FLString *)transfer.obj)->data, "chunked"))
            return http_client_error("HTTP_PROTOCOL", "unsupported transfer encoding");
        if (fl_map_get(response_headers, fl_str_val("content-length")).tag != FL_NIL)
            return http_client_error("HTTP_PROTOCOL", "conflicting response framing");
        chunked = 1;
    }
    const char *body_start = split + 4;
    size_t wire_body_len = raw->len - (size_t)(body_start - raw->data);
    char *decoded = fl_malloc(2097153);
    if (!decoded) return http_client_error("IO", "response allocation failed");
    size_t body_len = 0, offset = 0;
    if (!chunked) {
        if (wire_body_len > 2097152) { free(decoded); return http_client_error("RESPONSE_TOO_LARGE", "response body exceeds 2097152 bytes"); }
        memcpy(decoded, body_start, wire_body_len); body_len = wire_body_len;
        decoded[body_len] = '\0';
    } else {
        int final_seen = 0;
        while (offset < wire_body_len) {
            const char *line_end = memmem(body_start + offset, wire_body_len - offset, "\r\n", 2);
            if (!line_end || line_end == body_start + offset || (size_t)(line_end - (body_start + offset)) > 16) {
                free(decoded); return http_client_error("HTTP_PROTOCOL", "invalid chunk size");
            }
            size_t line_len = (size_t)(line_end - (body_start + offset));
            size_t chunk_size = 0;
            for (size_t i = 0; i < line_len; i++) {
                unsigned char c = (unsigned char)body_start[offset + i];
                unsigned digit;
                if (c >= '0' && c <= '9') digit = c - '0';
                else if (c >= 'a' && c <= 'f') digit = c - 'a' + 10;
                else if (c >= 'A' && c <= 'F') digit = c - 'A' + 10;
                else { free(decoded); return http_client_error("HTTP_PROTOCOL", "invalid chunk size"); }
                if (chunk_size > (2097152u - digit) / 16u) {
                    free(decoded); return http_client_error("RESPONSE_TOO_LARGE", "chunked response exceeds 2097152 bytes");
                }
                chunk_size = chunk_size * 16u + digit;
            }
            offset += line_len + 2;
            if (!chunk_size) {
                for (;;) {
                    const char *trailer_end = memmem(body_start + offset, wire_body_len - offset, "\r\n", 2);
                    if (!trailer_end) { free(decoded); return http_client_error("HTTP_PROTOCOL", "truncated chunk trailers"); }
                    size_t trailer_len = (size_t)(trailer_end - (body_start + offset));
                    if (!trailer_len) { offset += 2; break; }
                    if (!memchr(body_start + offset, ':', trailer_len)) {
                        free(decoded); return http_client_error("HTTP_PROTOCOL", "invalid chunk trailer");
                    }
                    offset += trailer_len + 2;
                }
                if (offset != wire_body_len) { free(decoded); return http_client_error("HTTP_PROTOCOL", "bytes after final chunk"); }
                final_seen = 1;
                break;
            }
            if (chunk_size > 2097152u - body_len || chunk_size > wire_body_len - offset ||
                wire_body_len - offset - chunk_size < 2 ||
                body_start[offset + chunk_size] != '\r' || body_start[offset + chunk_size + 1] != '\n') {
                free(decoded); return http_client_error(chunk_size > 2097152u - body_len ? "RESPONSE_TOO_LARGE" : "HTTP_PROTOCOL",
                                                        "invalid or oversized chunk data");
            }
            memcpy(decoded + body_len, body_start + offset, chunk_size);
            body_len += chunk_size; offset += chunk_size + 2;
        }
        if (!wire_body_len || !final_seen || offset != wire_body_len) { free(decoded); return http_client_error("HTTP_PROTOCOL", "missing final chunk"); }
    }
    decoded[body_len] = '\0';
    FLValue content_length = fl_map_get(response_headers, fl_str_val("content-length"));
    if (content_length.tag != FL_NIL) {
        if (content_length.tag != FL_STRING || !content_length.obj) {
            free(decoded); return http_client_error("HTTP_PROTOCOL", "invalid content length");
        }
        const char *text = ((FLString *)content_length.obj)->data; char *end = NULL;
        for (const unsigned char *p = (const unsigned char *)text; *p; p++)
            if (*p < '0' || *p > '9') {
                free(decoded); return http_client_error("HTTP_PROTOCOL", "invalid content length");
            }
        errno = 0;
        unsigned long long expected = strtoull(text, &end, 10);
        if (!text[0] || errno == ERANGE || !end || *end || expected != body_len) {
            free(decoded);
            return http_client_error("HTTP_PROTOCOL", "content length mismatch");
        }
    }
    FLValue result = fl_map_new();
    result = fl_map_set(result, fl_str_val("ok"), fl_bool(status >= 200 && status < 300));
    result = fl_map_set(result, fl_str_val("status"), fl_int(status));
    result = fl_map_set(result, fl_str_val("headers"), response_headers);
    result = fl_map_set(result, fl_str_val("body"), fl_str_val(decoded));
    free(decoded);
    return result;
}

FLValue fl_http_get_headers(FLValue url, FLValue headers) {
    return http_client_request("GET", url, headers, fl_str_val(""), fl_nil());
}
FLValue fl_http_post(FLValue url, FLValue body) {
    return http_client_request("POST", url, fl_map_new(), body, fl_nil());
}
FLValue fl_http_post_headers(FLValue url, FLValue headers, FLValue body) {
    return http_client_request("POST", url, headers, body, fl_nil());
}
FLValue fl_http_post_stream(FLValue url, FLValue headers, FLValue body, FLValue callback) {
    if (callback.tag != FL_FN) return http_client_error("INVALID_REQUEST", "stream callback must be a function");
    return http_client_request("POST", url, headers, body, callback);
}
FLValue fl_http_stream_collect(FLValue url, FLValue headers, FLValue body) {
    FLValue response = http_client_request("POST", url, headers, body, fl_nil());
    if (!fl_truthy(fl_map_get(response, fl_str_val("ok")))) return response;
    return fl_map_get(response, fl_str_val("body"));
}

FLValue fl_http_body(FLValue response) {
    return response.tag == FL_MAP ? fl_map_get(response, fl_str_val("body")) : fl_nil();
}

FLValue fl_http_status(FLValue response) {
    FLValue status = response.tag == FL_MAP ? fl_map_get(response, fl_str_val("status")) : fl_nil();
    return status.tag == FL_INT ? status : fl_int(0);
}

FLValue fl_http_ok_p(FLValue response) {
    FLValue ok = response.tag == FL_MAP ? fl_map_get(response, fl_str_val("ok")) : fl_nil();
    return fl_bool(ok.tag == FL_BOOL && ok.b);
}

FLValue http_ok_p(FLValue response) {
    return fl_http_ok_p(response);
}

FLValue http_post_json(FLValue url, FLValue headers, FLValue body) {
    FLValue response = fl_http_post_headers(url, headers, body);
    FLValue result_body = fl_map_get(response, fl_str_val("body"));
    if (result_body.tag != FL_STRING) fl_throw(response);
    return fl_json_parse(result_body);
}

FLValue http_get_json(FLValue url, FLValue headers) {
    FLValue response = fl_http_get_headers(url, headers);
    FLValue result_body = fl_map_get(response, fl_str_val("body"));
    if (result_body.tag != FL_STRING) fl_throw(response);
    return fl_json_parse(result_body);
}

FLValue http_put(FLValue url, FLValue body) {
    FLValue headers = fl_map_set(fl_map_new(), fl_str_val("Content-Type"), fl_str_val("application/json"));
    FLValue response = http_client_request("PUT", url, headers, body, fl_nil());
    FLValue result_body = fl_map_get(response, fl_str_val("body"));
    if (result_body.tag != FL_STRING) fl_throw(response);
    return result_body;
}

FLValue fl_uuid(void) {
    unsigned char bytes[16]; size_t left = sizeof bytes; unsigned char *p = bytes;
    while (left) {
        ssize_t n = getrandom(p, left, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) fl_throw(fl_str_val("getrandom failed for uuid"));
        p += n; left -= (size_t)n;
    }
    bytes[6] = (unsigned char)((bytes[6] & 0x0f) | 0x40);
    bytes[8] = (unsigned char)((bytes[8] & 0x3f) | 0x80);
    char text[37]; static const char hex[] = "0123456789abcdef";
    size_t at = 0;
    for (size_t i = 0; i < sizeof bytes; i++) {
        if (i == 4 || i == 6 || i == 8 || i == 10) text[at++] = '-';
        text[at++] = hex[bytes[i] >> 4]; text[at++] = hex[bytes[i] & 15];
    }
    text[at] = '\0';
    return fl_str_val(text);
}

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
    FLTcpSocket *s = fl_malloc(sizeof(*s));
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
