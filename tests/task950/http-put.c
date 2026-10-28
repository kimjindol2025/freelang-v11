#include "runtime.h"
#include <arpa/inet.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    int listener = socket(AF_INET, SOCK_STREAM, 0);
    if (listener < 0) return 2;
    struct sockaddr_in address = {0};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener, (struct sockaddr *)&address, sizeof(address)) != 0 || listen(listener, 1) != 0) return 2;
    socklen_t address_length = sizeof(address);
    if (getsockname(listener, (struct sockaddr *)&address, &address_length) != 0) return 2;
    pid_t child = fork();
    if (child < 0) return 2;
    if (child == 0) {
        int client = accept(listener, NULL, NULL);
        char request[4096] = {0};
        ssize_t received = client >= 0 ? recv(client, request, sizeof(request) - 1, 0) : -1;
        int valid = received > 0 && strncmp(request, "PUT / HTTP/1.0\r\n", 16) == 0 &&
                    strstr(request, "Content-Type: application/json\r\n") != NULL &&
                    strstr(request, "{\"x\":1}") != NULL;
        const char *body = valid ? "UPDATED" : "REJECTED";
        char response[128];
        int length = snprintf(response, sizeof(response),
                              "HTTP/1.1 200 OK\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s",
                              strlen(body), body);
        if (client >= 0 && length > 0) (void)send(client, response, (size_t)length, 0);
        if (client >= 0) close(client);
        close(listener);
        _exit(valid ? 0 : 1);
    }
    close(listener);
    char url[128];
    snprintf(url, sizeof(url), "http://127.0.0.1:%u/", (unsigned)ntohs(address.sin_port));
    FLValue value = http_put(fl_str_val(url), fl_str_val("{\"x\":1}"));
    int child_status = 0;
    if (waitpid(child, &child_status, 0) != child) return 2;
    if (value.tag != FL_STRING || !value.obj) return 1;
    printf("HTTP_PUT_BODY=%s SERVER_VALID=%d\n", ((FLString *)value.obj)->data,
           WIFEXITED(child_status) && WEXITSTATUS(child_status) == 0);
    return strcmp(((FLString *)value.obj)->data, "UPDATED") != 0 ||
           !WIFEXITED(child_status) || WEXITSTATUS(child_status) != 0;
}
