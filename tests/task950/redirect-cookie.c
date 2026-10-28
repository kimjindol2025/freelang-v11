#include "runtime.h"
#include <stdio.h>
#include <string.h>
int main(void) {
    FLValue response = server_redirect_cookie(fl_str_val("/dashboard"), fl_str_val("test-cookie"));
    FLValue status = fl_map_get(response, fl_str_val("status"));
    FLValue location = fl_map_get(response, fl_str_val("location"));
    FLValue cookie = fl_map_get(response, fl_str_val("set_cookie"));
    int ok = response.tag == FL_MAP && status.tag == FL_INT && status.i == 302 &&
             location.tag == FL_STRING && strcmp(((FLString *)location.obj)->data, "/dashboard") == 0 &&
             cookie.tag == FL_STRING && strcmp(((FLString *)cookie.obj)->data, "test-cookie") == 0;
    printf("REDIRECT_COOKIE_STATUS=%lld FIELDS_VALID=%d\n", (long long)(status.tag == FL_INT ? status.i : -1), ok);
    return !ok;
}
