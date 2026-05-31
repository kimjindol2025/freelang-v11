#include "runtime.h"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-parameter"




int main(int argc, char** argv) {
    fl_init_argv(argc, argv);
    fl_println(fl_str_val("Hello, world!"));
    fl_println(fl_add(fl_int(1), fl_int(2)));
    fl_println(fl_mul(fl_int(3), fl_int(4)));
    return 0;
}
