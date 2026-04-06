/**
 * Create the error handling module for FreeLang
 * Provides: error-message, error-type, is-error, create-error
 */
export declare function createErrorModule(): {
    error_message: (err: any) => string;
    error_type: (err: any) => string;
    is_error: (value: any) => boolean;
    create_error: (message: string) => Error;
    create_typed_error: (type: string, message: string) => any;
    error_stack: (err: any) => string;
    with_fallback: (tryFn: any, fallbackFn: any) => any;
};
//# sourceMappingURL=stdlib-error.d.ts.map