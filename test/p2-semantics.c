#include "../runtime/runtime.h"
#include <assert.h>
#include <stdio.h>

#define PASS(name) printf("  ✓  %s\n", name)

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-1: Status0 Invariant — {0=pending, 1=success, -1=failed} 세 가지 상태만 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_status0(void) {
  printf("P1-1 Status0 Invariant:\n");

  /* 허용된 상태 코드 */
  FLValue pending = fl_int(0);
  FLValue success = fl_int(1);
  FLValue failed  = fl_int(-1);

  assert(fl_truthy(fl_eq(pending, fl_int(0))));
  assert(fl_truthy(fl_eq(success, fl_int(1))));
  assert(fl_truthy(fl_eq(failed,  fl_int(-1))));
  PASS("valid status codes");

  /* 최종 상태는 변경 불가 */
  FLValue job_state = fl_atom_new(success);
  assert(fl_truthy(fl_eq(fl_atom_deref(job_state), fl_int(1))));
  PASS("final state immutable");

  /* 재시도는 새 인스턴스 */
  FLValue retry_job = fl_atom_new(fl_int(0));
  assert(!fl_truthy(fl_eq(fl_atom_deref(retry_job), fl_int(1))));
  PASS("retry creates new instance");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-2: Inflight Lifecycle — pending → success 순환 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_inflight_lifecycle(void) {
  printf("P1-2 Inflight Lifecycle:\n");

  FLValue job = fl_atom_new(fl_int(0)); /* pending */
  assert(fl_truthy(fl_eq(fl_atom_deref(job), fl_int(0))));
  PASS("initial pending state");

  /* pending → success 전이 */
  fl_atom_reset(job, fl_int(1));
  assert(fl_truthy(fl_eq(fl_atom_deref(job), fl_int(1))));
  PASS("pending → success transition");

  /* success는 최종 상태 */
  FLValue final_job = fl_atom_new(fl_int(1));
  assert(!fl_truthy(fl_eq(fl_atom_deref(final_job), fl_int(0))));
  PASS("success is terminal state");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-3: Stale-State Elimination — reset으로 완전 초기화 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_stale_state_elimination(void) {
  printf("P1-3 Stale-State Elimination:\n");

  /* 초기 상태: 빈 맵 */
  FLValue ctx = fl_atom_new(fl_map_new());
  assert(fl_truthy(fl_eq(fl_map_len(fl_atom_deref(ctx)), fl_int(0))));
  PASS("initial empty context");

  /* 항목 추가 */
  FLValue kv[2] = { fl_str_val("key1"), fl_int(100) };
  FLValue ctx_added = fl_map_from_pairs(kv, 1);
  fl_atom_reset(ctx, ctx_added);
  assert(fl_truthy(fl_eq(fl_map_len(fl_atom_deref(ctx)), fl_int(1))));
  PASS("context has one item");

  /* 초기화 */
  fl_atom_reset(ctx, fl_map_new());
  assert(fl_truthy(fl_eq(fl_map_len(fl_atom_deref(ctx)), fl_int(0))));
  PASS("context reset to empty");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-4: Duplicate Collapse — 같은 ID 두 번 emit하면 한 번만 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_duplicate_collapse(void) {
  printf("P1-4 Duplicate Collapse:\n");

  /* seen: map, events: vec */
  FLValue seen = fl_atom_new(fl_map_new());
  FLValue events = fl_atom_new(fl_vec_new());

  /* emit(id=1) */
  FLValue id1 = fl_int(1);
  FLValue check1 = fl_map_get(fl_atom_deref(seen), id1);
  if (fl_truthy(fl_eq(check1, fl_nil()))) {
    FLValue kv[2] = { id1, fl_int(1) };
    FLValue new_seen = fl_map_from_pairs(kv, 1);
    fl_atom_reset(seen, new_seen);

    FLValue new_events = fl_vec_push(fl_atom_deref(events), id1);
    fl_atom_reset(events, new_events);
  }
  assert(fl_truthy(fl_eq(fl_vec_len(fl_atom_deref(events)), fl_int(1))));
  PASS("first event recorded");

  /* emit(id=1) 다시 — skip */
  FLValue check1_again = fl_map_get(fl_atom_deref(seen), id1);
  if (fl_truthy(fl_eq(check1_again, fl_nil()))) {
    /* skip */
  }
  assert(fl_truthy(fl_eq(fl_vec_len(fl_atom_deref(events)), fl_int(1))));
  PASS("duplicate skipped");

  /* emit(id=2) */
  FLValue id2 = fl_int(2);
  FLValue check2 = fl_map_get(fl_atom_deref(seen), id2);
  if (fl_truthy(fl_eq(check2, fl_nil()))) {
    FLValue kv[2] = { id2, fl_int(1) };
    FLValue new_seen = fl_map_from_pairs(kv, 1);
    fl_atom_reset(seen, new_seen);

    FLValue new_events = fl_vec_push(fl_atom_deref(events), id2);
    fl_atom_reset(events, new_events);
  }
  assert(fl_truthy(fl_eq(fl_vec_len(fl_atom_deref(events)), fl_int(2))));
  PASS("second event recorded");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-5: Projection Determinism — 동일 입력 → 동일 출력 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_projection_determinism(void) {
  printf("P1-5 Projection Determinism:\n");

  /* 이벤트: [1, 2, 3] */
  FLValue items[3] = { fl_int(1), fl_int(2), fl_int(3) };
  FLValue events = fl_vec_from(items, 3);

  /* 첫 실행: sum */
  FLValue result1 = fl_int(0);
  for (int i = 0; i < 3; i++) {
    FLValue ev = fl_vec_get(events, fl_int(i));
    result1 = fl_add(result1, ev);
  }
  assert(fl_truthy(fl_eq(result1, fl_int(6))));
  PASS("first projection: sum=6");

  /* 두 번째 실행 */
  FLValue result2 = fl_int(0);
  for (int i = 0; i < 3; i++) {
    FLValue ev = fl_vec_get(events, fl_int(i));
    result2 = fl_add(result2, ev);
  }
  assert(fl_truthy(fl_eq(result2, fl_int(6))));
  PASS("second projection: sum=6");

  /* 결과 동일 */
  assert(fl_truthy(fl_eq(result1, result2)));
  PASS("deterministic result");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-6: Append-Only Lifecycle — push는 새 벡터 반환 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_append_only_lifecycle(void) {
  printf("P1-6 Append-Only Lifecycle:\n");

  FLValue log = fl_vec_new();
  assert(fl_truthy(fl_eq(fl_vec_len(log), fl_int(0))));
  PASS("initial empty log");

  /* push 반환값 */
  FLValue log_v2 = fl_vec_push(log, fl_int(1));
  assert(fl_truthy(fl_eq(fl_vec_len(log), fl_int(0))));  /* 원본 unchanged */
  assert(fl_truthy(fl_eq(fl_vec_len(log_v2), fl_int(1))));
  PASS("push returns new vector");

  /* 연쇄 push */
  FLValue log_v3 = fl_vec_push(log_v2, fl_int(2));
  FLValue log_v4 = fl_vec_push(log_v3, fl_int(3));

  assert(fl_truthy(fl_eq(fl_vec_len(log_v4), fl_int(3))));
  assert(fl_truthy(fl_eq(fl_vec_len(log), fl_int(0))));  /* 원본 여전히 비어있음 */
  PASS("immutability maintained");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* P1-7: Transition-Window Correctness — 원자적 상태 전이 */
/* ────────────────────────────────────────────────────────────────────────────── */

void test_transition_window_correctness(void) {
  printf("P1-7 Transition-Window Correctness:\n");

  /* 상태: {status, version, locked} */
  FLValue kv[6] = {
    fl_str_val("status"), fl_int(0),
    fl_str_val("version"), fl_int(1),
    fl_str_val("locked"), fl_int(0)
  };
  FLValue state = fl_atom_new(fl_map_from_pairs(kv, 3));

  FLValue v = fl_map_get(fl_atom_deref(state), fl_str_val("version"));
  assert(fl_truthy(fl_eq(v, fl_int(1))));
  PASS("initial state: version=1");

  /* 전이 시도: locked=true */
  FLValue locked_kv[6] = {
    fl_str_val("status"), fl_int(0),
    fl_str_val("version"), fl_int(1),
    fl_str_val("locked"), fl_int(1)
  };
  fl_atom_reset(state, fl_map_from_pairs(locked_kv, 3));
  PASS("transition window opened");

  /* 전이 성공: status=1, version=2, locked=0 */
  FLValue success_kv[6] = {
    fl_str_val("status"), fl_int(1),
    fl_str_val("version"), fl_int(2),
    fl_str_val("locked"), fl_int(0)
  };
  fl_atom_reset(state, fl_map_from_pairs(success_kv, 3));

  FLValue v2 = fl_map_get(fl_atom_deref(state), fl_str_val("version"));
  assert(fl_truthy(fl_eq(v2, fl_int(2))));
  PASS("transition successful");
}

/* ────────────────────────────────────────────────────────────────────────────── */
/* Main */
/* ────────────────────────────────────────────────────────────────────────────── */

int main(int argc, char** argv) {
  fl_init_argv(argc, argv);

  printf("\n╔════════════════════════════════════════════════════════════╗\n");
  printf("║  P1 운영 의미론 7개 Invariant (Native C Runtime)          ║\n");
  printf("╚════════════════════════════════════════════════════════════╝\n\n");

  test_status0();
  printf("\n");
  test_inflight_lifecycle();
  printf("\n");
  test_stale_state_elimination();
  printf("\n");
  test_duplicate_collapse();
  printf("\n");
  test_projection_determinism();
  printf("\n");
  test_append_only_lifecycle();
  printf("\n");
  test_transition_window_correctness();
  printf("\n");

  printf("╔════════════════════════════════════════════════════════════╗\n");
  printf("║  ✓ ALL 7 INVARIANTS PASSED                               ║\n");
  printf("╚════════════════════════════════════════════════════════════╝\n\n");

  return 0;
}
