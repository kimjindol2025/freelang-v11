// eval-module-system.ts — FreeLang v9 Module System
// Phase 57 리팩토링: interpreter.ts의 모듈 시스템 분리
// evalModuleBlock, evalImportBlock, evalImportFromFile, evalOpenBlock

import * as fs from "fs";
import * as path from "path";
import { Interpreter, FreeLangFunction, ModuleInfo } from "./interpreter";
import { ASTNode, ModuleBlock, ImportBlock, OpenBlock, isFuncBlock } from "./ast";
import { ModuleNotFoundError } from "./errors";
import { extractParamNames } from "./ast-helpers";
import { lex } from "./lexer";
import { parse } from "./parser";

  // Phase 6 Step 4: Evaluate module block
  // Module 정의를 등록하고 내부 함수들을 평가
export function evalModuleBlock(interp: Interpreter, moduleBlock: ModuleBlock): void {
    const moduleName = moduleBlock.name;
    const exports = moduleBlock.exports || [];
    const moduleBody = moduleBlock.body || [];

    // 모듈 내 함수 맵 생성
    const moduleFunctions = new Map<string, FreeLangFunction>();

    // 모듈 body 내의 블록들을 평가 (함수 등록)
    for (const node of moduleBody) {
      if (isFuncBlock(node)) {
        const funcName = node.name;
        const params = node.fields?.get("params") || [];
        const paramNames = extractParamNames(params);
        let body = node.fields?.get("body");

        // Skip function if body is undefined
        if (!body) {
          continue;
        }

        // Handle body as array (take first element)
        if (Array.isArray(body)) {
          body = body[0];
          if (!body) {
            continue;
          }
        }

        const func: FreeLangFunction = {
          name: funcName,
          params: paramNames,
          body: body as ASTNode,
        };

        moduleFunctions.set(funcName, func);
      }
    }

    // 모듈 정보 생성 및 등록
    const moduleInfo: ModuleInfo = {
      name: moduleName,
      exports,
      functions: moduleFunctions,
    };

    interp.getModules().set(moduleName, moduleInfo);

    interp.logger.info(`✅ Module registered: ${moduleName} (exports: ${exports.join(", ")})`);
  }

  // Phase 6 Step 4: Evaluate import block
  // 모듈에서 함수를 선택적으로 가져오기
