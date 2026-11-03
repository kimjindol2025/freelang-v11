/* Stateful byte transport. Protocol policy belongs to the language library. */
typedef struct FLConnectionTLS {
    int64_t id;
    char *host;
    SSL_CTX *ctx;
    SSL *ssl;
    BIO_METHOD *method;
    struct FLConnectionTLS *next;
} FLConnectionTLS;
static FLConnectionTLS *connection_states;
static FLConnectionTLS *connection_state(FLValue handle) {
    for (FLConnectionTLS *s = connection_states; s; s = s->next)
        if (handle.tag == FL_INT && s->id == handle.i) return s;
    return NULL;
}
static int connection_timeout(FLValue timeout) {
    return timeout.tag == FL_INT && timeout.i >= 1 && timeout.i <= 60000;
}
static FLValue connection_ok(FLValue value) {
    return fl_map_set(fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(true)), fl_str_val("value"), value);
}
FLValue _fl_connection_close(FLValue handle) {
    FLConnectionTLS **link = &connection_states;
    while (*link && !(handle.tag == FL_INT && (*link)->id == handle.i)) link = &(*link)->next;
    if (*link) {
        FLConnectionTLS *s = *link; *link = s->next;
        SSL_free(s->ssl); SSL_CTX_free(s->ctx); BIO_meth_free(s->method);
        free(s->host); free(s);
    }
    FLValue result = fl_tcp_close(handle);
    return result.tag == FL_BOOL && result.b ? connection_ok(fl_bool(true)) : result;
}
static FLValue connection_fail(FLValue handle, const char *code, const char *message) {
    (void)_fl_connection_close(handle);
    return transport_error(code, message);
}
FLValue _fl_connection_open(FLValue host, FLValue port, FLValue timeout) {
    fl_cap_require("tcp");
    if (host.tag != FL_STRING || !host.obj || !((FLString *)host.obj)->len ||
        strlen(fl_cstr(host)) != ((FLString *)host.obj)->len ||
        port.tag != FL_INT || port.i < 1 || port.i > 65535 || !connection_timeout(timeout))
        return transport_error("INVALID_ARGUMENT", "invalid connection arguments");
    int64_t deadline = transport_now() + timeout.i;
    /* Same bounded resolver pattern used by the existing HTTP transport. */
    int channel[2];
    if (pipe(channel)) return transport_error("DNS", "resolver pipe failed");
    pid_t child = fork();
    if (child == 0) {
        close(channel[0]);
        struct addrinfo hints = {0}, *addresses = NULL;
        hints.ai_family = AF_INET; hints.ai_socktype = SOCK_STREAM;
        if (!getaddrinfo(fl_cstr(host), NULL, &hints, &addresses)) {
            struct in_addr address = ((struct sockaddr_in *)addresses->ai_addr)->sin_addr;
            (void)write(channel[1], &address, sizeof(address)); freeaddrinfo(addresses);
        }
        close(channel[1]); _exit(0);
    }
    close(channel[1]);
    if (child < 0) { close(channel[0]); return transport_error("DNS", "resolver fork failed"); }
    struct sockaddr_in address = {0};
    address.sin_family = AF_INET; address.sin_port = htons((uint16_t)port.i);
    int ready = transport_wait(channel[0], POLLIN, deadline);
    ssize_t count = ready > 0 ? read(channel[0], &address.sin_addr, sizeof(address.sin_addr)) : -1;
    close(channel[0]);
    if (ready <= 0) kill(child, SIGKILL);
    while (waitpid(child, NULL, 0) < 0 && errno == EINTR) {}
    if (ready == 0) return transport_error("TIMEOUT", "DNS deadline exceeded");
    if (count != sizeof(address.sin_addr)) return transport_error("DNS", "resolution failed");
    int fd = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
    if (fd < 0) return transport_error("CONNECT", "socket failed");
    int result = connect(fd, (struct sockaddr *)&address, sizeof(address));
    if (result < 0 && errno != EINPROGRESS) { close(fd); return transport_error("CONNECT", "connect failed"); }
    if (result < 0) {
        ready = transport_wait(fd, POLLOUT, deadline);
        int error = 0; socklen_t size = sizeof(error);
        if (ready <= 0 || getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &size) || error) {
            close(fd); return transport_error(ready == 0 ? "TIMEOUT" : "CONNECT", "connect failed");
        }
    }
    FLValue handle = tcp_register(fd, 0);
    if (handle.tag != FL_INT) return handle;
    FLConnectionTLS *state = calloc(1, sizeof(*state));
    if (!state) return connection_fail(handle, "RESOURCE", "allocation failed");
    state->host = strdup(fl_cstr(host));
    if (!state->host) { free(state); return connection_fail(handle, "RESOURCE", "allocation failed"); }
    state->id = handle.i; state->next = connection_states; connection_states = state;
    return handle;
}
FLValue _fl_connection_starttls(FLValue handle, FLValue timeout) {
    FLTcpSocket *socket = tcp_lookup(handle);
    FLConnectionTLS *s = connection_state(handle);
    if (!socket || socket->listening || !s) return transport_error("INVALID_SOCKET", "unknown connection");
    if (!connection_timeout(timeout) || s->ssl) return transport_error("INVALID_ARGUMENT", "invalid TLS transition");
    int64_t deadline = transport_now() + timeout.i;
    s->ctx = SSL_CTX_new(TLS_client_method());
    if (!s->ctx) return connection_fail(handle, "TLS", "context failed");
    SSL_CTX_set_verify(s->ctx, SSL_VERIFY_PEER, NULL);
    if (!SSL_CTX_set_default_verify_paths(s->ctx)) return connection_fail(handle, "TLS", "trust store failed");
    s->ssl = SSL_new(s->ctx);
    if (!s->ssl) return connection_fail(handle, "TLS", "allocation failed");
    X509_VERIFY_PARAM *param = SSL_get0_param(s->ssl);
    X509_VERIFY_PARAM_set_hostflags(param, X509_CHECK_FLAG_NO_PARTIAL_WILDCARDS);
    struct in_addr ip;
    if (inet_pton(AF_INET, s->host, &ip) == 1) {
        if (!X509_VERIFY_PARAM_set1_ip_asc(param, s->host)) return connection_fail(handle, "TLS", "IP verification setup failed");
    } else if (!SSL_set1_host(s->ssl, s->host) || !SSL_set_tlsext_host_name(s->ssl, s->host))
        return connection_fail(handle, "TLS", "hostname verification setup failed");
    s->method = BIO_meth_new(BIO_TYPE_SOURCE_SINK, "FreeLang connection socket");
    if (!s->method || !BIO_meth_set_create(s->method, transport_bio_create) ||
        !BIO_meth_set_destroy(s->method, transport_bio_destroy) ||
        !BIO_meth_set_read(s->method, transport_bio_read) ||
        !BIO_meth_set_write(s->method, transport_bio_write) ||
        !BIO_meth_set_ctrl(s->method, transport_bio_ctrl)) return connection_fail(handle, "TLS", "BIO setup failed");
    BIO *bio = BIO_new(s->method);
    if (!bio) return connection_fail(handle, "TLS", "BIO allocation failed");
    BIO_set_data(bio, (void *)(intptr_t)socket->fd); SSL_set_bio(s->ssl, bio, bio);
    for (;;) {
        if (transport_now() >= deadline) return connection_fail(handle, "TIMEOUT", "TLS deadline exceeded");
        ERR_clear_error(); int n = SSL_connect(s->ssl);
        if (n == 1) break;
        int retry = transport_tls_wait(s->ssl, n, socket->fd, deadline);
        if (retry <= 0) return connection_fail(handle, retry == 0 ? "TIMEOUT" : "TLS", "TLS verification or handshake failed");
    }
    if (SSL_get_verify_result(s->ssl) != X509_V_OK) return connection_fail(handle, "TLS", "certificate rejected");
    return connection_ok(fl_bool(true));
}
FLValue _fl_connection_write(FLValue handle, FLValue bytes, FLValue timeout) {
    FLTcpSocket *socket = tcp_lookup(handle); FLConnectionTLS *s = connection_state(handle);
    if (!socket || socket->listening) return transport_error("INVALID_SOCKET", "unknown connection");
    if (bytes.tag != FL_STRING || !bytes.obj || !connection_timeout(timeout)) return transport_error("INVALID_ARGUMENT", "invalid write arguments");
    if (fcntl(socket->fd, F_SETFL, O_NONBLOCK) < 0) return connection_fail(handle, "IO", "nonblocking failed");
    FLString *text = (FLString *)bytes.obj;
    if (text->len > 16777216) return transport_error("SIZE", "write bound exceeded");
    size_t sent = 0; int64_t deadline = transport_now() + timeout.i;
    while (sent < text->len) {
        if (transport_now() >= deadline) return connection_fail(handle, "TIMEOUT", "write deadline exceeded");
        ssize_t n;
        if (s && s->ssl) {
            ERR_clear_error(); n = SSL_write(s->ssl, text->data + sent, (int)(text->len - sent));
            if (n <= 0) {
                int retry = transport_tls_wait(s->ssl, (int)n, socket->fd, deadline);
                if (retry > 0) continue;
                return connection_fail(handle, retry == 0 ? "TIMEOUT" : "TLS", "TLS write failed");
            }
        } else {
            int ready = transport_wait(socket->fd, POLLOUT, deadline);
            if (ready <= 0) return connection_fail(handle, ready == 0 ? "TIMEOUT" : "IO", "write failed");
            n = send(socket->fd, text->data + sent, text->len - sent, MSG_NOSIGNAL);
            if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
            if (n <= 0) return connection_fail(handle, "IO", "write failed");
        }
        sent += (size_t)n;
    }
    return connection_ok(fl_int((int64_t)sent));
}
/* count=0 reads one LF-terminated line; count>0 reads up to count bytes.
 * A timeout before any bytes preserves the handle for bounded polling.
 * Partial lines and terminal I/O errors close it, avoiding ambiguous retries. */
