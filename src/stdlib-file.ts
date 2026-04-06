// FreeLang v9: File I/O Standard Library
// Phase 10: File operations (read, write, delete, etc.)

import * as fs from "fs";
import * as path from "path";

/**
 * Create the file I/O module for FreeLang
 * Provides: file_read, file_write, file_exists, file_delete, file_append
 *           dir_create, dir_list, dir_delete, file_copy
 */
export function createFileModule() {
  return {
    // file_read filePath -> string (read file content)
    "file_read": (filePath: string): string => {
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch (err: any) {
        throw new Error(`file_read failed for '${filePath}': ${err.message}`);
      }
    },

    // file_write filePath content -> boolean (write content to file)
    "file_write": (filePath: string, content: string): boolean => {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        if (dir !== "." && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, "utf-8");
        return true;
      } catch (err: any) {
        throw new Error(`file_write failed for '${filePath}': ${err.message}`);
      }
    },

    // file_exists filePath -> boolean (check if file exists)
    "file_exists": (filePath: string): boolean => {
      return fs.existsSync(filePath);
    },

    // file_delete filePath -> boolean (delete file)
    "file_delete": (filePath: string): boolean => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return true;
        }
        return false;
      } catch (err: any) {
        throw new Error(`file_delete failed for '${filePath}': ${err.message}`);
      }
    },

    // file_append filePath content -> boolean (append content to file)
    "file_append": (filePath: string, content: string): boolean => {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        if (dir !== "." && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(filePath, content, "utf-8");
        return true;
      } catch (err: any) {
        throw new Error(`file_append failed for '${filePath}': ${err.message}`);
      }
    },

    // file_copy src dest -> boolean (copy file)
    "file_copy": (src: string, dest: string): boolean => {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(dest);
        if (dir !== "." && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
        return true;
      } catch (err: any) {
        throw new Error(`file_copy failed from '${src}' to '${dest}': ${err.message}`);
      }
    },

    // dir_create dirPath -> boolean (create directory)
    "dir_create": (dirPath: string): boolean => {
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        return true;
      } catch (err: any) {
        throw new Error(`dir_create failed for '${dirPath}': ${err.message}`);
      }
    },

    // dir_list dirPath -> [string] (list directory contents)
    "dir_list": (dirPath: string): string[] => {
      try {
        if (!fs.existsSync(dirPath)) {
          throw new Error(`Directory not found: '${dirPath}'`);
        }
        return fs.readdirSync(dirPath);
      } catch (err: any) {
        throw new Error(`dir_list failed for '${dirPath}': ${err.message}`);
      }
    },

    // dir_delete dirPath -> boolean (delete directory - must be empty)
    "dir_delete": (dirPath: string): boolean => {
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmdirSync(dirPath);
          return true;
        }
        return false;
      } catch (err: any) {
        throw new Error(`dir_delete failed for '${dirPath}': ${err.message}`);
      }
    },

    // file_size filePath -> number (get file size in bytes)
    "file_size": (filePath: string): number => {
      try {
        const stats = fs.statSync(filePath);
        return stats.size;
      } catch (err: any) {
        throw new Error(`file_size failed for '${filePath}': ${err.message}`);
      }
    },

    // file_is_file filePath -> boolean (check if path is a file)
    "file_is_file": (filePath: string): boolean => {
      try {
        if (!fs.existsSync(filePath)) return false;
        return fs.statSync(filePath).isFile();
      } catch (err: any) {
        return false;
      }
    },

    // file_is_dir filePath -> boolean (check if path is a directory)
    "file_is_dir": (filePath: string): boolean => {
      try {
        if (!fs.existsSync(filePath)) return false;
        return fs.statSync(filePath).isDirectory();
      } catch (err: any) {
        return false;
      }
    },

    // file_mtime filePath -> number (get modification time as timestamp)
    "file_mtime": (filePath: string): number => {
      try {
        const stats = fs.statSync(filePath);
        return stats.mtimeMs;
      } catch (err: any) {
        throw new Error(`file_mtime failed for '${filePath}': ${err.message}`);
      }
    },

    // file_ctime filePath -> number (get creation time as timestamp)
    "file_ctime": (filePath: string): number => {
      try {
        const stats = fs.statSync(filePath);
        return stats.ctimeMs;
      } catch (err: any) {
        throw new Error(`file_ctime failed for '${filePath}': ${err.message}`);
      }
    },
  };
}
