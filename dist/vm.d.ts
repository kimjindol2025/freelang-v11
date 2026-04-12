import { Chunk } from "./bytecode";
export declare class VM {
    stack: any[];
    vars: Map<string, any>;
    ip: number;
    run(chunk: Chunk): any;
    private push;
    private pop;
}
//# sourceMappingURL=vm.d.ts.map