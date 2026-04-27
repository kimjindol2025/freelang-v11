// FreeLang v11 Checkpoint Engine
// P0-3: Workflow state persistence and recovery
// Saves workflow progress to disk, enables resume-from-checkpoint

import * as fs from "fs";
import * as path from "path";

export interface CheckpointData {
  workflow_id: string;
  workflow_name: string;
  step_index: number;           // 다음 실행할 Step의 인덱스
  context: Record<string, any>; // 누적된 컨텍스트
  timestamp: number;            // 저장 시간
  step_names: string[];         // 실행한 Step 이름 목록
  steps_completed: number;      // 완료한 Step 수
}

export function saveCheckpoint(filePath: string, data: CheckpointData): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err: any) {
    console.error(`[Checkpoint] Failed to save: ${err.message}`);
    throw err;
  }
}

export function loadCheckpoint(filePath: string): CheckpointData | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as CheckpointData;
    return data;
  } catch (err: any) {
    console.error(`[Checkpoint] Failed to load: ${err.message}`);
    return null;
  }
}

export function deleteCheckpoint(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err: any) {
    console.error(`[Checkpoint] Failed to delete: ${err.message}`);
  }
}

export function getCheckpointPath(baseDir: string, workflowId: string): string {
  return path.join(baseDir, `checkpoint-${workflowId}.json`);
}

export function createCheckpointModule() {
  return {
    // checkpoint_save path data -> void
    // (checkpoint_save "/tmp/cp.json" {:workflow_id "..." :context {...}})
    "checkpoint_save": (filePath: string, data: CheckpointData): void => {
      saveCheckpoint(filePath, data);
    },

    // checkpoint_load path -> CheckpointData | null
    // (let [cp (checkpoint_load "/tmp/cp.json")] ...)
    "checkpoint_load": (filePath: string): CheckpointData | null => {
      return loadCheckpoint(filePath);
    },

    // checkpoint_delete path -> void
    // (checkpoint_delete "/tmp/cp.json")
    "checkpoint_delete": (filePath: string): void => {
      deleteCheckpoint(filePath);
    },

    // checkpoint_path base-dir workflow-id -> string
    // (checkpoint_path "/tmp" "workflow-abc123")
    "checkpoint_path": (baseDir: string, workflowId: string): string => {
      return getCheckpointPath(baseDir, workflowId);
    },
  };
}
