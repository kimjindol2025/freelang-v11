"use strict";
// Simple Phase 9b test to verify LearnedFactsStore initialization
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
const learned_facts_store_1 = require("./learned-facts-store");
const fs = __importStar(require("fs"));
const testPath = "./data/test-simple.json";
// Clean up
if (fs.existsSync(testPath)) {
    fs.unlinkSync(testPath);
}
console.log("Creating LearnedFactsStore...");
const store = new learned_facts_store_1.LearnedFactsStore(testPath, 30);
console.log("Saving a fact...");
store.save("test-key", { value: "test-data" }, {
    confidence: 0.95,
    source: "search",
    ttlDays: 30
});
console.log("Flushing to disk...");
store.flush();
console.log("Loading fact...");
const loaded = store.load("test-key");
if (!loaded) {
    throw new Error("Failed to load fact");
}
console.log("✓ Fact saved and loaded successfully");
console.log(`  Key: ${loaded.key}`);
console.log(`  Data: ${JSON.stringify(loaded.data)}`);
console.log(`  Confidence: ${loaded.confidence}`);
console.log("Cleaning up...");
store.destroy();
if (fs.existsSync(testPath)) {
    fs.unlinkSync(testPath);
}
console.log("✅ Simple test PASSED");
//# sourceMappingURL=test-phase9b-simple.js.map