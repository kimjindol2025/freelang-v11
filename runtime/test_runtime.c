#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

#define PASS(name) printf("PASS %s\n", name)
#define FAIL(name) do { printf("FAIL %s\n", name); exit(1); } while(0)
#define CHECK(cond, name) do { if (!(cond)) FAIL(name); else PASS(name); } while(0)

int main(void) {
    /* ── 값 생성 ── */
    FLValue ni = fl_nil();
    CHECK(ni.tag == FL_NIL, "fl_nil tag");

    FLValue i42 = fl_int(42);
    CHECK(i42.tag == FL_INT && i42.i == 42, "fl_int");

    FLValue f3 = fl_float(3.14);
    CHECK(f3.tag == FL_FLOAT && f3.f > 3.0, "fl_float");

    FLValue bt = fl_bool(true);
    FLValue bf = fl_bool(false);
    CHECK(bt.b == true && bf.b == false, "fl_bool");

    FLValue s = fl_str_val("hello");
    CHECK(s.tag == FL_STRING, "fl_str_val tag");
    CHECK(strcmp(((FLString*)s.obj)->data, "hello") == 0, "fl_str_val data");

    /* ── 조건 판별 ── */
    CHECK(fl_truthy(bt) == true, "truthy bool true");
    CHECK(fl_truthy(bf) == false, "truthy bool false");
    CHECK(fl_truthy(ni) == false, "truthy nil");
    CHECK(fl_truthy(fl_int(0)) == false, "truthy int 0");
    CHECK(fl_truthy(fl_int(1)) == true, "truthy int 1");

    /* ── 산술 ── */
    FLValue a = fl_add(fl_int(10), fl_int(20));
    CHECK(a.tag == FL_INT && a.i == 30, "fl_add int");

    FLValue b = fl_sub(fl_int(10), fl_int(3));
    CHECK(b.i == 7, "fl_sub");

    FLValue m = fl_mul(fl_int(4), fl_int(5));
    CHECK(m.i == 20, "fl_mul");

    FLValue d = fl_div(fl_int(10), fl_int(2));
    CHECK(d.i == 5, "fl_div");

    FLValue md = fl_mod(fl_int(10), fl_int(3));
    CHECK(md.i == 1, "fl_mod");

    /* ── 비교 ── */
    CHECK(fl_truthy(fl_eq(fl_int(5), fl_int(5))), "fl_eq true");
    CHECK(!fl_truthy(fl_eq(fl_int(5), fl_int(6))), "fl_eq false");
    CHECK(fl_truthy(fl_lt(fl_int(3), fl_int(5))), "fl_lt true");
    CHECK(!fl_truthy(fl_lt(fl_int(5), fl_int(3))), "fl_lt false");
    CHECK(fl_truthy(fl_lte(fl_int(5), fl_int(5))), "fl_lte eq");
    CHECK(fl_truthy(fl_gt(fl_int(5), fl_int(3))), "fl_gt");
    CHECK(fl_truthy(fl_gte(fl_int(5), fl_int(5))), "fl_gte eq");
    CHECK(fl_truthy(fl_neq(fl_int(3), fl_int(4))), "fl_neq");

    /* ── 논리 ── */
    CHECK(!fl_truthy(fl_not(bt)), "fl_not true");
    CHECK(fl_truthy(fl_not(bf)), "fl_not false");

    /* ── 문자열 ── */
    FLValue cat = fl_str_n(2, fl_str_val("foo"), fl_str_val("bar"));
    CHECK(strcmp(((FLString*)cat.obj)->data, "foobar") == 0, "fl_str_n concat");

    FLValue sa = fl_add(fl_str_val("hello"), fl_str_val(" world"));
    CHECK(strcmp(((FLString*)sa.obj)->data, "hello world") == 0, "fl_add string");

    /* ── 파일 I/O ── */
    FLValue path = fl_str_val("/tmp/fl_test_runtime.txt");
    FLValue written = fl_file_write(path, fl_str_val("test content"));
    CHECK(written.tag == FL_NIL, "fl_file_write returns nil");

    FLValue read = fl_file_read(path);
    CHECK(read.tag == FL_STRING, "fl_file_read tag");
    CHECK(strcmp(((FLString*)read.obj)->data, "test content") == 0, "fl_file_read data");

    /* ── Vector ── */
    FLValue vn = fl_vec_new();
    CHECK(vn.tag == FL_VECTOR, "fl_vec_new tag");
    CHECK(fl_vec_len(vn).i == 0, "fl_vec_new len");

    FLValue items[3] = { fl_int(10), fl_int(20), fl_int(30) };
    FLValue vf = fl_vec_from(items, 3);
    CHECK(fl_vec_len(vf).i == 3, "fl_vec_from len");
    CHECK(fl_vec_get(vf, fl_int(0)).i == 10, "fl_vec_get 0");
    CHECK(fl_vec_get(vf, fl_int(2)).i == 30, "fl_vec_get 2");

    FLValue vp = fl_vec_push(vf, fl_int(40));
    CHECK(fl_vec_len(vf).i == 3, "fl_vec_push original unchanged");
    CHECK(fl_vec_len(vp).i == 4, "fl_vec_push new len");
    CHECK(fl_vec_get(vp, fl_int(3)).i == 40, "fl_vec_push new elem");

    FLValue vs = fl_vec_set(vf, fl_int(1), fl_int(99));
    CHECK(fl_vec_get(vf, fl_int(1)).i == 20, "fl_vec_set original unchanged");
    CHECK(fl_vec_get(vs, fl_int(1)).i == 99, "fl_vec_set new val");

    FLValue voob = fl_vec_get(vf, fl_int(99));
    CHECK(voob.tag == FL_NIL, "fl_vec_get OOB returns nil");

    /* ── Map ── */
    FLValue mn = fl_map_new();
    CHECK(mn.tag == FL_MAP, "fl_map_new tag");
    CHECK(fl_map_len(mn).i == 0, "fl_map_new len");

    FLValue kv[4] = { fl_str_val("a"), fl_int(1), fl_str_val("b"), fl_int(2) };
    FLValue mf = fl_map_from_pairs(kv, 2);
    CHECK(fl_map_len(mf).i == 2, "fl_map_from_pairs len");
    CHECK(fl_map_get(mf, fl_str_val("a")).i == 1, "fl_map_get a");
    CHECK(fl_map_get(mf, fl_str_val("b")).i == 2, "fl_map_get b");
    CHECK(fl_map_get(mf, fl_str_val("z")).tag == FL_NIL, "fl_map_get missing");

    FLValue ms = fl_map_set(mf, fl_str_val("c"), fl_int(3));
    CHECK(fl_map_len(mf).i == 2, "fl_map_set original unchanged");
    CHECK(fl_map_len(ms).i == 3, "fl_map_set new len");
    CHECK(fl_map_get(ms, fl_str_val("c")).i == 3, "fl_map_set new val");

    FLValue mu = fl_map_set(mf, fl_str_val("a"), fl_int(99));
    CHECK(fl_map_len(mu).i == 2, "fl_map_set upsert len unchanged");
    CHECK(fl_map_get(mu, fl_str_val("a")).i == 99, "fl_map_set upsert val");

    /* ── 수치 출력 ── */
    printf("fl_println: ");
    fl_println(fl_int(42));
    printf("(above should be 42)\n");

    printf("\nAll tests PASS\n");
    return 0;
}