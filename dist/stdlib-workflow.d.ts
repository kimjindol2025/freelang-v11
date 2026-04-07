export interface WorkflowStep {
    name: string;
    fn: (ctx: Record<string, any>) => Record<string, any>;
    retry?: number;
    required?: boolean;
}
export interface WorkflowResult {
    id: string;
    name: string;
    status: "success" | "partial" | "failed";
    context: Record<string, any>;
    steps_run: number;
    steps_ok: number;
    steps_failed: number;
    total_ms: number;
    log: Array<{
        step: string;
        status: string;
        ms: number;
        error?: string;
    }>;
    errors: string[];
}
export declare function createWorkflowModule(): {
    workflow_create: (name: string, steps: WorkflowStep[]) => Record<string, any>;
    workflow_step: (name: string, fn: (ctx: Record<string, any>) => Record<string, any>, options?: {
        retry?: number;
        required?: boolean;
    }) => WorkflowStep;
    workflow_run: (workflow: Record<string, any>, initialCtx?: Record<string, any>) => WorkflowResult;
    workflow_ok: (result: WorkflowResult) => boolean;
    workflow_get: (result: WorkflowResult, key: string) => any;
    workflow_summary: (result: WorkflowResult) => string;
    task_create: (goal: string) => Record<string, any>;
    task_add_subtask: (task: Record<string, any>, name: string) => Record<string, any>;
    task_complete_subtask: (task: Record<string, any>, name: string, result: any) => Record<string, any>;
    task_finish: (task: Record<string, any>, result: any) => Record<string, any>;
    task_progress: (task: Record<string, any>) => number;
    report_create: (title: string) => Record<string, any>;
    report_add: (report: Record<string, any>, sectionName: string, data: any) => Record<string, any>;
    report_render: (report: Record<string, any>) => string;
};
//# sourceMappingURL=stdlib-workflow.d.ts.map