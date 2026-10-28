#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

pid_t __real_fork(void);

static void snapshot_names(void) {
    const char *path = getenv("DB_FORK_SNAPSHOT");
    if (!path || !*path) return;
    int fd = open(path, O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (fd < 0) return;
    FILE *out = fdopen(fd, "w");
    if (!out) { close(fd); return; }
    DIR *processes = opendir("/proc");
    if (!processes) { fclose(out); return; }
    struct dirent *process;
    while ((process = readdir(processes))) {
        if (!isdigit((unsigned char)process->d_name[0])) continue;
        char pathbuf[128];
        struct stat info;
        snprintf(pathbuf, sizeof(pathbuf), "/proc/%s", process->d_name);
        if (stat(pathbuf, &info) != 0 || info.st_uid != getuid()) continue;
        snprintf(pathbuf, sizeof(pathbuf), "/proc/%s/task", process->d_name);
        DIR *tasks = opendir(pathbuf);
        if (!tasks) continue;
        struct dirent *task;
        while ((task = readdir(tasks))) {
            if (!isdigit((unsigned char)task->d_name[0])) continue;
            snprintf(pathbuf, sizeof(pathbuf), "/proc/%s/task/%s/comm", process->d_name, task->d_name);
            FILE *comm = fopen(pathbuf, "r");
            if (!comm) continue;
            char name[64];
            if (fgets(name, sizeof(name), comm)) fputs(name, out);
            fclose(comm);
        }
        closedir(tasks);
    }
    closedir(processes);
    fclose(out);
}

static int user_tasks(int *process_count) {
    DIR *processes = opendir("/proc");
    if (!processes) return -1;
    int count = 0;
    int processes_count = 0;
    struct dirent *process;
    while ((process = readdir(processes))) {
        if (!isdigit((unsigned char)process->d_name[0])) continue;
        char path[128];
        struct stat info;
        snprintf(path, sizeof(path), "/proc/%s", process->d_name);
        if (stat(path, &info) != 0 || info.st_uid != getuid()) continue;
        snprintf(path, sizeof(path), "/proc/%s/task", process->d_name);
        DIR *tasks = opendir(path);
        if (!tasks) continue;
        processes_count++;
        struct dirent *task;
        while ((task = readdir(tasks)))
            if (isdigit((unsigned char)task->d_name[0])) count++;
        closedir(tasks);
    }
    closedir(processes);
    if (process_count) *process_count = processes_count;
    return count;
}

__attribute__((constructor)) static void set_probe_limit(void) {
    if (!getenv("DB_FORK_ISOLATED")) return;
    int processes = 0;
    int tasks = user_tasks(&processes);
    struct rlimit limit;
    if (tasks < 0 || getrlimit(RLIMIT_NPROC, &limit) != 0) _exit(126);
    limit.rlim_cur = (rlim_t)(tasks + 5);
    if (setrlimit(RLIMIT_NPROC, &limit) != 0) _exit(126);
    fprintf(stderr, "DB_FORK_MEASURED_TASKS=%d DB_FORK_SET_LIMIT=%llu\n",
            tasks, (unsigned long long)limit.rlim_cur);
    fprintf(stderr, "DB_FORK_MEASURED_PROCESSES=%d\n", processes);
}

pid_t __wrap_fork(void) {
    struct rlimit limit;
    if (getrlimit(RLIMIT_NPROC, &limit) != 0) limit.rlim_cur = 0;
    int before = user_tasks(NULL);
    pid_t child = __real_fork();
    int saved_errno = errno;
    if (child != 0) {
        int after = child < 0 ? user_tasks(NULL) : -1;
        if (child < 0) snapshot_names();
        fprintf(stderr,
                "DB_FORK_PRE_TASKS=%d DB_FORK_LIMIT=%llu DB_FORK_RESULT=%s DB_FORK_FAILURE_TASKS=%d DB_FORK_ERRNO=%d\n",
                before, (unsigned long long)limit.rlim_cur,
                child < 0 ? "fail" : "success", after, child < 0 ? saved_errno : 0);
    }
    errno = saved_errno;
    return child;
}
