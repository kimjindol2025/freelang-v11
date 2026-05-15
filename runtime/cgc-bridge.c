/* cgc-bridge.c — S27: fl_parse 래퍼 (parser.c + runtime.c 연결) */
#include "runtime.h"

/* parser.c에서 제공 */
extern FLValue lex(FLValue src);
extern FLValue parse(FLValue tokens);

FLValue fl_parse(FLValue src) {
    return parse(lex(src));
}
