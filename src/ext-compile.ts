// Extension bundle: FL compiler (require("compile"))
//
// 구조적 비용 설명:
//   stdlib-compile.ts 자체는 3KB이지만
//   fl_compile_file / fl_compile 구현이 FL 소스를 파싱해야 하므로
//   parser.ts(100KB) + codegen-js.ts(30KB) + ast.ts(24KB) + lexer.ts(10KB) 전체를 끌어옴.
//   이 의존성은 기능 구현상 불가피하며 더 줄일 수 없다.
//   registry는 http만 사용하므로 ext-registry로 분리됨.
export { createCompileModule } from "./stdlib-compile";
