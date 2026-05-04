// Phase Y-2-C: 브라우저 디버그 패널
// 에러 발생 시 콜스택 + 변수를 시각적으로 표시

export interface DebugPanelAPI {
  lastError: any;
  callStack: any[];
  variables: Record<string, any>;
  showError(): string;
  expandCallStack(level: number): any;
  inspectVariable(name: string): any;
  printConsole(): void;
  toggle(): void;
  clear(): void;
}

export class BrowserDebugPanel {
  private static panelElement: HTMLElement | null = null;
  private static context: any = null;

  static init(context: any) {
    BrowserDebugPanel.context = context;

    // 1. window.__FL_DEBUG 객체 생성
    const debugAPI: DebugPanelAPI = {
      lastError: null,
      callStack: [],
      variables: {},

      showError(): string {
        const err = context.lastError;
        if (!err) return "No error";
        return `${err.message}\n  at ${err.file}:${err.line}:${err.col}`;
      },

      expandCallStack(level: number): any {
        const err = context.lastError;
        if (!err || !err.callStack[level]) return null;
        return err.callStack[level];
      },

      inspectVariable(name: string): any {
        const err = context.lastError;
        if (!err || !err.variables) return null;
        return err.variables[name];
      },

      printConsole(): void {
        const err = context.lastError;
        if (!err) {
          console.log("[FL] No error captured");
          return;
        }
        console.group("[FL Error] " + err.message);
        console.log("Location:", `${err.file}:${err.line}:${err.col}`);
        console.log("Call Stack:", err.callStack);
        console.log("Variables:", err.variables);
        if (err.hint) console.log("Hint:", err.hint);
        console.groupEnd();
      },

      toggle(): void {
        if (BrowserDebugPanel.panelElement) {
          const body = BrowserDebugPanel.panelElement.querySelector(".fl-error-body") as HTMLElement;
          if (body) {
            body.style.display = body.style.display === "none" ? "block" : "none";
          }
        }
      },

      clear(): void {
        context.lastError = null;
        if (BrowserDebugPanel.panelElement) {
          BrowserDebugPanel.panelElement.style.display = "none";
        }
      },
    };

    (window as any).__FL_DEBUG = debugAPI;

    // 2. 패널 HTML 주입
    BrowserDebugPanel.injectPanel();

    // 3. 에러 후크 설정
    BrowserDebugPanel.setupErrorHandler(context, debugAPI);
  }

  private static injectPanel() {
    const panelHTML = `
      <div id="fl-debug-panel" style="
        position: fixed;
        bottom: 0;
        right: 0;
        width: 400px;
        max-height: 300px;
        background: #1e1e1e;
        color: #d4d4d4;
        border: 1px solid #404040;
        border-radius: 4px 4px 0 0;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 99999;
        display: none;
        overflow-y: auto;
        box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
      ">
        <div class="fl-error-header" style="
          padding: 8px 12px;
          background: #d32f2f;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #404040;
        ">
          <span id="fl-error-title" style="font-weight: bold;">FL Error</span>
          <div>
            <button onclick="window.__FL_DEBUG.toggle()" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 14px;
              margin: 0 4px;
            ">−</button>
            <button onclick="window.__FL_DEBUG.clear()" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 14px;
              margin: 0 4px;
            ">✕</button>
          </div>
        </div>
        <div class="fl-error-body" style="
          padding: 12px;
          display: none;
        ">
          <div id="fl-message" style="margin-bottom: 10px; white-space: pre-wrap;"></div>
          <div id="fl-stack" style="margin-bottom: 10px;">
            <div style="color: #4fc3f7; margin-bottom: 4px;">Call Stack:</div>
            <div id="fl-stack-items" style="margin-left: 8px;"></div>
          </div>
          <div id="fl-vars">
            <div style="color: #4fc3f7; margin-bottom: 4px;">Variables:</div>
            <div id="fl-vars-items" style="margin-left: 8px;"></div>
          </div>
          <div id="fl-hint" style="margin-top: 10px; color: #ffeb3b;"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", panelHTML);
    BrowserDebugPanel.panelElement = document.getElementById("fl-debug-panel");
  }

  private static setupErrorHandler(context: any, debugAPI: DebugPanelAPI) {
    // 에러 발생 시 패널 업데이트하는 인터셉터 설정
    const originalEval = (window as any).__FL_eval || (context.variables?.get as any);

    // context.lastError가 변경될 때 패널 업데이트
    const updatePanel = () => {
      const err = context.lastError;
      if (!err) return;

      const panel = BrowserDebugPanel.panelElement;
      if (!panel) return;

      // 패널 표시
      panel.style.display = "block";

      // 제목
      const title = panel.querySelector("#fl-error-title") as HTMLElement;
      if (title) {
        title.textContent = `✖ ${err.code || "Error"}: ${err.message.split("\n")[0]}`;
      }

      // 메시지
      const message = panel.querySelector("#fl-message") as HTMLElement;
      if (message) {
        message.textContent = err.message;
      }

      // 콜스택
      const stackItems = panel.querySelector("#fl-stack-items") as HTMLElement;
      if (stackItems && err.callStack) {
        stackItems.innerHTML = err.callStack
          .map(
            (frame: any, i: number) =>
              `<div>${i + 1}. <span style="color: #4fc3f7;">${frame.name}</span> (line ${frame.line})</div>`
          )
          .join("");
      }

      // 변수
      const varItems = panel.querySelector("#fl-vars-items") as HTMLElement;
      if (varItems && err.variables) {
        varItems.innerHTML = Object.entries(err.variables)
          .slice(0, 5)
          .map(
            ([k, v]: [string, any]) =>
              `<div><span style="color: #ce9178;">${k}</span>: ${
                typeof v === "string" ? `"${v.slice(0, 30)}"` : String(v).slice(0, 30)
              }</div>`
          )
          .join("");
      }

      // 힌트
      const hint = panel.querySelector("#fl-hint") as HTMLElement;
      if (hint && err.hint) {
        hint.innerHTML = `<strong>💡 Hint:</strong> ${err.hint}`;
      }
    };

    // 주기적으로 패널 업데이트 (또는 에러 발생 시마다)
    // 간단하게 setInterval로 업데이트
    setInterval(updatePanel, 500);
  }
}