export function evalImportBlock(interp: Interpreter, importBlock: ImportBlock): void {
    const moduleName = importBlock.moduleName;
    const source = importBlock.source; // "./math.fl" 등
    const selective = importBlock.selective; // :only [add multiply]
    const alias = importBlock.alias; // :as m

    // Phase 52: .fl 파일 import 처리
    // Accept: ends with .fl, contains /, OR a matching .fl file exists next to
    // the importing file or at project root (bare module name like "lib").
    if (source) {
      const looksLikeFile = source.endsWith(".fl") || source.includes("/") ||
        source.startsWith("./") || source.startsWith("../");
      let isFile = looksLikeFile;
      if (!isFile) {
        // Try resolving "lib" → "./lib.fl" or "<cwd>/lib.fl"
        const baseDir = (() => {
          try {
            return fs.statSync(interp.currentFilePath).isDirectory()
              ? interp.currentFilePath
              : path.dirname(interp.currentFilePath);
          } catch { return interp.currentFilePath; }
        })();
        const candidates = [
          path.resolve(baseDir, source + ".fl"),
          path.resolve(baseDir, source),
          path.resolve(process.cwd(), source + ".fl"),
          path.resolve(process.cwd(), source),
        ];
        isFile = candidates.some((c) => fs.existsSync(c));
      }
      if (isFile) {
        interp.evalImportFromFile(source, moduleName, selective, alias);
        return;
      }
    }

    // 모듈 찾기
    const module = interp.getModules().get(moduleName);
    if (!module) {
      throw new ModuleNotFoundError(moduleName, source);
    }

    // 가져올 함수 목록 결정
    let functionsToImport: string[] = [];
    if (selective && selective.length > 0) {
      // :only 지정된 함수만 가져오기
      functionsToImport = selective.filter((name) =>
        module.exports.includes(name)
      );
      // 존재하지 않는 함수 검증
      selective.forEach((name) => {
        if (!module.exports.includes(name)) {
          interp.logger.warn(
            `Function "${name}" not exported from module "${moduleName}"`
          );
        }
      });
    } else {
      // 모든 export된 함수 가져오기
      functionsToImport = [...module.exports];
    }

    // 함수들을 context.functions에 추가
    functionsToImport.forEach((funcName) => {
      const func = module.functions.get(funcName);
      if (func) {
        if (alias) {
          // :as 별칭 사용: (import math :as m) → m:add
          const qualifiedName = `${alias}:${funcName}`;
          interp.context.functions.set(qualifiedName, func);
        } else {
          // 별칭 없음: moduleName:funcName 형식으로 등록
          const qualifiedName = `${moduleName}:${funcName}`;
          interp.context.functions.set(qualifiedName, func);
        }
      }
    });

    const importedCount = functionsToImport.length;
    const aliasStr = alias ? ` as ${alias}` : "";
    const selectStr = selective ? ` (${selective.join(", ")})` : "";
    interp.logger.info(
      `✅ Imported ${importedCount} function(s) from "${moduleName}"${selectStr}${aliasStr}`
    );
  }

  // Phase 52: FL 파일에서 함수를 가져와 현재 context에 등록
  export function evalImportFromFile(interp: Interpreter, relPath: string, prefix: string, selective: string[] | undefined, alias: string | undefined): void {
    // Path resolution rules:
    // 1. Starts with "./" "../" "/": relative to importing file's directory (baseDir)
    // 2. Bare (e.g. "stdlib/web/metadata"): project root first, then baseDir fallback
    // 3. ".fl" extension auto-appended if file not found without it
    const baseDir = (() => {
      try {
        return fs.statSync(interp.currentFilePath).isDirectory()
          ? interp.currentFilePath
          : path.dirname(interp.currentFilePath);
      } catch {
        return interp.currentFilePath;
      }
    })();

    const tryResolve = (candidate: string): string | null => {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      if (!candidate.endsWith(".fl") && fs.existsSync(candidate + ".fl")) return candidate + ".fl";
      return null;
    };

    const isRelative = relPath.startsWith("./") || relPath.startsWith("../") || relPath.startsWith("/");
    const candidates: string[] = [];
    if (isRelative) {
      candidates.push(path.resolve(baseDir, relPath));
    } else {
      // bare path: try project root (cwd) first, then baseDir
      candidates.push(path.resolve(process.cwd(), relPath));
      candidates.push(path.resolve(baseDir, relPath));
    }

    let absPath: string | null = null;
    for (const c of candidates) {
      const resolved = tryResolve(c);
      if (resolved) { absPath = resolved; break; }
    }
    if (!absPath) {
      throw new Error(`Import error: file not found: ${relPath} (tried: ${candidates.join(", ")})`);
    }

    // 순환 import 방지
    if (interp.importedFiles.has(absPath)) {
      return;
    }
    interp.importedFiles.add(absPath);

    // 서브 인터프리터로 FL 파일 실행
    const src = fs.readFileSync(absPath, "utf-8");
    const subInterp = new Interpreter();
    subInterp.currentFilePath = absPath;
    subInterp.importedFiles = interp.importedFiles; // 순환 방지 공유

    // stdlib 로드 전 함수 목록 스냅샷 (내장  함수 제외용)
    const builtinFuncs = new Set<string>(subInterp.context.functions.keys());

    // We also want to capture the initial variables, but normally they are none.

    subInterp.interpret(parse(lex(src)));
    if (process.env.FL_IMPORT_DEBUG === "1") {
      const userDefined: string[] = [];
      for (const k of subInterp.context.functions.keys()) {
        if (!builtinFuncs.has(k)) userDefined.push(k);
      }
      console.log(`import.debug file=${absPath} user_funcs=${userDefined.join(",")}`);
    }

    // 사용자 정의 함수 추출 (stdlib 내장 제외)
    const effectivePrefix = alias ?? prefix;
    for (const [funcName, func] of subInterp.context.functions) {
      if (builtinFuncs.has(funcName)) continue; // 내장 함수 skip

      if (selective && selective.length > 0) {
        // :only 필터: prefix 없이 직접 등록
        if (selective.includes(funcName)) {
          interp.context.functions.set(funcName, func);
        }
      } else {
        // prefix:funcName 형식으로 등록
        interp.context.functions.set(`${effectivePrefix}:${funcName}`, func);
      }
    }

    // 모듈 변수 추출: get top-level bindings from subInterp's global scope
    const globalVars = subInterp.context.variables.snapshot();
    for (const [varName, varVal] of globalVars) {
        if (selective && selective.length > 0) {
            if (selective.includes(varName)) {
                interp.context.variables.setGlobal(varName, varVal);
            }
        } else {
            // Register as prefix:varName
            interp.context.variables.setGlobal(`${effectivePrefix}:${varName}`, varVal);
        }
    }
  }

  // Phase 6 Step 4: Evaluate open block
  // 모듈의 모든 export된 함수를 전역 네임스페이스에 추가
export function evalOpenBlock(interp: Interpreter, openBlock: OpenBlock): void {
    const moduleName = openBlock.moduleName;
    const source = openBlock.source; // "./math.fl" 등

    // 모듈 찾기
    const module = interp.getModules().get(moduleName);
    if (!module) {
      throw new ModuleNotFoundError(moduleName, source);
    }

    // 모든 export된 함수를 전역으로 추가
    module.exports.forEach((funcName) => {
      const func = module.functions.get(funcName);
      if (func) {
        // 전역 네임스페이스에 직접 추가 (별칭 없음)
        interp.context.functions.set(funcName, func);
      }
    });

    interp.logger.info(
      `✅ Opened module "${moduleName}" (${module.exports.length} function(s) available globally)`
    );
  }

