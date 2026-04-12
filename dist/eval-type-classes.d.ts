import { TypeClass, TypeClassInstance } from "./ast";
import type { TypeClassInfo, TypeClassInstanceInfo } from "./interpreter-context";
interface InterpreterLike {
    eval(node: any): any;
    callFunction(fn: any, args: any[]): any;
    logger: {
        info(msg: string): void;
    };
    context: {
        typeClasses?: Map<string, TypeClassInfo>;
        typeClassInstances?: Map<string, TypeClassInstanceInfo>;
    };
}
export declare function registerBuiltinTypeClasses(interp: InterpreterLike): void;
export declare function evalTypeClass(interp: InterpreterLike, typeClass: TypeClass): void;
export declare function evalInstance(interp: InterpreterLike, instance: TypeClassInstance): void;
export {};
//# sourceMappingURL=eval-type-classes.d.ts.map