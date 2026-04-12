"use strict";
// FreeLang v9: AI 네이티브 모듈
// Phase 71: ai-call / rag-search / embed / similarity / chunk-text / prompt-template
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAiNativeModule = createAiNativeModule;
/**
 * AI 네이티브 블록 생성
 * - API 키 없으면 Mock 모드로 동작
 * - embed는 FreeLang GPT 서버(30113) 연동 시도 후 fallback
 */
function createAiNativeModule() {
    return {
        // ── AI 모델 직접 호출 ────────────────────────────────────────────
        "ai-call": async (model, prompt) => {
            const anthropicKey = process.env.ANTHROPIC_API_KEY;
            const openaiKey = process.env.OPENAI_API_KEY;
            const apiKey = anthropicKey || openaiKey;
            const promptStr = typeof prompt === "string"
                ? prompt
                : typeof prompt === "object" && prompt !== null
                    ? String(prompt.prompt || JSON.stringify(prompt))
                    : String(prompt);
            if (!apiKey) {
                // Mock 모드: 구조화된 더미 응답
                return `[AI Mock Response] Model: ${model}, Prompt: ${promptStr.slice(0, 50)}...`;
            }
            // Anthropic API (claude 계열)
            if (anthropicKey && (model.startsWith("claude") || model.startsWith("anthropic"))) {
                try {
                    const contextStr = typeof prompt === "object" && prompt !== null && prompt.context
                        ? `\n\nContext:\n${JSON.stringify(prompt.context)}`
                        : "";
                    const maxTokens = typeof prompt === "object" && prompt !== null
                        ? Number(prompt["max-tokens"] || prompt.maxTokens || 1024)
                        : 1024;
                    const res = await fetch("https://api.anthropic.com/v1/messages", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": anthropicKey,
                            "anthropic-version": "2023-06-01",
                        },
                        body: JSON.stringify({
                            model: model === "claude-3" ? "claude-3-haiku-20240307" : model,
                            max_tokens: maxTokens,
                            messages: [
                                { role: "user", content: promptStr + contextStr },
                            ],
                        }),
                    });
                    if (res.ok) {
                        const data = (await res.json());
                        return data?.content?.[0]?.text ?? "[AI: empty response]";
                    }
                }
                catch (e) {
                    return `[AI Error] ${String(e)}`;
                }
            }
            // OpenAI API (gpt 계열)
            if (openaiKey && (model.startsWith("gpt") || model.startsWith("openai"))) {
                try {
                    const res = await fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${openaiKey}`,
                        },
                        body: JSON.stringify({
                            model: model === "gpt-4" ? "gpt-4-turbo-preview" : model,
                            messages: [{ role: "user", content: promptStr }],
                        }),
                    });
                    if (res.ok) {
                        const data = (await res.json());
                        return data?.choices?.[0]?.message?.content ?? "[AI: empty response]";
                    }
                }
                catch (e) {
                    return `[AI Error] ${String(e)}`;
                }
            }
            // fallback mock
            return `[AI Mock Response] Model: ${model}, Prompt: ${promptStr.slice(0, 50)}...`;
        },
        // ── RAG 검색 ────────────────────────────────────────────────────
        "rag-search": (query, opts) => {
            const kb = opts?.kb ?? opts?.["kb"] ?? "default";
            const limit = Number(opts?.limit ?? opts?.["limit"] ?? 5);
            const mockResults = [
                { content: `Mock RAG result for: ${query}`, score: 0.95, source: String(kb) },
                { content: `Related: ${query} — context from ${kb}`, score: 0.82, source: String(kb) },
                { content: `Additional info about ${query}`, score: 0.74, source: String(kb) },
                { content: `Background: ${query} overview`, score: 0.61, source: String(kb) },
                { content: `Reference: ${query} documentation`, score: 0.53, source: String(kb) },
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
                    body: JSON.stringify({ text }),
                    signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
                });
                if (res.ok) {
                    const data = (await res.json());
                    if (Array.isArray(data?.embedding))
                        return data.embedding;
                }
            }
            catch {
                // GPT 서버 미실행 — mock fallback
            }
            // Mock: 텍스트 해시 기반 더미 벡터 (10차원)
            return Array.from({ length: 10 }, (_, i) => Math.sin((text.charCodeAt(i % text.length) + i * 7) * 0.1));
        },
        // ── 코사인 유사도 ────────────────────────────────────────────────
        "similarity": (v1, v2) => {
            if (!Array.isArray(v1) || !Array.isArray(v2))
                return 0;
            const len = Math.min(v1.length, v2.length);
            if (len === 0)
                return 0;
            let dot = 0, n1 = 0, n2 = 0;
            for (let i = 0; i < len; i++) {
                dot += v1[i] * v2[i];
                n1 += v1[i] ** 2;
                n2 += v2[i] ** 2;
            }
            const denom = Math.sqrt(n1) * Math.sqrt(n2);
            if (denom === 0)
                return 0;
            return dot / denom;
        },
        // ── 텍스트 청킹 (RAG 준비용) ─────────────────────────────────────
        "chunk-text": (text, size = 512, overlap = 50) => {
            if (typeof text !== "string" || text.length === 0)
                return [];
            const step = Math.max(1, size - overlap);
            const chunks = [];
            for (let i = 0; i < text.length; i += step) {
                chunks.push(text.slice(i, i + size));
                if (i + size >= text.length)
                    break;
            }
            return chunks;
        },
        // ── 프롬프트 템플릿 변수 치환 ────────────────────────────────────
        "prompt-template": (template, vars) => {
            if (typeof template !== "string")
                return String(template);
            return template.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));
        },
    };
}
//# sourceMappingURL=stdlib-ai-native.js.map