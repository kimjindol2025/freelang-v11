"use strict";
// FreeLang v9: Module System Standard Library
// Phase 24: Module loading, exporting, and namespace management
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModuleSystem = createModuleSystem;
/**
 * Create the module system for FreeLang v9
 * Provides: module_load, module_export, module_require, module_registry,
 *           module_info, module_list, module_namespace
 */
function createModuleSystem() {
    // Module registry: name -> exported items
    const registry = new Map();
    // Current module being defined
    let currentModule = "default";
    // Namespace stack for scoping
    const namespaces = new Map();
    return {
        // module_load path -> {exports} | null
        // Load a module from file or registry
        "module_load": (path) => {
            // Try registry first
            if (registry.has(path)) {
                return registry.get(path);
            }
            // In real implementation, would load from file system
            // For now, return null
            return null;
        },
        // module_export name value -> null
        // Export a value from current module
        "module_export": (name, value) => {
            if (!registry.has(currentModule)) {
                registry.set(currentModule, {});
            }
            const exports = registry.get(currentModule);
            exports[name] = value;
            return null;
        },
        // module_require path -> {exports}
        // Require and return all exports from a module
        "module_require": (path) => {
            if (registry.has(path)) {
                return registry.get(path) || {};
            }
            // Return empty object if module not found
            return {};
        },
        // module_set_current name -> null
        // Set current module for exports
        "module_set_current": (name) => {
            currentModule = name;
            if (!registry.has(name)) {
                registry.set(name, {});
            }
            return null;
        },
        // module_get_current -> string
        // Get current module name
        "module_get_current": () => {
            return currentModule;
        },
        // module_registry -> [string]
        // List all loaded modules
        "module_registry": () => {
            return Array.from(registry.keys());
        },
        // module_info name -> {exports: string[]} | null
        // Get info about a module
        "module_info": (name) => {
            if (!registry.has(name)) {
                return null;
            }
            const exports = registry.get(name);
            return {
                name,
                exports: Object.keys(exports),
                size: Object.keys(exports).length,
            };
        },
        // module_exists name -> boolean
        // Check if module exists in registry
        "module_exists": (name) => {
            return registry.has(name);
        },
        // module_get name key -> any | null
        // Get exported value from module
        "module_get": (name, key) => {
            if (!registry.has(name))
                return null;
            const exports = registry.get(name);
            return exports[key] ?? null;
        },
        // module_clear name -> boolean
        // Clear/unload a module
        "module_clear": (name) => {
            if (registry.has(name)) {
                registry.delete(name);
                return true;
            }
            return false;
        },
        // module_clear_all -> null
        // Clear all modules
        "module_clear_all": () => {
            registry.clear();
            currentModule = "default";
            return null;
        },
        // namespace_create name -> null
        // Create a new namespace
        "namespace_create": (name) => {
            if (!namespaces.has(name)) {
                namespaces.set(name, {});
            }
            return null;
        },
        // namespace_set name key value -> null
        // Set value in namespace
        "namespace_set": (name, key, value) => {
            if (!namespaces.has(name)) {
                namespaces.set(name, {});
            }
            const ns = namespaces.get(name);
            ns[key] = value;
            return null;
        },
        // namespace_get name key -> any | null
        // Get value from namespace
        "namespace_get": (name, key) => {
            if (!namespaces.has(name))
                return null;
            const ns = namespaces.get(name);
            return ns[key] ?? null;
        },
        // namespace_list name -> [string]
        // List all keys in namespace
        "namespace_list": (name) => {
            if (!namespaces.has(name))
                return [];
            const ns = namespaces.get(name);
            return Object.keys(ns);
        },
        // namespace_delete name key -> boolean
        // Delete from namespace
        "namespace_delete": (name, key) => {
            if (!namespaces.has(name))
                return false;
            const ns = namespaces.get(name);
            if (key in ns) {
                delete ns[key];
                return true;
            }
            return false;
        },
        // module_use module_name -> {exports}
        // Import all exports from module into current context
        "module_use": (moduleName) => {
            if (registry.has(moduleName)) {
                const exports = registry.get(moduleName);
                // In real implementation, would import into current scope
                return exports;
            }
            return {};
        },
    };
}
//# sourceMappingURL=stdlib-module.js.map