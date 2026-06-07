var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-ai.ts
var ext_ai_exports = {};
__export(ext_ai_exports, {
  createAiNativeModule: () => createAiNativeModule,
  createAuditModule: () => createAuditModule
});
module.exports = __toCommonJS(ext_ai_exports);

// src/stdlib-ai-native.ts
var toSerializable = (obj) => {
  if (obj instanceof Map) return Object.fromEntries(obj);
  if (Array.isArray(obj)) return obj.map(toSerializable);
  if (typeof obj === "object" && obj !== null) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = toSerializable(v);
    }
    return result;
  }
  return obj;
};
function createAiNativeModule() {
  return {
    // ── AI 모델 직접 호출 ────────────────────────────────────────────
    "ai-call": async (model, prompt) => {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      const apiKey = anthropicKey || openaiKey;
      const promptStr = typeof prompt === "string" ? prompt : typeof prompt === "object" && prompt !== null ? String(prompt.prompt || JSON.stringify(prompt)) : String(prompt);
      if (!apiKey) {
        return `[AI Mock Response] Model: ${model}, Prompt: ${promptStr.slice(0, 50)}...`;
      }
      if (anthropicKey && (model.startsWith("claude") || model.startsWith("anthropic"))) {
        try {
          const contextStr = typeof prompt === "object" && prompt !== null && prompt.context ? `

Context:
${JSON.stringify(prompt.context)}` : "";
          const maxTokens = typeof prompt === "object" && prompt !== null ? Number(prompt["max-tokens"] || prompt.maxTokens || 1024) : 1024;
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify(toSerializable({
              model: model === "claude-3" ? "claude-3-haiku-20240307" : model,
              max_tokens: maxTokens,
              messages: [
                { role: "user", content: promptStr + contextStr }
              ]
            }))
          });
          if (res.ok) {
            const data = await res.json();
            return data?.content?.[0]?.text ?? "[AI: empty response]";
          }
        } catch (e) {
          return `[AI Error] ${String(e)}`;
        }
      }
      if (openaiKey && (model.startsWith("gpt") || model.startsWith("openai"))) {
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`
            },
            body: JSON.stringify(toSerializable({
              model: model === "gpt-4" ? "gpt-4-turbo-preview" : model,
              messages: [{ role: "user", content: promptStr }]
            }))
          });
          if (res.ok) {
            const data = await res.json();
            return data?.choices?.[0]?.message?.content ?? "[AI: empty response]";
          }
        } catch (e) {
          return `[AI Error] ${String(e)}`;
        }
      }
      return `[AI Mock Response] Model: ${model}, Prompt: ${promptStr.slice(0, 50)}...`;
    },
    // ── RAG 검색 ────────────────────────────────────────────────────
    "rag-search": (query, opts) => {
      const kb = opts?.kb ?? opts?.["kb"] ?? "default";
      const limit = Number(opts?.limit ?? opts?.["limit"] ?? 5);
      const mockResults = [
        { content: `Mock RAG result for: ${query}`, score: 0.95, source: String(kb) },
        { content: `Related: ${query} \u2014 context from ${kb}`, score: 0.82, source: String(kb) },
        { content: `Additional info about ${query}`, score: 0.74, source: String(kb) },
        { content: `Background: ${query} overview`, score: 0.61, source: String(kb) },
        { content: `Reference: ${query} documentation`, score: 0.53, source: String(kb) }
      ];
      return mockResults.slice(0, limit);
    },
    // ── 임베딩 생성 ─────────────────────────────────────────────────
    "embed": async (text) => {
      const gptPort = process.env.FREELANG_GPT_PORT ?? "30113";
      try {
        const res = await fetch(`http://localhost:${gptPort}/api/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSerializable({ text })),
          signal: AbortSignal.timeout ? AbortSignal.timeout(3e3) : void 0
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.embedding)) return data.embedding;
        }
      } catch {
      }
      return Array.from(
        { length: 10 },
        (_, i) => Math.sin((text.charCodeAt(i % text.length) + i * 7) * 0.1)
      );
    },
    // ── 코사인 유사도 ────────────────────────────────────────────────
    "similarity": (v1, v2) => {
      if (!Array.isArray(v1) || !Array.isArray(v2)) return 0;
      const len = Math.min(v1.length, v2.length);
      if (len === 0) return 0;
      let dot = 0, n1 = 0, n2 = 0;
      for (let i = 0; i < len; i++) {
        dot += v1[i] * v2[i];
        n1 += v1[i] ** 2;
        n2 += v2[i] ** 2;
      }
      const denom = Math.sqrt(n1) * Math.sqrt(n2);
      if (denom === 0) return 0;
      return dot / denom;
    },
    // ── 텍스트 청킹 (RAG 준비용) ─────────────────────────────────────
    "chunk-text": (text, size = 512, overlap = 50) => {
      if (typeof text !== "string" || text.length === 0) return [];
      const step = Math.max(1, size - overlap);
      const chunks = [];
      for (let i = 0; i < text.length; i += step) {
        chunks.push(text.slice(i, i + size));
        if (i + size >= text.length) break;
      }
      return chunks;
    },
    // ── 프롬프트 템플릿 변수 치환 ────────────────────────────────────
    "prompt-template": (template, vars) => {
      if (typeof template !== "string") return String(template);
      return template.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));
    }
  };
}

// src/stdlib-audit.ts
var import_child_process = require("child_process");
function postJson(url, body, apiKey) {
  const args = [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    ...apiKey ? ["-H", `X-Service-Key: ${apiKey}`] : [],
    "-d",
    body,
    url
  ];
  try {
    const result = (0, import_child_process.spawnSync)("curl", args, { timeout: 3e3 });
    const code = parseInt(result.stdout?.toString().trim() ?? "0", 10);
    return { ok: code >= 200 && code < 300, status: code };
  } catch {
    return { ok: false, status: 0 };
  }
}
function createAuditModule() {
  return {
    // audit_log serviceId actorId action resource detail
    //   → {:ok true :status 200} | {:ok false :status N}
    // actorId가 nil이면 serviceId로 자동 대체
    // 실패해도 nil 반환 (본 작업 차단 없음)
    "audit_log": (serviceId, actorId, action, resource, detail) => {
      const url = process.env.AUDIT_URL ?? "";
      const key = process.env.AUDIT_SERVICE_KEY ?? "";
      if (!url) return null;
      const payload = JSON.stringify({
        service_id: serviceId,
        actor_id: actorId ?? serviceId,
        action,
        resource,
        detail,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      try {
        return postJson(url, payload, key);
      } catch {
        return null;
      }
    },
    // audit_log_custom serviceId actorId action resource detail extraMap
    //   → extraMap을 페이로드에 병합
    "audit_log_custom": (serviceId, actorId, action, resource, detail, extra) => {
      const url = process.env.AUDIT_URL ?? "";
      const key = process.env.AUDIT_SERVICE_KEY ?? "";
      if (!url) return null;
      const payload = JSON.stringify({
        service_id: serviceId,
        actor_id: actorId ?? serviceId,
        action,
        resource,
        detail,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ...extra && typeof extra === "object" ? extra : {}
      });
      try {
        return postJson(url, payload, key);
      } catch {
        return null;
      }
    },
    // audit_log_ok? result → true/false (결과 확인용)
    "audit_log_ok?": (result) => {
      return result !== null && result !== void 0 && result.ok === true;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createAiNativeModule,
  createAuditModule
});
