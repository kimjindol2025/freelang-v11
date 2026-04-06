/**
 * LearnedFact - Single learned fact with metadata
 */
export interface LearnedFact {
    key: string;
    data: any;
    confidence: number;
    source: string;
    timestamp: number;
    expiresAt: number;
    accessCount: number;
    lastAccessed: number;
}
/**
 * LearnedFactsStore - Persistent storage for learned information
 * Supports TTL (Time-To-Live) expiration and confidence tracking
 */
export declare class LearnedFactsStore {
    private filePath;
    private facts;
    private defaultTtlDays;
    private autoSaveInterval;
    private isDirty;
    private autoSaveTimer?;
    constructor(filePath?: string, defaultTtlDays?: number);
    /**
     * Save a learned fact
     */
    save(key: string, data: any, options: {
        confidence: number;
        source: string;
        ttlDays?: number;
    }): void;
    /**
     * Load a learned fact by key
     */
    load(key: string): LearnedFact | null;
    /**
     * Load all learned facts (non-expired)
     */
    loadAll(): LearnedFact[];
    /**
     * Delete a learned fact
     */
    delete(key: string): void;
    /**
     * Find facts by minimum confidence level
     */
    findByConfidence(minConfidence: number): LearnedFact[];
    /**
     * Find facts by source
     */
    findBySource(source: string): LearnedFact[];
    /**
     * Clean up expired facts
     * Returns the number of deleted facts
     */
    cleanup(): number;
    /**
     * Get store statistics
     */
    getStats(): {
        totalFacts: number;
        expiredCount: number;
        averageConfidence: number;
        oldestExpiry: number | null;
        sourceDistribution: Record<string, number>;
    };
    /**
     * Flush all pending changes to disk
     */
    flush(): void;
    /**
     * Destroy the store (clean up auto-save timer)
     */
    destroy(): void;
    /**
     * Private: Load facts from file
     */
    private loadFromFile;
    /**
     * Private: Save facts to file
     */
    private saveToFile;
    /**
     * Private: Start auto-save timer
     */
    private startAutoSave;
}
//# sourceMappingURL=learned-facts-store.d.ts.map