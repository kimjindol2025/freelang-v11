"use strict";

// Jest's JSON formatter serializes assertion failureDetails verbatim. Some
// child-process failures carry an Error object whose `error` property points
// back into the result, which makes `--json --outputFile` fail after tests
// have already run. CI needs the messages, stacks, and pass/fail counts, not
// those live Error object graphs.
function errorSummary(value) {
  if (value && typeof value === "object") {
    return {
      message: typeof value.message === "string" ? value.message : String(value),
      ...(typeof value.stack === "string" ? { stack: value.stack } : {}),
    };
  }
  return { message: String(value) };
}

module.exports = function makeCiResultsSerializable(results) {
  for (const testResult of results.testResults ?? []) {
    if (testResult.testExecError) {
      testResult.testExecError = errorSummary(testResult.testExecError);
    }
    for (const assertion of testResult.testResults ?? []) {
      if (Array.isArray(assertion.failureDetails)) {
        assertion.failureDetails = assertion.failureDetails.map(errorSummary);
      }
    }
  }
  return results;
};
