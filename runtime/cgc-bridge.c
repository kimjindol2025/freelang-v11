/* cgc-bridge.c — S27: fl_parse 래퍼 (parser.c + runtime.c 연결) */
#include "runtime.h"

/* lex/parse 최소 구현 (사용자 코드용 stub) */
/* 일반적으로 사용자 코드에서는 호출되지 않음 */
/* 실제 lex/parse는 cgc-main.fl → gen1.c에서 완전 구현됨 */

FLValue lex(FLValue src) {
    (void)src;
    /* Stub: return empty token list */
    return fl_vec_new();
}

FLValue parse(FLValue tokens) {
    (void)tokens;
    /* Stub: return nil */
    return fl_nil();
}

FLValue fl_parse(FLValue src) {
    /* For compiler use only - not used by generated user code */
    return parse(lex(src));
}