FLValue _fl_connection_read(FLValue handle, FLValue count, FLValue timeout, FLValue limit) {
    FLTcpSocket *socket = tcp_lookup(handle); FLConnectionTLS *s = connection_state(handle);
    if (!socket || socket->listening) return transport_error("INVALID_SOCKET", "unknown connection");
    if (!connection_timeout(timeout) || count.tag != FL_INT || count.i < 0 ||
        limit.tag != FL_INT || limit.i < 1 || limit.i > 1048576 || count.i > limit.i)
        return transport_error("INVALID_ARGUMENT", "invalid read arguments");
    if (fcntl(socket->fd, F_SETFL, O_NONBLOCK) < 0) return connection_fail(handle, "IO", "nonblocking failed");
    size_t cap = (size_t)(count.i ? count.i : limit.i);
    FLString *text = malloc(sizeof(*text) + cap + 1);
    if (!text) return connection_fail(handle, "RESOURCE", "allocation failed");
    size_t used = 0; int64_t deadline = transport_now() + timeout.i;
    for (;;) {
        ssize_t n; int retry = 1;
        if (transport_now() >= deadline) retry = 0;
        else if (s && s->ssl) {
            ERR_clear_error(); n = SSL_read(s->ssl, text->data + used, (int)(count.i ? cap : 1));
            if (n <= 0) {
                if (SSL_get_error(s->ssl, (int)n) == SSL_ERROR_ZERO_RETURN) n = 0;
                else { retry = transport_tls_wait(s->ssl, (int)n, socket->fd, deadline); if (retry > 0) continue; }
            }
        } else {
            retry = transport_wait(socket->fd, POLLIN, deadline);
            if (retry > 0) {
                n = recv(socket->fd, text->data + used, count.i ? cap : 1, 0);
                if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
                if (n < 0) retry = -1;
            }
        }
        if (retry <= 0) {
            free(text);
            if (!used && retry == 0) return transport_error("TIMEOUT", "read deadline exceeded");
            return connection_fail(handle, retry == 0 ? "TIMEOUT" : (s && s->ssl ? "TLS" : "IO"), "read failed");
        }
        if (n == 0) { free(text); return connection_fail(handle, "EOF", "peer closed"); }
        used += (size_t)n;
        if (count.i || text->data[used - 1] == '\n') break;
        if (used == cap) { free(text); return connection_fail(handle, "SIZE", "line bound exceeded"); }
    }
    text->base.type = FL_STRING; text->base.rc = 1; text->len = (uint32_t)used; text->data[used] = 0;
    FLValue value; value.tag = FL_STRING; value.obj = (FLObject *)text;
    return connection_ok(value);
}
