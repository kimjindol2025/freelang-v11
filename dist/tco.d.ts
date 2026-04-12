export declare const TAIL_CALL: unique symbol;
export interface TailCall {
    [TAIL_CALL]: true;
    fn: string | any;
    args: any[];
}
export declare function tailCall(fn: string | any, args: any[]): TailCall;
export declare function isTailCall(v: any): v is TailCall;
export declare function trampoline(interp: any, initial: TailCall): any;
//# sourceMappingURL=tco.d.ts.map