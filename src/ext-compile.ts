// Extension bundle: FL compiler + registry (pulls parser/AST/codegen — ~155KB)
// require("compile") | require("registry")
export { createCompileModule } from "./stdlib-compile";
export { createRegistryModule } from "./stdlib-registry";
