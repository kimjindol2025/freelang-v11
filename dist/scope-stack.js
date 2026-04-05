"use strict";
// FreeLang v9: Scope Stack for Efficient Variable Management
// Replaces O(n) Map copying with O(1) scope push/pop
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeStack = void 0;
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
class ScopeStack {
    constructor() {
        this.stack = [];
        // Initialize with global scope
        this.stack.push({
            variables: new Map(),
            isGlobalScope: true,
        });
    }
    /**
     * Push new scope frame (on function call)
     * Time: O(1)
     */
    push() {
        this.stack.push({
            variables: new Map(),
            isGlobalScope: false,
        });
    }
    /**
     * Pop scope frame (on function return)
     * Time: O(1)
     */
    pop() {
        if (this.stack.length <= 1) {
            throw new Error("Cannot pop global scope");
        }
        this.stack.pop();
    }
    /**
     * Get variable value, searching from current scope upward
     * Time: O(d) where d = scope depth
     */
    get(name) {
        // Search from top of stack (current scope) downward
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].variables.has(name)) {
                return this.stack[i].variables.get(name);
            }
        }
        return undefined; // Variable not found
    }
    /**
     * Check if variable exists in any scope
     * Time: O(d)
     */
    has(name) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].variables.has(name)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Set variable in current scope only (local assignment)
     * Time: O(1)
     */
    set(name, value) {
        const currentFrame = this.stack[this.stack.length - 1];
        currentFrame.variables.set(name, value);
    }
    /**
     * Set variable in the first scope where it exists, or current scope if not found
     * Time: O(d)
     */
    setInScope(name, value) {
        // Search for variable in current scope or parent scopes
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].variables.has(name)) {
                this.stack[i].variables.set(name, value);
                return;
            }
        }
        // Variable not found, set in current scope
        this.set(name, value);
    }
    /**
     * Delete variable from current scope
     * Time: O(1)
     */
    delete(name) {
        const currentFrame = this.stack[this.stack.length - 1];
        return currentFrame.variables.delete(name);
    }
    /**
     * Get all variables (merge from all scopes) - for debugging/export
     * Time: O(n) where n = total variables across all scopes
     */
    getAllVariables() {
        const result = new Map();
        // Merge all scopes from bottom to top
        for (let i = 0; i < this.stack.length; i++) {
            for (const [name, value] of this.stack[i].variables) {
                result.set(name, value);
            }
        }
        return result;
    }
    /**
     * Get current scope depth
     * Time: O(1)
     */
    getDepth() {
        return this.stack.length;
    }
    /**
     * Clear all scopes except global (for interpreter reset)
     * Time: O(1)
     */
    reset() {
        while (this.stack.length > 1) {
            this.stack.pop();
        }
        this.stack[0].variables.clear();
    }
}
exports.ScopeStack = ScopeStack;
//# sourceMappingURL=scope-stack.js.map