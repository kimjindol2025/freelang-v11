#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

pid_t __real_fork(void);

static int user_tasks(void) {
    DIR *processes = opendir("/proc");
    if (!processes) return -1;
    int count = 0;
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
        struct dirent *task;
        while ((task = readdir(tasks)))
            if (isdigit((unsigned char)task->d_name[0])) count++;
        closedir(tasks);
    }
    closedir(processes);
    return count;
}

__attribute__((constructor)) static void set_probe_limit(void) {
    if (!getenv("DB_FORK_ISOLATED")) return;
    int tasks = user_tasks();
    struct rlimit limit;
    if (tasks < 0 || getrlimit(RLIMIT_NPROC, &limit) != 0) _exit(126);
    limit.rlim_cur = (rlim_t)(tasks + 5);
    if (setrlimit(RLIMIT_NPROC, &limit) != 0) _exit(126);
    fprintf(stderr, "DB_FORK_MEASURED_TASKS=%d DB_FORK_SET_LIMIT=%llu\n",
            tasks, (unsigned long long)limit.rlim_cur);
}

pid_t __wrap_fork(void) {
    struct rlimit limit;
    if (getrlimit(RLIMIT_NPROC, &limit) != 0) limit.rlim_cur = 0;
    int before = user_tasks();
    pid_t child = __real_fork();
    int saved_errno = errno;
    if (child != 0) {
        int after = child < 0 ? user_tasks() : -1;
        fprintf(stderr,
                "DB_FORK_PRE_TASKS=%d DB_FORK_LIMIT=%llu DB_FORK_RESULT=%s DB_FORK_FAILURE_TASKS=%d DB_FORK_ERRNO=%d\n",
                before, (unsigned long long)limit.rlim_cur,
                child < 0 ? "fail" : "success", after, child < 0 ? saved_errno : 0);
    }
    errno = saved_errno;
    return child;
}
