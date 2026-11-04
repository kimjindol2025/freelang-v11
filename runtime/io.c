#define _POSIX_C_SOURCE 200809L
#include "runtime.h"
#include "internal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/file.h>
#include <sched.h>
#include <time.h>
#include <unistd.h>

FLValue fl_bit_xor(FLValue a, FLValue b) { return fl_int(a.i ^ b.i); }
FLValue fl_bit_and(FLValue a, FLValue b) { return fl_int(a.i & b.i); }
FLValue fl_bit_or(FLValue a, FLValue b)  { return fl_int(a.i | b.i); }
FLValue fl_bit_shl(FLValue a, FLValue b) { return fl_int(a.i << b.i); }
FLValue fl_bit_shr(FLValue a, FLValue b) { return fl_int(a.i >> b.i); }

/* ── _fl_file_* — all.fl stdlib 래퍼용 ── */
#include <sys/stat.h>
#include <dirent.h>
#include <unistd.h>

const char* _strval(FLValue v) {
    if (v.tag == FL_STRING && v.obj) return ((FLString*)v.obj)->data;
    return "";
}

#define FL_FILE_LOCK_HANDLES 4096
static volatile int fl_file_lock_table_guard = 0;
static struct { int fd; int64_t token; } fl_file_lock_handles[FL_FILE_LOCK_HANDLES];
static int64_t fl_file_lock_next_token = 1;

static void fl_file_lock_table_enter(void) {
    while (__sync_lock_test_and_set(&fl_file_lock_table_guard, 1)) sched_yield();
}

static void fl_file_lock_table_leave(void) {
    __sync_lock_release(&fl_file_lock_table_guard);
}

#include "fs_io.inc"

FLValue _fl_file_append(FLValue path, FLValue content) {
    FILE* f = fopen(_strval(path), "ab");
    if (!f) return fl_bool(false);
    const char* s = _strval(content);
    fwrite(s, 1, strlen(s), f); fclose(f);
    return fl_bool(true);
}
FLValue _fl_file_lock_acquire(FLValue path, FLValue timeout_ms) {
    if (path.tag != FL_STRING || !path.obj || timeout_ms.tag != FL_INT ||
        timeout_ms.i < 0 || timeout_ms.i > 60000) return fl_int(-1);
    const char* name = _strval(path);
    if (!name[0]) return fl_int(-1);
    int fd = open(name, O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (fd < 0) return fl_int(-1);
    struct timespec now;
    if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) {
        close(fd);
        return fl_int(-1);
    }
    int64_t deadline_ms = (int64_t)now.tv_sec * 1000 + now.tv_nsec / 1000000 + timeout_ms.i;
    for (;;) {
        if (flock(fd, LOCK_EX | LOCK_NB) == 0) {
            fl_file_lock_table_enter();
            for (int i = 0; i < FL_FILE_LOCK_HANDLES; i++) {
                if (fl_file_lock_handles[i].token == 0) {
                    if (fl_file_lock_next_token <= 0 || fl_file_lock_next_token == INT64_MAX) {
                        fl_file_lock_table_leave();
                        flock(fd, LOCK_UN);
                        close(fd);
                        return fl_int(-1);
                    }
                    int64_t token = fl_file_lock_next_token++;
                    fl_file_lock_handles[i].fd = fd;
                    fl_file_lock_handles[i].token = token;
                    fl_file_lock_table_leave();
                    return fl_int(token);
                }
            }
            fl_file_lock_table_leave();
            flock(fd, LOCK_UN);
            close(fd);
            return fl_int(-1);
        }
        if (errno != EWOULDBLOCK && errno != EAGAIN && errno != EINTR) break;
        if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) break;
        int64_t current_ms = (int64_t)now.tv_sec * 1000 + now.tv_nsec / 1000000;
        if (current_ms >= deadline_ms) break;
        struct timespec pause = {0, 1000000};
        while (nanosleep(&pause, &pause) != 0 && errno == EINTR) {}
    }
    close(fd);
    return fl_int(-1);
}
FLValue _fl_file_lock_release(FLValue handle) {
    if (handle.tag != FL_INT || handle.i < 1) return fl_bool(false);
    fl_file_lock_table_enter();
    int fd = -1;
    for (int i = 0; i < FL_FILE_LOCK_HANDLES; i++) {
        if (fl_file_lock_handles[i].token == handle.i) {
            fd = fl_file_lock_handles[i].fd;
            fl_file_lock_handles[i].fd = -1;
            fl_file_lock_handles[i].token = 0;
            break;
        }
    }
    fl_file_lock_table_leave();
    if (fd < 0) return fl_bool(false);
    int unlock_rc = flock(fd, LOCK_UN);
    int close_rc = close(fd);
    return fl_bool(unlock_rc == 0 && close_rc == 0);
}
FLValue file_exists(FLValue path) {
    struct stat st; return fl_bool(stat(_strval(path), &st) == 0);
}
FLValue _fl_file_delete(FLValue path) { return fl_bool(remove(_strval(path)) == 0); }
FLValue _fl_file_copy(FLValue src, FLValue dst) {
    FILE* in = fopen(_strval(src), "rb"); if (!in) return fl_bool(false);
    FILE* out = fopen(_strval(dst), "wb"); if (!out) { fclose(in); return fl_bool(false); }
    char buf[8192]; size_t n;
    while ((n = fread(buf,1,sizeof(buf),in)) > 0) fwrite(buf,1,n,out);
    fclose(in); fclose(out); return fl_bool(true);
}
FLValue _fl_file_rename(FLValue old, FLValue nw) { return fl_bool(rename(_strval(old), _strval(nw)) == 0); }
FLValue _fl_file_size(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_int(-1);
    return fl_int((int64_t)st.st_size);
}
FLValue _fl_file_modified(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_int(0);
    return fl_int((int64_t)st.st_mtime * 1000);
}
FLValue _fl_file_mkdir(FLValue path) { return fl_bool(mkdir(_strval(path), 0755) == 0); }
FLValue _fl_file_rmdir(FLValue path) { return fl_bool(rmdir(_strval(path)) == 0); }
FLValue _fl_file_list(FLValue path) {
    DIR* d = opendir(_strval(path));
    FLValue r = fl_vec_new();
    if (!d) return r;
    struct dirent* e;
    while ((e = readdir(d))) {
        if (strcmp(e->d_name,".") && strcmp(e->d_name,".."))
            r = fl_vec_push(r, fl_str_val(e->d_name));
    }
    closedir(d); return r;
}
FLValue _fl_file_is_file(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_bool(false);
    return fl_bool(S_ISREG(st.st_mode));
}
FLValue _fl_file_is_dir(FLValue path) {
    struct stat st; if (stat(_strval(path), &st) != 0) return fl_bool(false);
    return fl_bool(S_ISDIR(st.st_mode));
}

