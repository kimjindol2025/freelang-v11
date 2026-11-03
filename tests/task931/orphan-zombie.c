#define _GNU_SOURCE
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/prctl.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static volatile sig_atomic_t release_requested = 0;

static void request_release(int signal_number) {
  (void)signal_number;
  release_requested = 1;
}

static int wait_for_exit_without_reaping(pid_t pid) {
  for (int attempt = 0; attempt < 5000; attempt++) {
    siginfo_t info = {0};
    errno = 0;
    if (waitid(P_PID, (id_t)pid, &info, WEXITED | WNOHANG | WNOWAIT) == 0 && info.si_pid == pid) {
      return 0;
    }
    if (errno != 0 && errno != EINTR) return -1;
    struct timespec delay = {.tv_sec = 0, .tv_nsec = 1000000};
    nanosleep(&delay, NULL);
  }
  return -1;
}

int main(void) {
  pid_t holder = fork();
  if (holder < 0) return 10;
  if (holder > 0) return 0;

  pid_t daemon = fork();
  if (daemon < 0) _exit(11);
  if (daemon > 0) {
    dprintf(STDOUT_FILENO, "ORPHAN_HOLDER_PID=%ld\n", (long)daemon);
    _exit(0);
  }
  if (prctl(PR_SET_CHILD_SUBREAPER, 1) != 0) _exit(12);

  int child_pipe[2];
  if (pipe(child_pipe) != 0) _exit(13);
  pid_t parent = fork();
  if (parent < 0) _exit(14);
  if (parent == 0) {
    close(child_pipe[0]);
    pid_t child = fork();
    if (child < 0) _exit(15);
    if (child == 0) _exit(0);
    if (write(child_pipe[1], &child, sizeof(child)) != (ssize_t)sizeof(child)) _exit(16);
    close(child_pipe[1]);
    if (wait_for_exit_without_reaping(child) != 0) _exit(17);
    _exit(0);
  }

  close(child_pipe[1]);
  pid_t child = -1;
  if (read(child_pipe[0], &child, sizeof(child)) != (ssize_t)sizeof(child)) _exit(18);
  close(child_pipe[0]);
  int parent_status = 0;
  if (waitpid(parent, &parent_status, 0) != parent || !WIFEXITED(parent_status) || WEXITSTATUS(parent_status) != 0) _exit(19);
  if (wait_for_exit_without_reaping(child) != 0) _exit(20);

  struct sigaction action = {0};
  action.sa_handler = request_release;
  sigemptyset(&action.sa_mask);
  if (sigaction(SIGUSR1, &action, NULL) != 0) _exit(21);
  printf("ORPHAN_PARENT_EXITED=1\nORPHAN_ZOMBIE_READY=1 PID=%ld SID=%ld PGID=%ld\n",
         (long)child, (long)getsid(0), (long)getpgid(0));
  fflush(stdout);

  while (!release_requested) {
    struct timespec delay = {.tv_sec = 0, .tv_nsec = 10000000};
    nanosleep(&delay, NULL);
  }
  int child_status = 0;
  if (waitpid(child, &child_status, 0) != child) _exit(22);
  printf("ORPHAN_ZOMBIE_REAPED=1\n");
  fflush(stdout);
  return 0;
}
