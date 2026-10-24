#ifndef FREELANG_RUNTIME_H
#define FREELANG_RUNTIME_H

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdarg.h>
#include <setjmp.h>

/* ── ABI 헌법 (self/ABI.md) ── */

typedef enum {
    FL_INT,
    FL_FLOAT,
    FL_BOOL,
    FL_NIL,
    FL_STRING,
    FL_VECTOR,
    FL_MAP,
    FL_FN
} FLTag;

typedef struct FLObject FLObject;

typedef struct {
    FLTag tag;
    union {
        int64_t  i;
        double   f;
        bool     b;
        FLObject* obj;
    };
} FLValue;

struct FLObject {
    FLTag    type;
    uint32_t rc;
};

typedef struct {
    FLObject base;
    uint32_t len;
    char     data[];
} FLString;

/* ── S5: Heap Object System ── */

typedef struct {
    FLValue key;
    FLValue val;
} FLMapEntry;

typedef struct {
    FLObject  base;   /* type = FL_VECTOR */
    uint32_t  len;
    uint32_t  cap;
    FLValue*  data;
} FLVector;

typedef struct {
    FLObject    base;  /* type = FL_MAP */
    uint32_t    len;
    uint32_t    cap;
    FLMapEntry* entries;
} FLMap;

/* ── 값 생성 ── */
FLValue fl_int(int64_t v);
FLValue fl_float(double v);
FLValue fl_str_val(const char* s);
const char* fl_to_str(FLValue v, char* buf, size_t sz);
FLValue fl_bool(bool v);
FLValue fl_nil(void);

/* ── 조건 판별 ── */
bool fl_truthy(FLValue v);

/* ── 산술 ── */
FLValue fl_add(FLValue a, FLValue b);
FLValue fl_sub(FLValue a, FLValue b);
FLValue fl_mul(FLValue a, FLValue b);
FLValue fl_div(FLValue a, FLValue b);
FLValue fl_mod(FLValue a, FLValue b);
FLValue fl_quot(FLValue a, FLValue b);
FLValue fl_rem(FLValue a, FLValue b);

/* ── 비교 ── */
FLValue fl_eq(FLValue a, FLValue b);
FLValue fl_lt(FLValue a, FLValue b);
FLValue fl_gt(FLValue a, FLValue b);
FLValue fl_lte(FLValue a, FLValue b);
FLValue fl_gte(FLValue a, FLValue b);
FLValue fl_neq(FLValue a, FLValue b);

/* ── 논리 ── */
FLValue fl_not(FLValue a);
FLValue fl_and(FLValue a, FLValue b);
FLValue fl_or(FLValue a, FLValue b);

/* ── 문자열 ── */
FLValue fl_str_n(int count, ...);

/* ── I/O ── */
FLValue fl_println(FLValue v);
FLValue fl_print(FLValue v);

/* ── 파일 I/O ── */
FLValue fl_file_read(FLValue path);
FLValue fl_file_write(FLValue path, FLValue content);

/* ── Vector ── */
FLValue fl_vec_new(void);
FLValue fl_vec_from(FLValue* items, uint32_t n);
FLValue fl_vec_get(FLValue vec, FLValue idx);
FLValue fl_vec_set(FLValue vec, FLValue idx, FLValue val);
FLValue fl_vec_push(FLValue vec, FLValue val);
FLValue fl_append(FLValue left, FLValue right);
FLValue fl_vec_len(FLValue vec);
FLValue fl_vec_take(FLValue count, FLValue vec);
FLValue fl_vec_drop(FLValue count, FLValue vec);

/* ── Map ── */
FLValue fl_map_new(void);
FLValue fl_map_from_pairs(FLValue* kv, uint32_t n); /* n = 쌍의 수 */
FLValue fl_map_get(FLValue map, FLValue key);
FLValue fl_map_set(FLValue map, FLValue key, FLValue val);
FLValue fl_map_len(FLValue map);

/* ── SQLite ── */
FLValue fl_db_open(FLValue path);
FLValue fl_db_close(FLValue db);
FLValue fl_db_query(FLValue db, FLValue sql, FLValue params);
FLValue fl_db_exec(FLValue db, FLValue sql, FLValue params);

