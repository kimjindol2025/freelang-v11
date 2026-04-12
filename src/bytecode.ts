// FreeLang v9 Phase 83: 바이트코드 명령어 정의

export enum OpCode {
  PUSH_CONST,    // 스택에 상수 푸시 (arg: 상수 풀 인덱스)
  PUSH_VAR,      // 변수 값 로드 (arg: 변수 이름)
  SET_VAR,       // 변수 저장 (arg: 변수 이름)
  CALL,          // N개 인자로 함수 호출 (arg: 인자 수)
  RETURN,        // 함수 반환
  JUMP,          // 무조건 점프 (arg: 목적지 인덱스)
  JUMP_IF_FALSE, // 조건 점프 (arg: 목적지 인덱스)
  POP,           // 스택 팝
  DUP,           // 스택 최상단 복제
  ADD,           // 덧셈
  SUB,           // 뺄셈
  MUL,           // 곱셈
  DIV,           // 나눗셈
  MOD,           // 나머지
  EQ,            // 동등 비교
  LT,            // 미만
  GT,            // 초과
  LE,            // 이하
  GE,            // 이상
  NEQ,           // 불일치
  AND,           // 논리 AND
  OR,            // 논리 OR
  NOT,           // 논리 NOT
  MAKE_LIST,     // N개 스택 값으로 배열 생성 (arg: 개수)
  GET_FIELD,     // 객체 필드 접근 (arg: 필드명)
  HALT,          // 프로그램 종료
}

export interface Instruction {
  op: OpCode;
  arg?: number | string | null; // 인자 (인덱스, 이름, 상수값)
}

export interface Chunk {
  instructions: Instruction[];
  constants: any[];  // 상수 풀
  name: string;      // 청크 이름 (함수명 등)
}
