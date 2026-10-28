#include "runtime.h"
#include <arpa/inet.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

static int serve(int listener, const char *method, const char *status) {
    int client = accept(listener, NULL, NULL);
    char request[2048] = {0};
    ssize_t n = client >= 0 ? recv(client, request, sizeof(request) - 1, 0) : -1;
    int valid = n > 0 && strncmp(request, method, strlen(method)) == 0;
    char response[128];
    int len = snprintf(response, sizeof(response), "HTTP/1.1 %s\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", status);
    if (client >= 0 && len > 0) (void)send(client, response, (size_t)len, 0);
    if (client >= 0) close(client);
    return valid;
}

static int64_t int_value(FLValue value) {
    return value.tag == FL_INT ? value.i : -1;
}

int main(void) {
    int listener = socket(AF_INET, SOCK_STREAM, 0);
    if (listener < 0) return 2;
    struct sockaddr_in address = {0};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener, (struct sockaddr *)&address, sizeof(address)) || listen(listener, 2)) return 2;
    socklen_t n = sizeof(address);
    if (getsockname(listener, (struct sockaddr *)&address, &n)) return 2;
    pid_t child = fork();
    if (child < 0) return 2;
    if (!child) {
        int ok = serve(listener, "HEAD / HTTP/1.0", "200 OK");
        ok &= serve(listener, "DELETE / HTTP/1.0", "204 No Content");
        close(listener);
        _exit(ok ? 0 : 1);
    }
    close(listener);
    char url[128];
    snprintf(url, sizeof(url), "http://127.0.0.1:%u/", (unsigned)ntohs(address.sin_port));
    FLValue head = http_head(fl_str_val(url));
    FLValue del = http_delete(fl_str_val(url));
    int status = 0;
    if (waitpid(child, &status, 0) != child) return 2;
    int head_status = (int)int_value(fl_map_get(head, fl_str_val("status")));
    int delete_status = (int)int_value(fl_map_get(del, fl_str_val("status")));
    int head_ok = head.tag == FL_MAP && head_status == 200;
    int delete_ok = del.tag == FL_MAP && delete_status == 204;
    printf("HTTP_HEAD_STATUS=%lld HTTP_DELETE_STATUS=%lld SERVER_VALID=%d\n",
           (long long)head_status, (long long)delete_status,
           WIFEXITED(status) && WEXITSTATUS(status) == 0);
    return !head_ok || !delete_ok || !WIFEXITED(status) || WEXITSTATUS(status) != 0;
}
