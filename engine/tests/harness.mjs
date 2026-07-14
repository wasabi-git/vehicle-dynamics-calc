/** Minimal zero-dependency test harness for the engine test suite. */

const state = { passed: 0, failed: 0, failures: [] };

export function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      state.passed += 1;
      console.log(`  ok    ${name}`);
    })
    .catch((error) => {
      state.failed += 1;
      state.failures.push({ name, error });
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error && error.message ? error.message : error}`);
    });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "assertEqual failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message || "assertDeepEqual failed"}: expected ${b}, got ${a}`);
  }
}

export function assertClose(actual, expected, relTol, message) {
  if (!Number.isFinite(actual)) {
    throw new Error(`${message || "assertClose failed"}: actual is not finite (${actual})`);
  }
  const denom = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  const dev = Math.abs(actual - expected) / denom;
  if (dev > relTol) {
    throw new Error(`${message || "assertClose failed"}: expected ${expected}, got ${actual} (dev ${(dev * 100).toFixed(4)}% > ${(relTol * 100).toFixed(2)}%)`);
  }
}

export function hasDiagnostic(diagnostics, code) {
  return diagnostics.some((d) => d.code === code);
}

export function summary(label) {
  console.log(`\n${label}: ${state.passed} passed, ${state.failed} failed`);
  return state.failed === 0;
}

export function failureCount() {
  return state.failed;
}