/* ── HTTP server ── */
FLValue fl_http_start(FLValue port);
FLValue fl_http_stop(void);
FLValue fl_http_route(FLValue method, FLValue path, FLValue handler);
FLValue fl_resp_json(FLValue value);
FLValue fl_resp_status(FLValue status, FLValue body);
FLValue fl_resp_redirect(FLValue location);
FLValue fl_resp_html(FLValue body);
FLValue fl_resp_html_cookie(FLValue cookie, FLValue body);
FLValue fl_resp_set_cookie(FLValue response, FLValue name, FLValue value);
FLValue fl_auth_random_token(FLValue bytes);
FLValue fl_auth_pbkdf2(FLValue password, FLValue salt, FLValue iterations);
FLValue fl_auth_constant_time_equal(FLValue left, FLValue right);
FLValue fl_auth_hash_password(FLValue password);
FLValue fl_auth_verify_password(FLValue password, FLValue encoded_hash);
FLValue fl_jwt_sign(FLValue payload, FLValue secret, FLValue expiry_seconds);
FLValue fl_jwt_verify(FLValue token, FLValue secret);
/* Unverified payload only; never use for authentication decisions. */
FLValue fl_jwt_decode(FLValue token);
FLValue fl_jwt_expired(FLValue token);
FLValue server_put(FLValue path, FLValue handler);
FLValue server_delete(FLValue path, FLValue handler);
FLValue server_workers(FLValue count);
FLValue server_body_limit(FLValue bytes);
FLValue server_rate_limit(FLValue count, FLValue window_ms);
FLValue server_req_header(FLValue request, FLValue name);
FLValue server_req_json(FLValue request);

/* ── S7: Closure ── */
typedef struct FLClosure {
    FLObject base;   /* type = FL_FN */
    FLValue (*call)(struct FLClosure* self, int argc, FLValue* argv);
    uint32_t nenv;
    FLValue  env[];  /* flexible array — captured values */
} FLClosure;

FLValue fl_fn_new(FLValue (*call)(FLClosure*, int, FLValue*),
                  uint32_t nenv, FLValue* env);
FLValue fl_fn_call(FLValue fn, int argc, FLValue* argv);

/* ── S8: 고차함수 ── */
FLValue fl_map_fn(FLValue fn, FLValue vec);
FLValue fl_filter_fn(FLValue fn, FLValue vec);
FLValue fl_reduce_fn(FLValue fn, FLValue init, FLValue vec);
FLValue fl_any_p(FLValue fn, FLValue vec);
FLValue fl_none_p(FLValue fn, FLValue vec);
FLValue fl_count_if(FLValue fn, FLValue vec);
FLValue fl_find_first(FLValue fn, FLValue vec);
FLValue fl_keep(FLValue fn, FLValue vec);
FLValue fl_map_indexed(FLValue fn, FLValue vec);
FLValue fl_map_vals_fn(FLValue fn, FLValue map);
FLValue fl_comp(uint32_t count, FLValue* fns);
FLValue fl_get_in(FLValue obj, FLValue path, FLValue default_value);
FLValue fl_group_by(FLValue fn, FLValue vec);
FLValue fl_frequencies(FLValue vec);
FLValue fl_into(FLValue target, FLValue coll);
FLValue fl_conj(uint32_t count, FLValue* args);
FLValue fl_obj_pick(FLValue map, FLValue keys);
FLValue fl_obj_omit(FLValue map, FLValue keys);
FLValue fl_zip_with(FLValue fn, FLValue left, FLValue right);

/* ── S9: 맵 accessor ── */
FLValue fl_map_keys(FLValue map);
FLValue fl_map_vals(FLValue map);
FLValue fl_map_entries(FLValue map);

/* ── S22: argv ── */
void    fl_init_argv(int argc, char** argv);
FLValue fl_get_argv(void);
FLValue process_argv(void);
FLValue get_arg(FLValue index);
FLValue sys_args(void);
FLValue sys(FLValue key);

/* ── S12: bridge builtins (FL generic) ── */
FLValue null_p(FLValue v);
FLValue get(FLValue obj, FLValue key);
FLValue length(FLValue obj);
FLValue char_at(FLValue str, FLValue idx);
FLValue char_from_byte(FLValue byte);

/* ── S15: stdlib bridge ── */
FLValue fl_floor(FLValue x);
FLValue fl_ceil(FLValue x);
FLValue fl_abs(FLValue x);
FLValue fl_math_sqrt(FLValue x);
FLValue fl_now(void);
FLValue fl_now_ms(void);
FLValue fl_now_iso(void);
FLValue now_iso(void);
FLValue fl_text(FLValue v);
FLValue fl_str_to_num(FLValue s);
FLValue string_p(FLValue v);
FLValue array_p(FLValue v);
FLValue list_p(FLValue v);
FLValue map_p(FLValue v);
FLValue fn_p(FLValue v);
FLValue fl_fn_p(FLValue v);
FLValue type_of(FLValue v);
FLValue str_replace(FLValue s, FLValue from, FLValue to);
FLValue split(FLValue s, FLValue sep);
FLValue join(FLValue vec, FLValue sep);
FLValue fl_str_join(FLValue a, FLValue b);
FLValue fl_template_interp(FLValue tmpl);
FLValue range(FLValue start, FLValue end);
FLValue char_code_at(FLValue s, FLValue idx);
FLValue substring(FLValue s, FLValue start, FLValue end);
FLValue trim(FLValue s);
FLValue index_of(FLValue vec, FLValue val);
FLValue str_index_of(FLValue s, FLValue sub);

