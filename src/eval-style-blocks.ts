// eval-style-blocks.ts — FreeLang v11 스타일 블록 처리
// Phase 59 P3: STYLE + THEME 블록 → CSS 생성

import { Interpreter } from "./interpreter";
import { SExpr, Keyword } from "./ast";
import { styleRegistry } from "./style-registry";

// CSS 속성명 단축 매핑
const cssKeyMap: Record<string, string> = {
  // 색상
  bg: "background",
  fg: "color",
  // 박스 모델
  p: "padding",
  m: "margin",
  w: "width",
  h: "height",
  // 보더
  r: "border-radius",
  b: "border",
  // 기타
  fs: "font-size",
  fw: "font-weight",
  d: "display",
  o: "opacity",
  z: "z-index",
};

/**
 * CSS 속성명 정규화
 * :bg → background
 * :border-radius → border-radius (그대로)
 * :custom-prop → custom-prop (그대로)
 */
function normalizeCssKey(flKey: string): string {
  return cssKeyMap[flKey] || flKey;
}

/**
 * CSS 규칙 객체 → CSS 문자열 변환
 * { :bg "#fff" :color "#000" } → "background: #fff; color: #000;"
 */
function rulesToCss(rulesObj: any): string {
  if (typeof rulesObj !== "object" || rulesObj === null) {
    return "";
  }

  const cssLines: string[] = [];
  for (const [keyStr, value] of Object.entries(rulesObj)) {
    // 키 정규화 (앞의 : 제거 필요)
    let key = keyStr.startsWith(":") ? keyStr.slice(1) : keyStr;
    key = normalizeCssKey(key);
    const val = String(value).trim();
    if (val) {
      cssLines.push(`${key}: ${val}`);
    }
  }

  return cssLines.join("; ");
}

/**
 * THEME 블록 처리
 * [THEME name :tokens { :primary "#2563eb" ... }]
 * → :root { --primary: #2563eb; ... }
 */
function processThemeBlock(interp: Interpreter, name: string, tokens: any): any {
  if (typeof tokens !== "object" || tokens === null) {
    return { status: "error", reason: "tokens must be object" };
  }

  const cssVars: string[] = [];
  for (const [keyStr, value] of Object.entries(tokens)) {
    // 키 정규화 (앞의 : 제거)
    let key = keyStr.startsWith(":") ? keyStr.slice(1) : keyStr;
    const val = String(value).trim();
    if (val) {
      cssVars.push(`  --${key}: ${val}`);
    }
  }

  if (cssVars.length === 0) {
    return { status: "empty", name };
  }

  const css = `:root {\n${cssVars.join(";\n")};\n}`;
  styleRegistry.addTheme(css);

  return {
    status: "theme_defined",
    name,
    tokens: Object.keys(tokens).length,
    css
  };
}

/**
 * STYLE 블록 처리
 * [STYLE btn-primary :selector ".btn-primary" :rules { :bg "#2563eb" :color "white" }]
 * → .btn-primary { background: #2563eb; color: white; }
 */
function processStyleBlock(
  interp: Interpreter,
  name: string,
  selector: string,
  rules: any
): any {
  if (!selector || selector.trim() === "") {
    return { status: "error", reason: "selector is required" };
  }

  const cssText = rulesToCss(rules);
  if (!cssText) {
    return { status: "empty", name, selector };
  }

  const css = `${selector} { ${cssText}; }`;
  styleRegistry.addStyle(css);

  return {
    status: "style_defined",
    name,
    selector,
    css
  };
}

/**
 * 스타일 블록 평가기 (evalInfraBlock 패턴 재사용)
 */
export function evalStyleBlock(interp: Interpreter, op: string, expr: SExpr): any {
  const ev = (node: any) => (interp as any).eval(node);

  // ── THEME 블록 ────────────────────────────────────────────
  if (op === "THEME" || op === "theme") {
    let name = "default";
    let tokens: any = {};

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name":
              name = String(val);
              break;
            case "tokens":
              tokens = typeof val === "object" ? val : {};
              break;
          }
          i++;
        }
      }
    }

    return processThemeBlock(interp, name, tokens);
  }

  // ── STYLE 블록 ────────────────────────────────────────────
  if (op === "STYLE" || op === "style") {
    let name = "default";
    let selector = "";
    let rules: any = {};

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name":
              name = String(val);
              break;
            case "selector":
              selector = String(val);
              break;
            case "rules":
              rules = typeof val === "object" ? val : {};
              break;
          }
          i++;
        }
      }
    }

    return processStyleBlock(interp, name, selector, rules);
  }

  throw new Error(`Unknown style block: ${op}`);
}
