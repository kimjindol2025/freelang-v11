#include "runtime.h"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-parameter"

FLValue fib_recur(FLValue n, FLValue a, FLValue b);
static FLValue __fl_wrap_fib_recur(FLClosure*, int, FLValue*);
FLValue fib(FLValue n);
static FLValue __fl_wrap_fib(FLClosure*, int, FLValue*);


static FLValue __fl_wrap_fib_recur(FLClosure* _s, int _ac, FLValue* argv) {
    (void)_s; (void)_ac;
    return fib_recur(argv[0], argv[1], argv[2]);
}

static FLValue __fl_wrap_fib(FLClosure* _s, int _ac, FLValue* argv) {
    (void)_s; (void)_ac;
    return fib(argv[0]);
}


FLValue fib_recur(FLValue n, FLValue a, FLValue b) {
    return (fl_truthy(fl_lte(n, fl_int(0))) ? a : /* orphan recur */ fl_nil());
}

FLValue fib(FLValue n) {
    return fib_recur(n, fl_int(0), fl_int(1));
}

int main(int argc, char** argv) {
    fl_init_argv(argc, argv);
    fl_println(fib(fl_int(10)));
    return 0;
}
