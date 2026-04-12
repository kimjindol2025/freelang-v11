/**
 * Create the module system for FreeLang v9
 * Provides: module_load, module_export, module_require, module_registry,
 *           module_info, module_list, module_namespace
 */
export declare function createModuleSystem(): {
    module_load: (path: string) => Record<string, any> | null;
    module_export: (name: string, value: any) => null;
    module_require: (path: string) => Record<string, any>;
    module_set_current: (name: string) => null;
    module_get_current: () => string;
    module_registry: () => string[];
    module_info: (name: string) => Record<string, any> | null;
    module_exists: (name: string) => boolean;
    module_get: (name: string, key: string) => any;
    module_clear: (name: string) => boolean;
    module_clear_all: () => null;
    namespace_create: (name: string) => null;
    namespace_set: (name: string, key: string, value: any) => null;
    namespace_get: (name: string, key: string) => any;
    namespace_list: (name: string) => string[];
    namespace_delete: (name: string, key: string) => boolean;
    module_use: (moduleName: string) => Record<string, any>;
};
//# sourceMappingURL=stdlib-module.d.ts.map