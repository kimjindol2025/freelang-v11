import { Interpreter } from "./interpreter";
import { ModuleBlock, ImportBlock, OpenBlock } from "./ast";
export declare function evalModuleBlock(interp: Interpreter, moduleBlock: ModuleBlock): void;
export declare function evalImportBlock(interp: Interpreter, importBlock: ImportBlock): void;
export declare function evalImportFromFile(interp: Interpreter, relPath: string, prefix: string, selective: string[] | undefined, alias: string | undefined): void;
export declare function evalOpenBlock(interp: Interpreter, openBlock: OpenBlock): void;
//# sourceMappingURL=eval-module-system.d.ts.map