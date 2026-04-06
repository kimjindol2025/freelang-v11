"use strict";
// FreeLang v9: Error Handling Standard Library
// Phase 11: Error handling (try, catch, finally, throw)
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorModule = createErrorModule;
/**
 * Create the error handling module for FreeLang
 * Provides: error-message, error-type, is-error, create-error
 */
function createErrorModule() {
    return {
        // error_message err -> string (get error message)
        "error_message": (err) => {
            if (err instanceof Error) {
                return err.message;
            }
            if (typeof err === "string") {
                return err;
            }
            if (err && typeof err === "object" && err.message) {
                return String(err.message);
            }
            return String(err);
        },
        // error_type err -> string (get error type/name)
        "error_type": (err) => {
            if (err instanceof Error) {
                return err.constructor.name;
            }
            if (typeof err === "string") {
                return "string";
            }
            if (err && typeof err === "object" && err.type) {
                return String(err.type);
            }
            return typeof err;
        },
        // is_error value -> boolean (check if value is an error)
        "is_error": (value) => {
            return value instanceof Error || (value && typeof value === "object" && value.message !== undefined);
        },
        // create_error message -> error (create an error object)
        "create_error": (message) => {
            return new Error(message);
        },
        // create_typed_error type message -> error (create a typed error)
        "create_typed_error": (type, message) => {
            const err = new Error(message);
            err.type = type;
            return err;
        },
        // error_stack err -> string (get error stack trace)
        "error_stack": (err) => {
            if (err instanceof Error && err.stack) {
                return err.stack;
            }
            return "";
        },
        // with_fallback try_fn fallback_fn -> any (execute try_fn, fallback on error)
        "with_fallback": (tryFn, fallbackFn) => {
            try {
                // If it's a function value (from FreeLang fn)
                if (tryFn && typeof tryFn === "object" && tryFn.kind === "function-value") {
                    // This will be called by the interpreter with proper context
                    return tryFn;
                }
                // Otherwise assume it's already a callable function
                if (typeof tryFn === "function") {
                    return tryFn();
                }
                return tryFn;
            }
            catch (err) {
                // Execute fallback
                if (fallbackFn && typeof fallbackFn === "object" && fallbackFn.kind === "function-value") {
                    return fallbackFn;
                }
                if (typeof fallbackFn === "function") {
                    return fallbackFn(err);
                }
                return fallbackFn;
            }
        },
    };
}
//# sourceMappingURL=stdlib-error.js.map