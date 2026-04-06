"use strict";
// FreeLang v9: File I/O Standard Library
// Phase 10: File operations (read, write, delete, etc.)
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
exports.createFileModule = createFileModule;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Create the file I/O module for FreeLang
 * Provides: file_read, file_write, file_exists, file_delete, file_append
 *           dir_create, dir_list, dir_delete, file_copy
 */
function createFileModule() {
    return {
        // file_read filePath -> string (read file content)
        "file_read": (filePath) => {
            try {
                return fs.readFileSync(filePath, "utf-8");
            }
            catch (err) {
                throw new Error(`file_read failed for '${filePath}': ${err.message}`);
            }
        },
        // file_write filePath content -> boolean (write content to file)
        "file_write": (filePath, content) => {
            try {
                // Ensure parent directory exists
                const dir = path.dirname(filePath);
                if (dir !== "." && !fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(filePath, content, "utf-8");
                return true;
            }
            catch (err) {
                throw new Error(`file_write failed for '${filePath}': ${err.message}`);
            }
        },
        // file_exists filePath -> boolean (check if file exists)
        "file_exists": (filePath) => {
            return fs.existsSync(filePath);
        },
        // file_delete filePath -> boolean (delete file)
        "file_delete": (filePath) => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    return true;
                }
                return false;
            }
            catch (err) {
                throw new Error(`file_delete failed for '${filePath}': ${err.message}`);
            }
        },
        // file_append filePath content -> boolean (append content to file)
        "file_append": (filePath, content) => {
            try {
                // Ensure parent directory exists
                const dir = path.dirname(filePath);
                if (dir !== "." && !fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.appendFileSync(filePath, content, "utf-8");
                return true;
            }
            catch (err) {
                throw new Error(`file_append failed for '${filePath}': ${err.message}`);
            }
        },
        // file_copy src dest -> boolean (copy file)
        "file_copy": (src, dest) => {
            try {
                // Ensure parent directory exists
                const dir = path.dirname(dest);
                if (dir !== "." && !fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.copyFileSync(src, dest);
                return true;
            }
            catch (err) {
                throw new Error(`file_copy failed from '${src}' to '${dest}': ${err.message}`);
            }
        },
        // dir_create dirPath -> boolean (create directory)
        "dir_create": (dirPath) => {
            try {
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
                return true;
            }
            catch (err) {
                throw new Error(`dir_create failed for '${dirPath}': ${err.message}`);
            }
        },
        // dir_list dirPath -> [string] (list directory contents)
        "dir_list": (dirPath) => {
            try {
                if (!fs.existsSync(dirPath)) {
                    throw new Error(`Directory not found: '${dirPath}'`);
                }
                return fs.readdirSync(dirPath);
            }
            catch (err) {
                throw new Error(`dir_list failed for '${dirPath}': ${err.message}`);
            }
        },
        // dir_delete dirPath -> boolean (delete directory - must be empty)
        "dir_delete": (dirPath) => {
            try {
                if (fs.existsSync(dirPath)) {
                    fs.rmdirSync(dirPath);
                    return true;
                }
                return false;
            }
            catch (err) {
                throw new Error(`dir_delete failed for '${dirPath}': ${err.message}`);
            }
        },
        // file_size filePath -> number (get file size in bytes)
        "file_size": (filePath) => {
            try {
                const stats = fs.statSync(filePath);
                return stats.size;
            }
            catch (err) {
                throw new Error(`file_size failed for '${filePath}': ${err.message}`);
            }
        },
        // file_is_file filePath -> boolean (check if path is a file)
        "file_is_file": (filePath) => {
            try {
                if (!fs.existsSync(filePath))
                    return false;
                return fs.statSync(filePath).isFile();
            }
            catch (err) {
                return false;
            }
        },
        // file_is_dir filePath -> boolean (check if path is a directory)
        "file_is_dir": (filePath) => {
            try {
                if (!fs.existsSync(filePath))
                    return false;
                return fs.statSync(filePath).isDirectory();
            }
            catch (err) {
                return false;
            }
        },
        // file_mtime filePath -> number (get modification time as timestamp)
        "file_mtime": (filePath) => {
            try {
                const stats = fs.statSync(filePath);
                return stats.mtimeMs;
            }
            catch (err) {
                throw new Error(`file_mtime failed for '${filePath}': ${err.message}`);
            }
        },
        // file_ctime filePath -> number (get creation time as timestamp)
        "file_ctime": (filePath) => {
            try {
                const stats = fs.statSync(filePath);
                return stats.ctimeMs;
            }
            catch (err) {
                throw new Error(`file_ctime failed for '${filePath}': ${err.message}`);
            }
        },
    };
}
//# sourceMappingURL=stdlib-file.js.map