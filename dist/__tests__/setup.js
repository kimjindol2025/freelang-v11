"use strict";
// Jest 테스트 환경 설정
// FreeLang v9 테스트 초기화
// 글로벌 타임아웃 설정
jest.setTimeout(10000);
// 메모리 누수 감지 활성화
afterEach(() => {
    jest.clearAllMocks();
});
// 에러 스택 추적 강화
Error.stackTraceLimit = 50;
// 동시성 테스트를 위한 격리
beforeEach(() => {
    jest.clearAllTimers();
});
afterEach(() => {
    jest.clearAllTimers();
});
// 리소스 정리
afterAll(() => {
    // 모든 핸들 종료
    jest.clearAllMocks();
    jest.resetAllMocks();
});
// 이 파일은 setup 전용 — 테스트 없음
test('setup 파일 로드 확인', () => {
    expect(true).toBe(true);
});
//# sourceMappingURL=setup.js.map