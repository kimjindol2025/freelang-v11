/* cgc-main.c — S27: cgc-bin entry point */
#include <stdio.h>
#include "runtime.h"

/* codegen-entry.c에서 제공 */
extern FLValue cgc_run(FLValue argv);

int main(int argc, char **argv) {
    /* argv[0] = 프로그램명 제외 */
    fl_init_argv(argc - 1, argv + 1);
    FLValue args = fl_get_argv();
    cgc_run(args);
    return 0;
}
