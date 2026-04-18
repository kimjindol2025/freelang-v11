// FreeLang v9: stdlib-test
// Phase 76: deftest/describe/assert FL 네이티브 테스트 러너

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface TestReport {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
}

/**
 * FL 네이티브 테스트 모듈 생성
 * callFn: FreeLang function value를 실제로 호출하는 콜백 (interpreter에서 주입)
 */
export function createTestModule(
  callFn: (fnValue: any, args: any[]) => any
): Record<string, Function> {
  const results: TestResult[] = [];
  let currentSuite = "";

  return {
    // describe: 테스트 그룹 이름 설정
    "describe": (name: string, fn?: any) => {
      currentSuite = name;
      console.log(`\n[${name}]`);
      // fn이 function value면 실행
      if (fn !== undefined && fn !== null) {
        try {
          callFn(fn, []);
        } catch (e: any) {
          console.error(`  describe '${name}' 오류: ${e.message}`);
        }
      }
      return name;
    },

    // deftest: 개별 테스트 케이스 실행
    "deftest": (name: string, fn: any) => {
      const fullName = currentSuite ? `${currentSuite}/${name}` : name;
      try {
        callFn(fn, []);
        results.push({ name: fullName, passed: true });
        console.log(`  PASS  ${name}`);
        return true;
      } catch (e: any) {
        const err = e.message ?? String(e);
        results.push({ name: fullName, passed: false, error: err });
        console.log(`  FAIL  ${name}: ${err}`);
        return false;
      }
    },

    // assert: 참인지 검증
    "assert": (val: any, msg?: string) => {
      if (!val) {
        throw new Error(msg ?? `Assertion failed: ${JSON.stringify(val)}`);
      }
      return true;
    },

    // assert-eq: 두 값이 같은지 검증 (deep equal)
    "assert-eq": (a: any, b: any, msg?: string) => {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      if (aStr !== bStr) {
        throw new Error(
          msg ?? `Expected ${bStr}, got ${aStr}`
        );
      }
      return true;
    },

    // assert-neq: 두 값이 다른지 검증
    "assert-neq": (a: any, b: any, msg?: string) => {
      if (JSON.stringify(a) === JSON.stringify(b)) {
        throw new Error(
          msg ?? `Expected values to differ, but both are ${JSON.stringify(a)}`
        );
      }
      return true;
    },

    // assert-throws: fn 실행 시 예외가 발생해야 함
    "assert-throws": (fn: any, expectedMsg?: string) => {
      try {
        callFn(fn, []);
        throw new Error(
          expectedMsg
            ? `Expected exception '${expectedMsg}' but none thrown`
            : "Expected exception but none thrown"
        );
      } catch (e: any) {
        // assert-throws 자체가 던진 "Expected exception" 오류는 re-throw
        if (e.message?.startsWith("Expected exception")) throw e;
        // expectedMsg 있으면 오류 메시지 확인
        if (expectedMsg && !e.message?.includes(expectedMsg)) {
          throw new Error(
            `Expected exception containing '${expectedMsg}', got: ${e.message}`
          );
        }
        return true;
      }
    },

    // assert-nil: 값이 null/undefined인지
    "assert-nil": (val: any, msg?: string) => {
      if (val !== null && val !== undefined) {
        throw new Error(msg ?? `Expected nil, got ${JSON.stringify(val)}`);
      }
      return true;
    },

    // assert-not-nil: 값이 null/undefined가 아닌지
    "assert-not-nil": (val: any, msg?: string) => {
      if (val === null || val === undefined) {
        throw new Error(msg ?? `Expected non-nil, got nil`);
      }
      return true;
    },

    // test-report: 전체 결과 통계 출력 + 반환
    "test-report": (): TestReport => {
      const passed = results.filter((r) => r.passed).length;
      const failed = results.length - passed;
      console.log(
        `\n결과: ${passed}/${results.length} 통과${failed > 0 ? ` (${failed}개 실패)` : ""}`
      );
      if (failed > 0) {
        console.log("실패 목록:");
        results
          .filter((r) => !r.passed)
          .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
      }
      return { passed, failed, total: results.length, results };
    },

    // test-reset: 결과 초기화 (테스트 간 격리)
    "test-reset": () => {
      results.length = 0;
      currentSuite = "";
      return true;
    },

    // test-results: 현재 결과 배열 반환 (프로그래매틱 접근용)
    "test-results": () => results,
  };
}
