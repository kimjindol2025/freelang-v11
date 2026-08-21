/* cgc-bridge.c — S27: fl_parse 래퍼 (parser.c + runtime.c 연결) */
#include "runtime.h"
#include <string.h>

/* parser.c에서 제공 */
extern FLValue fl_user_lex(FLValue src);
extern FLValue fl_user_parse(FLValue tokens);

FLValue fl_parse(FLValue src) {
    return fl_user_parse(fl_user_lex(src));
}

/* cgc-main.fl이 사용하는 추가 헬퍼 */

static inline const char* _cgcb_strval(FLValue v) {
    if (v.tag == FL_STRING && v.obj) return ((FLString*)v.obj)->data;
    return "";
}

FLValue fl_map_p(FLValue v) { return fl_bool(v.tag == FL_MAP); }

FLValue fl_str_starts_with(FLValue str, FLValue prefix) {
    const char* s = _cgcb_strval(str);
    const char* p = _cgcb_strval(prefix);
    size_t pl = strlen(p);
    return fl_bool(strncmp(s, p, pl) == 0);
}