/* ── S26: atom (mutable cell) ── */
FLValue fl_atom_new(FLValue init);
FLValue fl_atom_deref(FLValue atom);
FLValue fl_atom_reset(FLValue atom, FLValue val);

/* ── S26: stdlib bridge ── */
FLValue fl_includes_item(FLValue vec, FLValue item);
FLValue fl_str_includes(FLValue s, FLValue sub);
FLValue str_contains_in(FLValue s, FLValue pattern);
FLValue fl_string_p(FLValue v);
FLValue fl_vec_slice(FLValue vec, FLValue start, FLValue end);
FLValue fl_vec_last(FLValue vec);
FLValue fl_vec_rest(FLValue vec);
FLValue drop_while(FLValue pred, FLValue vec);
FLValue fl_sort_by(FLValue fn, FLValue vec);
FLValue fl_map_del(FLValue map, FLValue key);
FLValue fl_map_merge(FLValue a, FLValue b);
FLValue fl_concat(FLValue a, FLValue b);

/* ── S27: FL 소스 → AST (cgc-bridge.c + parser.c에서 제공) ── */
FLValue fl_parse(FLValue src);
FLValue fl_map_p(FLValue v);
FLValue fl_str_starts_with(FLValue str, FLValue prefix);
FLValue fl_str_ends_with(FLValue str, FLValue suffix);
FLValue fl_array_p(FLValue v);
FLValue fl_number_p(FLValue v);
FLValue fl_float_p(FLValue v);
FLValue fl_integer_p(FLValue v);
FLValue fl_boolean_p(FLValue v);
FLValue fl_every_p(FLValue fn, FLValue vec);
FLValue contains_p(FLValue coll, FLValue item);
FLValue fl_vec_first(FLValue vec);
FLValue reverse(FLValue vec);
FLValue fl_mapcat(FLValue fn, FLValue vec);
FLValue str_split(FLValue s, FLValue sep);
FLValue str_trim(FLValue s);
FLValue str_lower(FLValue s);
FLValue str_to_upper(FLValue s);
FLValue sort(FLValue vec);
FLValue dir_list(FLValue path);
FLValue dir_exists_p(FLValue path);
FLValue file_is_file(FLValue path);
FLValue json_has(FLValue obj, FLValue key);
FLValue json_parse_wrap(FLClosure* self, int argc, FLValue* argv);
FLValue max(FLValue a, FLValue b);
FLValue fl_html_escape(FLValue s);
FLValue fl_str_pad_left(FLValue s, FLValue width, FLValue pad);
FLValue fl_str_pad_right(FLValue s, FLValue width, FLValue pad);
FLValue fl_str_repeat(FLValue s, FLValue count);
FLValue fl_not_empty_p(FLValue v);
FLValue fl_nil_or_empty_p(FLValue v);
FLValue fl_distinct(FLValue vec);
FLValue fl_flatten(FLValue vec);
FLValue fl_flatten_1(FLValue vec);
FLValue fl_zip(FLValue left, FLValue right);
FLValue fl_repeat(FLValue count, FLValue value);
FLValue fl_sleep_ms(FLValue ms);

/* ── JSON ── */
FLValue fl_json_parse(FLValue src);
FLValue fl_json_stringify(FLValue val);

/* ── 비트 연산 ── */
FLValue fl_bit_xor(FLValue a, FLValue b);
FLValue fl_bit_and(FLValue a, FLValue b);
FLValue fl_bit_or(FLValue a, FLValue b);
FLValue fl_bit_shl(FLValue a, FLValue b);
FLValue fl_bit_shr(FLValue a, FLValue b);

