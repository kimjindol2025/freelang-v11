import { Interpreter } from "./interpreter";
import { SExpr } from "./ast";
export declare function evalBuiltin(interp: Interpreter, op: string, args: any[], expr: SExpr): any;
export declare function evalRefactorSelf(op: string, args: any[]): any | null;
export declare function evalAlign(op: string, args: any[]): any | null;
export declare function evalPredict_PHASE144(op: string, args: any[]): any | null;
export declare function evalCuriosity(op: string, args: any[], callFn?: (fn: any, a: any[]) => any): any | null;
export declare function evalEthicsCheck(interp: Interpreter, op: string, args: any[]): any | null;
export declare function evalWisdom(op: string, args: any[]): any | null;
export declare function evalExplain_PHASE145(op: string, args: any[], callFnVal?: (fn: any, a: any[]) => any): any | null;
//# sourceMappingURL=eval-builtins.d.ts.map