FLValue file_is_file(FLValue path) { return _fl_file_is_file(path); }
FLValue dir_exists_p(FLValue path) { return _fl_file_is_dir(path); }

FLValue dir_list(FLValue path) {
    const char* p = _strval(path);
    DIR* d = opendir(p);
    if (!d) {
        char msg[512];
        snprintf(msg, sizeof msg, "Directory not found: '%s'", p);
        fl_throw(fl_str_val(msg));
        return fl_vec_new();
    }
    FLValue r = fl_vec_new();
    struct dirent* e;
    while ((e = readdir(d))) {
        if (strcmp(e->d_name, ".") && strcmp(e->d_name, ".."))
            r = fl_vec_push(r, fl_str_val(e->d_name));
    }
    closedir(d);
    return r;
}

/* ── _fl_env_* ── */
#include <stdlib.h>
extern char** environ;

FLValue _fl_env_get(FLValue key) {
    const char* v = getenv(_strval(key));
    return v ? fl_str_val(v) : fl_nil();
}
/* bootstrap.js shell_env: 없거나 빈 문자열이면 null */
FLValue shell_env(FLValue varname) {
    const char* v = getenv(_strval(varname));
    if (!v || v[0] == '\0') return fl_nil();
    return fl_str_val(v);
}
FLValue _fl_env_set(FLValue key, FLValue val) {
    return fl_bool(setenv(_strval(key), _strval(val), 1) == 0);
}
FLValue _fl_env_all(void) {
    FLValue r = fl_map_new();
    if (!environ) return r;
    for (int i = 0; environ[i]; i++) {
        const char* e = environ[i];
        const char* eq = strchr(e, '=');
        if (!eq) continue;
        char key[256]; int klen = (int)(eq - e);
        if (klen >= 256) klen = 255;
        strncpy(key, e, klen); key[klen] = '\0';
        r = fl_map_set(r, fl_str_val(key), fl_str_val(eq + 1));
    }
    return r;
}

/* ── str_join ── */
FLValue str_join(FLValue sep, FLValue vec) {
    if (vec.tag != FL_VECTOR) return fl_str_val("");
    FLVector* v = (FLVector*)vec.obj;
    const char* s = (sep.tag == FL_STRING && sep.obj) ? ((FLString*)sep.obj)->data : "";
    size_t slen = strlen(s);
    /* 먼저 총 길이 계산 */
    size_t total = 0;
    char tmp[64];
    for (uint32_t i = 0; i < v->len; i++) {
        total += strlen(fl_to_str(v->data[i], tmp, sizeof(tmp)));
        if (i + 1 < v->len) total += slen;
    }
    char* buf = fl_malloc(total + 1); buf[0] = '\0';
    for (uint32_t i = 0; i < v->len; i++) {
        strcat(buf, fl_to_str(v->data[i], tmp, sizeof(tmp)));
        if (i + 1 < v->len) strcat(buf, s);
    }
    FLValue r = fl_str_val(buf); free(buf); return r;
}

/* ── _fl_process_* ── */
#include <signal.h>
#include <sys/wait.h>
