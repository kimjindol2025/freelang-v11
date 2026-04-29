"use strict";
// FreeLang v11 Checkpoint Engine
// P0-3: Workflow state persistence and recovery
// Saves workflow progress to disk, enables resume-from-checkpoint
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCheckpoint = saveCheckpoint;
exports.loadCheckpoint = loadCheckpoint;
exports.deleteCheckpoint = deleteCheckpoint;
exports.getCheckpointPath = getCheckpointPath;
exports.createCheckpointModule = createCheckpointModule;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function saveCheckpoint(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    }
    catch (err) {
        console.error(`[Checkpoint] Failed to save: ${err.message}`);
        throw err;
    }
}
function loadCheckpoint(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        return data;
    }
    catch (err) {
        console.error(`[Checkpoint] Failed to load: ${err.message}`);
        return null;
    }
}
function deleteCheckpoint(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    catch (err) {
        console.error(`[Checkpoint] Failed to delete: ${err.message}`);
    }
}
function getCheckpointPath(baseDir, workflowId) {
    return path.join(baseDir, `checkpoint-${workflowId}.json`);
}
function createCheckpointModule() {
    return {
        // checkpoint_save path data -> void
        // (checkpoint_save "/tmp/cp.json" {:workflow_id "..." :context {...}})
        "checkpoint_save": (filePath, data) => {
            saveCheckpoint(filePath, data);
        },
        // checkpoint_load path -> CheckpointData | null
        // (let [cp (checkpoint_load "/tmp/cp.json")] ...)
        "checkpoint_load": (filePath) => {
            return loadCheckpoint(filePath);
        },
        // checkpoint_delete path -> void
        // (checkpoint_delete "/tmp/cp.json")
        "checkpoint_delete": (filePath) => {
            deleteCheckpoint(filePath);
        },
        // checkpoint_path base-dir workflow-id -> string
        // (checkpoint_path "/tmp" "workflow-abc123")
        "checkpoint_path": (baseDir, workflowId) => {
            return getCheckpointPath(baseDir, workflowId);
        },
    };
}
