"use strict";
// FreeLang v9 Phase 9b Advanced: Learned Facts Persistence Store
// JSON file-based storage with TTL, confidence tracking, and cleanup
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
exports.LearnedFactsStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * LearnedFactsStore - Persistent storage for learned information
 * Supports TTL (Time-To-Live) expiration and confidence tracking
 */
class LearnedFactsStore {
    constructor(filePath = "./data/learned-facts.json", defaultTtlDays = 30) {
        this.defaultTtlDays = 30;
        this.autoSaveInterval = 5000; // Auto-save every 5 seconds
        this.isDirty = false;
        this.filePath = filePath;
        this.facts = new Map();
        this.defaultTtlDays = defaultTtlDays;
        // Ensure directory exists
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Load existing facts from file
        this.loadFromFile();
        // Start auto-save timer
        this.startAutoSave();
    }
    /**
     * Save a learned fact
     */
    save(key, data, options) {
        const { confidence, source, ttlDays = this.defaultTtlDays } = options;
        // Validate confidence
        if (confidence < 0 || confidence > 1) {
            throw new Error(`Invalid confidence: ${confidence}. Must be between 0 and 1.`);
        }
        const now = Date.now();
        const fact = {
            key,
            data,
            confidence,
            source,
            timestamp: now,
            expiresAt: now + ttlDays * 24 * 60 * 60 * 1000,
            accessCount: 0,
            lastAccessed: now,
        };
        this.facts.set(key, fact);
        this.isDirty = true;
    }
    /**
     * Load a learned fact by key
     */
    load(key) {
        const fact = this.facts.get(key);
        if (!fact)
            return null;
        // Check if expired
        if (Date.now() > fact.expiresAt) {
            this.facts.delete(key);
            this.isDirty = true;
            return null;
        }
        // Update access info
        fact.accessCount++;
        fact.lastAccessed = Date.now();
        this.isDirty = true;
        return fact;
    }
    /**
     * Load all learned facts (non-expired)
     */
    loadAll() {
        const results = [];
        const now = Date.now();
        let hasExpired = false;
        for (const [key, fact] of this.facts.entries()) {
            if (now > fact.expiresAt) {
                this.facts.delete(key);
                hasExpired = true;
            }
            else {
                results.push(fact);
            }
        }
        if (hasExpired) {
            this.isDirty = true;
        }
        return results;
    }
    /**
     * Delete a learned fact
     */
    delete(key) {
        if (this.facts.has(key)) {
            this.facts.delete(key);
            this.isDirty = true;
        }
    }
    /**
     * Find facts by minimum confidence level
     */
    findByConfidence(minConfidence) {
        return this.loadAll().filter((fact) => fact.confidence >= minConfidence);
    }
    /**
     * Find facts by source
     */
    findBySource(source) {
        return this.loadAll().filter((fact) => fact.source === source);
    }
    /**
     * Clean up expired facts
     * Returns the number of deleted facts
     */
    cleanup() {
        const now = Date.now();
        let deletedCount = 0;
        for (const [key, fact] of this.facts.entries()) {
            if (now > fact.expiresAt) {
                this.facts.delete(key);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            this.isDirty = true;
        }
        return deletedCount;
    }
    /**
     * Get store statistics
     */
    getStats() {
        const all = this.loadAll();
        const now = Date.now();
        let expiredCount = 0;
        let totalConfidence = 0;
        let oldestExpiry = null;
        const sourceDistribution = {};
        for (const [, fact] of this.facts.entries()) {
            if (now > fact.expiresAt) {
                expiredCount++;
            }
            sourceDistribution[fact.source] = (sourceDistribution[fact.source] || 0) + 1;
        }
        if (all.length > 0) {
            totalConfidence = all.reduce((sum, f) => sum + f.confidence, 0) / all.length;
            oldestExpiry = Math.min(...all.map((f) => f.expiresAt));
        }
        return {
            totalFacts: all.length,
            expiredCount,
            averageConfidence: totalConfidence,
            oldestExpiry,
            sourceDistribution,
        };
    }
    /**
     * Flush all pending changes to disk
     */
    flush() {
        if (!this.isDirty)
            return;
        this.saveToFile();
        this.isDirty = false;
    }
    /**
     * Destroy the store (clean up auto-save timer)
     */
    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = undefined;
        }
        this.flush();
    }
    /**
     * Private: Load facts from file
     */
    loadFromFile() {
        try {
            if (!fs.existsSync(this.filePath)) {
                // File doesn't exist yet, start with empty store
                return;
            }
            const content = fs.readFileSync(this.filePath, "utf-8");
            const parsed = JSON.parse(content);
            if (!parsed.facts || !Array.isArray(parsed.facts)) {
                console.warn("Invalid learned facts file format, starting with empty store");
                return;
            }
            // Load all facts
            for (const fact of parsed.facts) {
                this.facts.set(fact.key, fact);
            }
            // Clean up expired facts immediately
            this.cleanup();
        }
        catch (error) {
            console.error(`Failed to load learned facts: ${error.message}`);
            // Start with empty store on error
        }
    }
    /**
     * Private: Save facts to file
     */
    saveToFile() {
        try {
            const data = {
                version: "1.0",
                lastUpdated: new Date().toISOString(),
                facts: Array.from(this.facts.values()),
            };
            // Write to file atomically (write to temp file then rename)
            const tempPath = this.filePath + ".tmp";
            fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
            fs.renameSync(tempPath, this.filePath);
        }
        catch (error) {
            console.error(`Failed to save learned facts: ${error.message}`);
        }
    }
    /**
     * Private: Start auto-save timer
     * unref() = allow process to exit even if timer is active
     */
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty) {
                this.flush();
            }
        }, this.autoSaveInterval);
        // Allow process to exit even if timer is running
        if (this.autoSaveTimer && typeof this.autoSaveTimer.unref === 'function') {
            this.autoSaveTimer.unref();
        }
    }
}
exports.LearnedFactsStore = LearnedFactsStore;
//# sourceMappingURL=learned-facts-store.js.map