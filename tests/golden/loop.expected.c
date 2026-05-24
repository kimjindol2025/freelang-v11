#include "runtime.h"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-parameter"

static FLValue sum;


static FLValue __fl_anon_0(FLClosure*, int, FLValue*);

static FLValue __fl_anon_0(FLClosure* _self, int _argc, FLValue* argv) {
    (void)_self; (void)_argc;
    FLValue acc = argv[0];
    FLValue i = argv[1];
    return fl_add(acc, i);
}


int main(int argc, char** argv) {
    fl_init_argv(argc, argv);
    sum = fl_reduce_fn(fl_fn_new(__fl_anon_0, 0, NULL), fl_int(0), range(fl_int(10)));;
    fl_println(sum);
    return 0;
}
