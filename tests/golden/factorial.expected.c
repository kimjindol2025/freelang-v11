#include "runtime.h"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-parameter"

FLValue factorial(FLValue n);
static FLValue __fl_wrap_factorial(FLClosure*, int, FLValue*);


static FLValue __fl_wrap_factorial(FLClosure* _s, int _ac, FLValue* argv) {
    (void)_s; (void)_ac;
    return factorial(argv[0]);
}


FLValue factorial(FLValue n) {
    return (fl_truthy(fl_lte(n, fl_int(1))) ? fl_int(1) : fl_mul(n, factorial(fl_sub(n, fl_int(1)))));
}

int main(int argc, char** argv) {
    fl_init_argv(argc, argv);
    fl_println(factorial(fl_int(5)));
    return 0;
}
