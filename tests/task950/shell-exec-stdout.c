#include "runtime.h"
#include <stdio.h>
#include <string.h>

int main(void) {
    FLValue output = shell_exec_stdout(fl_str_val("printf 'done\\n'"));
    FLValue failed = shell_exec_stdout(fl_str_val("false"));
    if (output.tag != FL_STRING || !output.obj) return 1;
    printf("SHELL_EXEC_STDOUT=%s", ((FLString *)output.obj)->data);
    printf("SHELL_EXEC_STDOUT_FAILURE_NIL=%d\n", failed.tag == FL_NIL);
    return strcmp(((FLString *)output.obj)->data, "done\n") != 0 || failed.tag != FL_NIL;
}
