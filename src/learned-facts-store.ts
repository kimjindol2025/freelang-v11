// FreeLang v9 Phase 9b Advanced: Learned Facts Persistence Store
// JSON file-based storage with TTL, confidence tracking, and cleanup

import * as fs from "fs";
import * as path from "path";

/**
 * LearnedFact - Single learned fact with metadata
 */
export interface LearnedFact {
  key: string; // Unique identifier
  data: any; // The learned data
  confidence: number; // 0-1, confidence level
  source: string; // "search" | "user" | "inference" | "feedback"
  timestamp: number; // ISO 8601 timestamp (ms since epoch)
  expiresAt: number; // Expiration time (ms since epoch)
  accessCount: number; // How many times accessed
  lastAccessed: number; // Last access time (ms since epoch)
}

/**
 * LearnedFactsStoreFile - File structure for persistence
 */
interface LearnedFactsStoreFile {
  version: string;
  lastUpdated: string;
  facts: LearnedFact[];
}

/**
 * LearnedFactsStore - Persistent storage for learned information
 * Supports TTL (Time-To-Live) expiration and confidence tracking
 */
export class LearnedFactsStore {
  private filePath: string;
  private facts: Map<string, LearnedFact>;
  private defaultTtlDays: number = 30;
  private autoSaveInterval: number = 5000; // Auto-save every 5 seconds
  private isDirty: boolean = false;
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(filePath: string = "./data/learned-facts.json", defaultTtlDays: number = 30) {
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
  save(key: string, data: any, options: { confidence: number; source: string; ttlDays?: number }): void {
    const { confidence, source, ttlDays = this.defaultTtlDays } = options;

    // Validate confidence
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence: ${confidence}. Must be between 0 and 1.`);
    }

    const now = Date.now();
    const fact: LearnedFact = {
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
  load(key: string): LearnedFact | null {
    const fact = this.facts.get(key);
    if (!fact) return null;

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
  loadAll(): LearnedFact[] {
    const results: LearnedFact[] = [];
    const now = Date.now();
    let hasExpired = false;

    for (const [key, fact] of this.facts.entries()) {
      if (now > fact.expiresAt) {
        this.facts.delete(key);
        hasExpired = true;
      } else {
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
  delete(key: string): void {
    if (this.facts.has(key)) {
      this.facts.delete(key);
      this.isDirty = true;
    }
  }

  /**
   * Find facts by minimum confidence level
   */
  findByConfidence(minConfidence: number): LearnedFact[] {
    return this.loadAll().filter((fact) => fact.confidence >= minConfidence);
  }

  /**
   * Find facts by source
   */
  findBySource(source: string): LearnedFact[] {
    return this.loadAll().filter((fact) => fact.source === source);
  }

  /**
   * Clean up expired facts
   * Returns the number of deleted facts
   */
  cleanup(): number {
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
  getStats(): {
    totalFacts: number;
    expiredCount: number;
    averageConfidence: number;
    oldestExpiry: number | null;
    sourceDistribution: Record<string, number>;
  } {
    const all = this.loadAll();
    const now = Date.now();

    let expiredCount = 0;
    let totalConfidence = 0;
    let oldestExpiry: number | null = null;
    const sourceDistribution: Record<string, number> = {};

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
  flush(): void {
    if (!this.isDirty) return;
    this.saveToFile();
    this.isDirty = false;
  }

  /**
   * Destroy the store (clean up auto-save timer)
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
    this.flush();
  }

  /**
   * Private: Load facts from file
   */
  private loadFromFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        // File doesn't exist yet, start with empty store
        return;
      }

      const content = fs.readFileSync(this.filePath, "utf-8");
      const parsed: LearnedFactsStoreFile = JSON.parse(content);

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
    } catch (error) {
      console.error(`Failed to load learned facts: ${(error as Error).message}`);
      // Start with empty store on error
    }
  }

  /**
   * Private: Save facts to file
   */
  private saveToFile(): void {
    try {
      const data: LearnedFactsStoreFile = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        facts: Array.from(this.facts.values()),
      };

      // Write to file atomically (write to temp file then rename)
      const tempPath = this.filePath + ".tmp";
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      console.error(`Failed to save learned facts: ${(error as Error).message}`);
    }
  }

  /**
   * Private: Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.flush();
      }
    }, this.autoSaveInterval);
  }
}
