// FreeLang v11 — AI Workflow stdlib
// AI를 편하게 쓰기 위한 고수준 함수 모음
// ai / ai-pipe / ai-each / ai-if / ai-retry / ai-parallel / ai-chain

const DEFAULT_MODEL = process.env.FL_AI_MODEL ?? "claude-3-haiku-20240307";

async function callLLM(model: string, prompt: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;
  const ollamaUrl    = process.env.OLLAMA_URL ?? "http://localhost:11434";

  // Ollama (로컬 LLM)
  if (!anthropicKey && !openaiKey) {
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json() as any;
        return data?.response ?? "[Ollama: empty]";
      }
    } catch (_e) {}
    return `[AI Mock] ${prompt.slice(0, 60)}...`;
  }

  // Anthropic
  if (anthropicKey && !model.startsWith("gpt")) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model === "claude" ? DEFAULT_MODEL : model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json() as any;
      return data?.content?.[0]?.text ?? "[Anthropic: empty]";
    }
  }

  // OpenAI
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: model.startsWith("gpt") ? model : "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json() as any;
      return data?.choices?.[0]?.message?.content ?? "[OpenAI: empty]";
    }
  }

  return `[AI Mock] ${prompt.slice(0, 60)}...`;
}

// 템플릿 변수 치환: "안녕 {name}" + {name: "김"} → "안녕 김"
function renderPrompt(template: string, vars?: Record<string, any>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function createAiWorkflowModule(): Record<string, Function> {
  return {
    // ── 기본 AI 호출 ──────────────────────────────────────────────
    // ai prompt [vars] [model] -> string
    // (ai "요약해줘: {text}" {:text "내용..."})
    "ai": async (prompt: string, vars?: any, model?: string): Promise<string> => {
      const m = model ?? DEFAULT_MODEL;
      const p = renderPrompt(String(prompt), vars && typeof vars === "object" ? vars : undefined);
      return callLLM(m, p);
    },

    // ── AI 파이프라인 ─────────────────────────────────────────────
    // ai-pipe input fn1 fn2 fn3 ... -> 최종 결과
    // 각 fn은 (fn [$x] (ai "..." {:x $x})) 형태
    // (ai-pipe "원문" summarize translate format)
    "ai-pipe": async (input: any, ...fns: Function[]): Promise<any> => {
      let val = input;
      for (const fn of fns) {
        const result = fn(val);
        val = result instanceof Promise ? await result : result;
      }
      return val;
    },

    // ── 배열 AI 병렬 처리 ─────────────────────────────────────────
    // ai-each items prompt [model] -> [string]
    // {item} 에 각 요소 자동 대입
    // (ai-each ["사과" "바나나"] "이것의 칼로리는? {item}")
    "ai-each": async (items: any[], prompt: string, model?: string): Promise<string[]> => {
      if (!Array.isArray(items)) return [];
      const m = model ?? DEFAULT_MODEL;
      return Promise.all(items.map((item) => {
        const vars = typeof item === "object" ? item : { item: String(item) };
        return callLLM(m, renderPrompt(prompt, vars));
      }));
    },

    // ── AI 조건 분기 ──────────────────────────────────────────────
    // ai-if question input then-fn else-fn -> any
    // LLM이 yes/no 판단 → then/else 실행
    // (ai-if "스팸인가?" text spam-handler normal-handler)
    "ai-if": async (
      question: string,
      input: any,
      thenFn: Function,
      elseFn: Function,
      model?: string
    ): Promise<any> => {
      const m = model ?? DEFAULT_MODEL;
      const verdict = await callLLM(m,
        `다음 질문에 반드시 "yes" 또는 "no" 한 단어만 답하세요.\n질문: ${question}\n대상: ${String(input)}`
      );
      const isYes = verdict.toLowerCase().trim().startsWith("yes");
      const result = isYes ? thenFn(input) : elseFn(input);
      return result instanceof Promise ? await result : result;
    },

    // ── AI 재시도 ─────────────────────────────────────────────────
    // ai-retry prompt vars maxTry [model] -> string
    // 실패 시 최대 maxTry번 재시도
    "ai-retry": async (prompt: string, vars: any, maxTry: number = 3, model?: string): Promise<string> => {
      const m = model ?? DEFAULT_MODEL;
      const p = renderPrompt(String(prompt), vars);
      for (let i = 0; i < maxTry; i++) {
        try {
          const result = await callLLM(m, p);
          if (result && !result.startsWith("[AI Mock]")) return result;
        } catch (_e) {}
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
      return await callLLM(m, p);
    },

    // ── AI 병렬 실행 ──────────────────────────────────────────────
    // ai-parallel [{prompt vars model?} ...] -> [string]
    // 여러 AI 호출을 동시에 실행
    "ai-parallel": async (tasks: Array<{prompt: string; vars?: any; model?: string}>): Promise<string[]> => {
      return Promise.all(tasks.map((t) =>
        callLLM(t.model ?? DEFAULT_MODEL, renderPrompt(t.prompt, t.vars))
      ));
    },

    // ── AI 체인 (메모리 포함) ────────────────────────────────────
    // ai-chain steps input -> {result steps_log}
    // 각 step = {prompt role?}  이전 결과가 자동으로 다음 프롬프트에 전달
    "ai-chain": async (
      steps: Array<{prompt: string; role?: string}>,
      input: string,
      model?: string
    ): Promise<{result: string; log: string[]}> => {
      const m = model ?? DEFAULT_MODEL;
      let context = input;
      const log: string[] = [];
      for (const step of steps) {
        const p = renderPrompt(step.prompt, { input: context, prev: context });
        context = await callLLM(m, p);
        log.push(context);
      }
      return { result: context, log };
    },

    // ── AI 스트리밍 (SSE 응답용) ──────────────────────────────────
    // ai-stream prompt onChunk [model] -> null  (콜백으로 청크 전달)
    "ai-stream": async (
      prompt: string,
      onChunk: Function,
      model?: string
    ): Promise<void> => {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const m = model ?? DEFAULT_MODEL;

      if (anthropicKey) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: m,
            max_tokens: 1024,
            stream: true,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            for (const line of text.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(line.slice(6)) as any;
                const chunk = data?.delta?.text;
                if (chunk) onChunk(chunk);
              } catch (_e) {}
            }
          }
          return;
        }
      }

      // fallback: 한 번에 전달
      const result = await callLLM(m, prompt);
      onChunk(result);
    },

    // ── Tool Calling 루프 ─────────────────────────────────────────
    // ai-tools prompt tools [model] -> string
    // tools = [{name desc fn}]  LLM이 필요한 툴 선택 → FL 함수 실행 → 결과 재전달
    "ai-tools": async (
      prompt: string,
      tools: Array<{name: string; desc: string; fn: Function}>,
      model?: string
    ): Promise<string> => {
      const m = model ?? DEFAULT_MODEL;
      const toolDesc = tools.map((t) => `- ${t.name}: ${t.desc}`).join("\n");
      const systemPrompt = `당신은 도구를 사용해 문제를 해결합니다.
사용 가능한 도구:
${toolDesc}

도구를 사용할 때는 반드시 다음 형식으로만 응답하세요:
TOOL: <도구이름>
INPUT: <입력값>

모든 도구 사용이 끝나면 DONE: <최종답변> 형식으로 답하세요.`;

      let context = `${systemPrompt}\n\n사용자: ${prompt}`;
      let iterations = 0;

      while (iterations < 5) {
        const response = await callLLM(m, context);
        if (response.startsWith("DONE:")) {
          return response.slice(5).trim();
        }
        const toolMatch = response.match(/TOOL:\s*(\w+)\s*\nINPUT:\s*(.+)/s);
        if (!toolMatch) return response;

        const [, toolName, toolInput] = toolMatch;
        const tool = tools.find((t) => t.name === toolName);
        if (!tool) return response;

        const toolResult = tool.fn(toolInput.trim());
        const result = toolResult instanceof Promise ? await toolResult : toolResult;
        context += `\n\n어시스턴트: ${response}\n도구 결과: ${String(result)}`;
        iterations++;
      }
      return await callLLM(m, context);
    },

    // ── Ollama 전용 ───────────────────────────────────────────────
    // ollama prompt [model] -> string  (로컬 LLM 직접 호출)
    "ollama": async (prompt: string, model: string = "llama3"): Promise<string> => {
      const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
      try {
        const res = await fetch(`${url}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false }),
          signal: AbortSignal.timeout(60000),
        });
        if (res.ok) {
          const data = await res.json() as any;
          return data?.response ?? "[Ollama: empty]";
        }
        return `[Ollama Error] ${res.status}`;
      } catch (e: any) {
        return `[Ollama Error] ${e.message}`;
      }
    },

    // ollama-models -> [string]  (설치된 모델 목록)
    "ollama-models": async (): Promise<string[]> => {
      const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
      try {
        const res = await fetch(`${url}/api/tags`);
        if (res.ok) {
          const data = await res.json() as any;
          return (data?.models ?? []).map((m: any) => m.name);
        }
      } catch (_e) {}
      return [];
    },

    // ── 프롬프트 렌더 ─────────────────────────────────────────────
    // ai-render template vars -> string
    "ai-render": (template: string, vars: Record<string, any>): string =>
      renderPrompt(String(template), vars),
  };
}