/* ── _fl_process_* ── */
FLValue _fl_process_getcwd(void);
FLValue _fl_process_chdir(FLValue path);
FLValue _fl_process_pid(void);
FLValue _fl_process_ppid(void);
FLValue _fl_process_kill(FLValue pid);
FLValue _fl_process_exists(FLValue pid);
FLValue _fl_process_wait(FLValue pid);
FLValue _fl_process_run(FLValue cmd);
FLValue fl_tcp_bind(FLValue address, FLValue port);
FLValue fl_tcp_listen(FLValue address, FLValue port);
FLValue fl_tcp_accept(FLValue socket, FLValue timeout);
FLValue fl_tcp_close(FLValue socket);
FLValue fl_tcp_local_port(FLValue socket);
FLValue _fl_process_run_args(FLValue cmd, FLValue args);
FLValue _fl_run_inherit(FLValue cmd);
FLValue fl_gcc_syntax_check(FLValue source, FLValue include_dir);
FLValue _fl_process_exec(FLValue cmd);
FLValue _fl_process_exec_args(FLValue cmd, FLValue args);
FLValue _fl_process_spawn(FLValue cmd, FLValue args);
FLValue process_spawn(FLValue cmd, FLValue args);
FLValue _fl_test_isolate(FLValue callback);
FLValue _fl_exit(FLValue code);
FLValue capability_list(void);
FLValue capability_enable(FLValue name);
FLValue capability_disable(FLValue name);
FLValue capability_enabled_p(FLValue name);
FLValue git_status(FLValue root);
FLValue git_head(FLValue root);
FLValue git_branch(FLValue root);
FLValue git_diff_name_only(FLValue root);
FLValue http_get(FLValue url);
FLValue fl_http_get(FLValue url);
FLValue fl_http_get_headers(FLValue url, FLValue headers);
FLValue fl_http_post(FLValue url, FLValue body);
FLValue fl_http_post_headers(FLValue url, FLValue headers, FLValue body);
FLValue fl_http_post_stream(FLValue url, FLValue headers, FLValue body, FLValue callback);
FLValue fl_http_stream_collect(FLValue url, FLValue headers, FLValue body);
FLValue fl_uuid(void);
FLValue _fl_http_exchange(FLValue host, FLValue port, FLValue wire, FLValue timeout, FLValue limit, FLValue callback);
FLValue _fl_fs_io(FLValue operation, FLValue path, FLValue content);
FLValue shell_cwd(void);

/* ── _fl_file_* / _fl_env_* / str_join ── */
FLValue _fl_file_append(FLValue path, FLValue content);
FLValue file_exists(FLValue path);
FLValue _fl_file_delete(FLValue path);
FLValue _fl_file_copy(FLValue src, FLValue dst);
FLValue _fl_file_rename(FLValue old, FLValue nw);
FLValue _fl_file_size(FLValue path);
FLValue _fl_file_modified(FLValue path);
FLValue _fl_file_mkdir(FLValue path);
FLValue _fl_file_rmdir(FLValue path);
FLValue _fl_file_list(FLValue path);
FLValue _fl_file_is_file(FLValue path);
FLValue _fl_file_is_dir(FLValue path);
FLValue _fl_env_get(FLValue key);
FLValue shell_env(FLValue varname);
FLValue _fl_env_set(FLValue key, FLValue val);
FLValue _fl_env_all(void);
FLValue str_join(FLValue sep, FLValue vec);

/* ── try/catch 인프라 ── */
#define FL_TRY_MAX 64
typedef struct { jmp_buf buf; FLValue err; } FLTryFrame;
extern FLTryFrame fl_try_stack[FL_TRY_MAX];
extern int fl_try_top;
void fl_throw(FLValue err);
FLValue fl_cgc_halt(void);
FLValue fl_make_error(const char* type, const char* msg);
FLValue fl_is(FLValue val);
FLValue is_eq(FLValue expected, FLValue actual);
void fl_test_pass(FLValue name);
void fl_test_fail(FLValue name, FLValue err);
FLValue test_summary(void);
FLValue run_tests(void);
FLValue try_call(FLValue fn);
FLValue err_p(FLValue r);
FLValue ok_p(FLValue r);
FLValue unwrap_result(FLValue r);
FLValue fl_template_bound(FLValue tmpl, FLValue env);

/* ── 연산자 first-class 래퍼 (HOF 인자로 사용 가능, e.g. (map + list)) ── */
static inline FLValue __fl_op_add_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_add(a[0], a[1]); }
static inline FLValue __fl_op_sub_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_sub(a[0], a[1]); }
static inline FLValue __fl_op_mul_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_mul(a[0], a[1]); }
static inline FLValue __fl_op_div_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_div(a[0], a[1]); }
static inline FLValue __fl_op_mod_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_mod(a[0], a[1]); }
static inline FLValue __fl_op_eq_w (FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_eq (a[0], a[1]); }
static inline FLValue __fl_op_neq_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_neq(a[0], a[1]); }
static inline FLValue __fl_op_lt_w (FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_lt (a[0], a[1]); }
static inline FLValue __fl_op_gt_w (FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_gt (a[0], a[1]); }
static inline FLValue __fl_op_lte_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_lte(a[0], a[1]); }
static inline FLValue __fl_op_gte_w(FLClosure* _s, int _ac, FLValue* a) { (void)_s;(void)_ac; return fl_gte(a[0], a[1]); }

#endif /* FREELANG_RUNTIME_H */
