/**
 * ScopeStack: Efficient scope management using a stack-based approach
 *
 * Instead of copying entire variable Maps on each function call:
 * - Old approach: O(n) - copy all variables
 * - New approach: O(1) - push new scope frame
 *
 * Variable lookup: O(d) where d = scope depth (typically < 10)
 * Variable assignment: O(1) to current scope
 */
export declare class ScopeStack {
    private stack;
    constructor();
    /**
     * Push new scope frame (on function call)
     * Time: O(1)
     */
    push(): void;
    /**
     * Pop scope frame (on function return)
     * Time: O(1)
     */
    pop(): void;
    /**
     * Get variable value, searching from current scope upward
     * Time: O(d) where d = scope depth
     */
    get(name: string): any;
    /**
     * Check if variable exists in any scope
     * Time: O(d)
     */
    has(name: string): boolean;
    /**
     * Set variable in current scope only (local assignment)
     * Time: O(1)
     */
    set(name: string, value: any): void;
    /**
     * Set variable in the first scope where it exists, or current scope if not found
     * Time: O(d)
     */
    setInScope(name: string, value: any): void;
    /**
     * Delete variable from current scope
     * Time: O(1)
     */
    delete(name: string): boolean;
    /**
     * Get all variables (merge from all scopes) - for debugging/export
     * Time: O(n) where n = total variables across all scopes
     */
    getAllVariables(): Map<string, any>;
    /**
     * Get current scope depth
     * Time: O(1)
     */
    getDepth(): number;
    /**
     * Clear all scopes except global (for interpreter reset)
     * Time: O(1)
     */
    reset(): void;
}
//# sourceMappingURL=scope-stack.d.ts.map