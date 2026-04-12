export declare enum OpCode {
    PUSH_CONST = 0,// 스택에 상수 푸시 (arg: 상수 풀 인덱스)
    PUSH_VAR = 1,// 변수 값 로드 (arg: 변수 이름)
    SET_VAR = 2,// 변수 저장 (arg: 변수 이름)
    CALL = 3,// N개 인자로 함수 호출 (arg: 인자 수)
    RETURN = 4,// 함수 반환
    JUMP = 5,// 무조건 점프 (arg: 목적지 인덱스)
    JUMP_IF_FALSE = 6,// 조건 점프 (arg: 목적지 인덱스)
    POP = 7,// 스택 팝
    DUP = 8,// 스택 최상단 복제
    ADD = 9,// 덧셈
    SUB = 10,// 뺄셈
    MUL = 11,// 곱셈
    DIV = 12,// 나눗셈
    MOD = 13,// 나머지
    EQ = 14,// 동등 비교
    LT = 15,// 미만
    GT = 16,// 초과
    LE = 17,// 이하
    GE = 18,// 이상
    NEQ = 19,// 불일치
    AND = 20,// 논리 AND
    OR = 21,// 논리 OR
    NOT = 22,// 논리 NOT
    MAKE_LIST = 23,// N개 스택 값으로 배열 생성 (arg: 개수)
    GET_FIELD = 24,// 객체 필드 접근 (arg: 필드명)
    HALT = 25
}
export interface Instruction {
    op: OpCode;
    arg?: number | string | null;
}
export interface Chunk {
    instructions: Instruction[];
    constants: any[];
    name: string;
}
//# sourceMappingURL=bytecode.d.ts.map