/* Checked POSIX operations for lib/fs. Path composition, traversal, lines and
 * JSON stay in FreeLang. Legacy I/O cannot preserve errno or partial failures. */
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>

static FLValue fs_result(FLValue value) {
    FLValue r = fl_map_new();
    r = fl_map_set(r, fl_str_val("ok"), fl_bool(true));
    return fl_map_set(r, fl_str_val("value"), value);
}
static FLValue fs_failure(FLValue path, const char *code, const char *message) {
    FLValue e = fl_map_new(), r = fl_map_new();
    e = fl_map_set(e, fl_str_val("code"), fl_str_val(code));
    e = fl_map_set(e, fl_str_val("message"), fl_str_val(message));
    e = fl_map_set(e, fl_str_val("path"), path);
    r = fl_map_set(r, fl_str_val("ok"), fl_bool(false));
    return fl_map_set(r, fl_str_val("error"), e);
}
static FLValue fs_errno(FLValue path, int n) {
    const char *code = "IO";
    switch (n) {
    case ENOENT: code = "NOT_FOUND"; break;
    case EACCES: case EPERM: code = "PERMISSION"; break;
    case ENOTDIR: code = "NOT_DIRECTORY"; break;
    case EISDIR: code = "IS_DIRECTORY"; break;
    case ENOTEMPTY: case EEXIST: code = "NOT_EMPTY"; break;
    case ELOOP: code = "SYMLINK_LOOP"; break;
    case ENOSPC: code = "NO_SPACE"; break;
    case EFBIG: code = "FILE_TOO_LARGE"; break;
    case ENAMETOOLONG: code = "PATH_TOO_LONG"; break;
    }
    return fs_failure(path, code, strerror(n));
}
FLValue _fl_fs_io(FLValue operation, FLValue path, FLValue content) {
    if (path.tag != FL_STRING || !path.obj)
        return fs_failure(path, "INVALID_PATH", "expected path string");
    FLString *ps = (FLString*)path.obj;
    const char *p = ps->data, *op = _strval(operation);
    if (!ps->len || strlen(p) != ps->len)
        return fs_failure(path, "INVALID_PATH", "empty path or embedded NUL");
    struct stat st;
    if (!strcmp(op,"exists") || !strcmp(op,"size") || !strcmp(op,"mtime") || !strcmp(op,"kind")) {
        int rc = !strcmp(op,"kind") ? lstat(p,&st) : stat(p,&st);
        if (rc) {
            int n = errno;
            if (!strcmp(op,"exists") && n == ENOENT) return fs_result(fl_bool(false));
            return fs_errno(path,n);
        }
        if (!strcmp(op,"exists")) return fs_result(fl_bool(true));
        if (!strcmp(op,"kind")) return fs_result(fl_str_val(S_ISDIR(st.st_mode) ? "directory" : "file"));
        if (!strcmp(op,"size")) return fs_result(fl_int(st.st_size));
        return fs_result(fl_int((int64_t)st.st_mtim.tv_sec * 1000 + st.st_mtim.tv_nsec / 1000000));
    }
    if (!strcmp(op,"mkdir")) {
        if (!mkdir(p,0755)) return fs_result(fl_bool(true));
        int n = errno;
        if (n == EEXIST) {
            if (stat(p,&st)) return fs_errno(path,errno);
            if (S_ISDIR(st.st_mode)) return fs_result(fl_bool(true));
            return fs_errno(path,ENOTDIR);
        }
        return fs_errno(path,n);
    }
    if (!strcmp(op,"rmdir")) {
        if (rmdir(p)) return fs_errno(path,errno);
        return fs_result(fl_bool(true));
    }
    if (!strcmp(op,"list")) {
        DIR *d = opendir(p);
        if (!d) return fs_errno(path,errno);
        FLValue items = fl_vec_new();
        struct dirent *e;
        errno = 0;
        while ((e = readdir(d))) {
            if (strcmp(e->d_name,".") && strcmp(e->d_name,".."))
                items = fl_vec_push(items,fl_str_val(e->d_name));
            errno = 0;
        }
        int n = errno;
        if (closedir(d) && !n) n = errno;
        return n ? fs_errno(path,n) : fs_result(items);
    }
    if (!strcmp(op,"read")) {
        int fd = open(p,O_RDONLY | O_NONBLOCK);
        if (fd < 0) return fs_errno(path,errno);
        int n = 0;
        if (fstat(fd,&st)) n = errno;
        else if (!S_ISREG(st.st_mode)) n = S_ISDIR(st.st_mode) ? EISDIR : EINVAL;
        if (n) { close(fd); return fs_errno(path,n); }
        size_t cap = 8192, used = 0;
        char *buf = fl_malloc(cap);
        if (!buf) { close(fd); return fs_errno(path,ENOMEM); }
        for (;;) {
            if (used == cap) {
                if (cap >= UINT32_MAX / 2) { n = EFBIG; break; }
                char *grown = fl_realloc(buf,cap * 2);
                if (!grown) { n = ENOMEM; break; }
                buf = grown; cap *= 2;
            }
            ssize_t k = read(fd,buf + used,cap - used);
            if (k < 0 && errno == EINTR) continue;
            if (k < 0) { n = errno; break; }
            if (!k) break;
            used += (size_t)k;
        }
        if (close(fd) && !n) n = errno;
        if (n) { free(buf); return fs_errno(path,n); }
        FLString *s = fl_malloc(sizeof(FLString) + used + 1);
        if (!s) { free(buf); return fs_errno(path,ENOMEM); }
        s->base.type = FL_STRING; s->base.rc = 1; s->len = (uint32_t)used;
        memcpy(s->data,buf,used); s->data[used] = 0; free(buf);
        FLValue value; value.tag = FL_STRING; value.obj = (FLObject*)s;
        return fs_result(value);
    }
    int atomic = !strcmp(op,"atomic");
    if (atomic || !strcmp(op,"write") || !strcmp(op,"append")) {
        if (content.tag != FL_STRING || !content.obj)
            return fs_failure(path,"INVALID_CONTENT","expected content string");
        char *temp = NULL;
        int fd;
        if (atomic) {
            temp = fl_malloc(strlen(p) + 24);
            if (!temp) return fs_errno(path,ENOMEM);
            sprintf(temp,"%s.fs-XXXXXX",p);
            fd = mkstemp(temp);
        } else fd = open(p,O_WRONLY | O_CREAT | O_NONBLOCK |
                         (!strcmp(op,"append") ? O_APPEND : O_TRUNC),0666);
        if (fd < 0) { int n = errno; free(temp); return fs_errno(path,n); }
        FLString *s = (FLString*)content.obj;
        size_t used = 0;
        int n = 0;
        while (used < s->len) {
            ssize_t k = write(fd,s->data + used,s->len - used);
            if (k < 0 && errno == EINTR) continue;
            if (k <= 0) { n = k < 0 ? errno : EIO; break; }
            used += (size_t)k;
        }
        if (atomic && !n && fsync(fd)) n = errno;
        if (close(fd) && !n) n = errno;
        if (atomic) {
            if (!n && rename(temp,p)) n = errno;
            if (n) unlink(temp); /* only this invocation's private temp file */
            free(temp);
        }
        return n ? fs_errno(path,n) : fs_result(fl_bool(true));
    }
    return fs_failure(path,"INVALID_OPERATION","unknown filesystem operation");
}
