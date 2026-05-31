#ifndef FREELANG_RUNTIME_INTERNAL_H
#define FREELANG_RUNTIME_INTERNAL_H

#include "runtime.h"

/* io.c에서 정의, process.c·error.c가 공유 */
const char* _strval(FLValue v);

/* core.c에서 정의, io.c의 str_join이 사용 */
const char* fl_to_str(FLValue v, char* buf, size_t sz);

#endif /* FREELANG_RUNTIME_INTERNAL_H */
