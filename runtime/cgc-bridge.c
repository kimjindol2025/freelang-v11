/* cgc-bridge.c — v11 compiler-only runtime helpers */
#include "runtime.h"
#include <string.h>

/* cgc-main.fl이 사용하는 v11 전용 헬퍼 */

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

FLValue fl_str_ends_with(FLValue str, FLValue suffix) {
    if (str.tag != FL_STRING || suffix.tag != FL_STRING) return fl_bool(false);
    const char* s = _cgcb_strval(str);
    const char* p = _cgcb_strval(suffix);
    size_t sl = strlen(s), pl = strlen(p);
    if (pl > sl) return fl_bool(false);
    return fl_bool(strcmp(s + sl - pl, p) == 0);
}
