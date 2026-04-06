// Simple Phase 9b test to verify LearnedFactsStore initialization

import { LearnedFactsStore } from "./learned-facts-store";
import * as fs from "fs";

const testPath = "./data/test-simple.json";

// Clean up
if (fs.existsSync(testPath)) {
  fs.unlinkSync(testPath);
}

console.log("Creating LearnedFactsStore...");
const store = new LearnedFactsStore(testPath, 30);

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
