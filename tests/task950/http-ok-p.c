#include "runtime.h"
#include <stdio.h>

int main(void) {
    FLValue success = fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(true));
    FLValue failure = fl_map_set(fl_map_new(), fl_str_val("ok"), fl_bool(false));
    int success_result = fl_truthy(http_ok_p(success));
    int success_reference = fl_truthy(fl_http_ok_p(success));
    int failure_result = fl_truthy(http_ok_p(failure));
    int failure_reference = fl_truthy(fl_http_ok_p(failure));

    printf("HTTP_OK_TRUE=%d REF=%d\n", success_result, success_reference);
    printf("HTTP_OK_FALSE=%d REF=%d\n", failure_result, failure_reference);
    return success_result != success_reference || failure_result != failure_reference;
}
