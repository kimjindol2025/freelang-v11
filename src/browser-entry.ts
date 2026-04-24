// FreeLang v11 — Browser Entry Point
// Node.js 의존성 없이 브라우저에서 FL 코드 실행

import { Interpreter } from "./interpreter";
import { createDataModule } from "./stdlib-data";
import { createCollectionModule } from "./stdlib-collection";
import { createTimeModule } from "./stdlib-time";
import { createCacheModule } from "./stdlib-cache";
import { createAgentModule } from "./stdlib-agent";
import { createValidationModule } from "./stdlib-validation";
import { createStatsModule } from "./stdlib-stats";
import { createMatrixModule } from "./stdlib-matrix";
import { createBrowserModule } from "./stdlib-browser";

function createBrowserInterpreter() {
  const interp = new Interpreter();

  // 브라우저 안전 stdlib 등록
  interp.registerModule(createDataModule());
  interp.registerModule(createCollectionModule());
  interp.registerModule(createTimeModule());
  interp.registerModule(createCacheModule());
  interp.registerModule(createAgentModule());
  interp.registerModule(createValidationModule());
  interp.registerModule(createStatsModule());
  interp.registerModule(createMatrixModule());

  // 브라우저 전용 stdlib 등록 (DOM, Fetch, Storage 등)
  interp.registerModule(createBrowserModule(
    (name, args) => interp.callUserFunction(name, args)
  ));

  return interp;
}

// FL 코드 실행
function evaluate(code: string): any {
  const interp = createBrowserInterpreter();
  try {
    return interp.run(code);
  } catch (e: any) {
    throw new Error(`FreeLang error: ${e.message}`);
  }
}

// 페이지 내 <script type="text/freelang"> 자동 실행
function autoRun() {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="text/freelang"]');
  scripts.forEach((el) => {
    try {
      evaluate(el.textContent ?? "");
    } catch (e: any) {
      console.error("[FreeLang]", e.message);
    }
  });
}

// window.FreeLang 전역 노출
const FreeLang = { evaluate, createInterpreter: createBrowserInterpreter, version: "v11" };

declare global {
  interface Window { FreeLang: typeof FreeLang; }
}

if (typeof window !== "undefined") {
  window.FreeLang = FreeLang;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoRun);
  } else {
    autoRun();
  }
}

export { FreeLang, evaluate };
