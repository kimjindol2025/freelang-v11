#include "runtime.h"
#include <stdio.h>

int main(void) {
    FLValue output = shell(fl_str_val("printf 'alpha\\n'"));
    if (output.tag != FL_STRING || !output.obj) return 1;
    printf("SHELL_OUTPUT_BEGIN\n%sSHELL_OUTPUT_END\n", ((FLString *)output.obj)->data);
    return 0;
}
