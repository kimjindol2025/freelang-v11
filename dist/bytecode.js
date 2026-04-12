"use strict";
// FreeLang v9 Phase 83: 바이트코드 명령어 정의
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpCode = void 0;
var OpCode;
(function (OpCode) {
    OpCode[OpCode["PUSH_CONST"] = 0] = "PUSH_CONST";
    OpCode[OpCode["PUSH_VAR"] = 1] = "PUSH_VAR";
    OpCode[OpCode["SET_VAR"] = 2] = "SET_VAR";
    OpCode[OpCode["CALL"] = 3] = "CALL";
    OpCode[OpCode["RETURN"] = 4] = "RETURN";
    OpCode[OpCode["JUMP"] = 5] = "JUMP";
    OpCode[OpCode["JUMP_IF_FALSE"] = 6] = "JUMP_IF_FALSE";
    OpCode[OpCode["POP"] = 7] = "POP";
    OpCode[OpCode["DUP"] = 8] = "DUP";
    OpCode[OpCode["ADD"] = 9] = "ADD";
    OpCode[OpCode["SUB"] = 10] = "SUB";
    OpCode[OpCode["MUL"] = 11] = "MUL";
    OpCode[OpCode["DIV"] = 12] = "DIV";
    OpCode[OpCode["MOD"] = 13] = "MOD";
    OpCode[OpCode["EQ"] = 14] = "EQ";
    OpCode[OpCode["LT"] = 15] = "LT";
    OpCode[OpCode["GT"] = 16] = "GT";
    OpCode[OpCode["LE"] = 17] = "LE";
    OpCode[OpCode["GE"] = 18] = "GE";
    OpCode[OpCode["NEQ"] = 19] = "NEQ";
    OpCode[OpCode["AND"] = 20] = "AND";
    OpCode[OpCode["OR"] = 21] = "OR";
    OpCode[OpCode["NOT"] = 22] = "NOT";
    OpCode[OpCode["MAKE_LIST"] = 23] = "MAKE_LIST";
    OpCode[OpCode["GET_FIELD"] = 24] = "GET_FIELD";
    OpCode[OpCode["HALT"] = 25] = "HALT";
})(OpCode || (exports.OpCode = OpCode = {}));
//# sourceMappingURL=bytecode.js.map