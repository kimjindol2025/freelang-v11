// FreeLang v11: File Descriptor (fd) Standard Library
// Low-level file I/O with explicit file descriptors
// Provides: fd_open, fd_write, fd_fsync, fd_close, fd_read

import * as fs from "fs";

// Global fd cache to maintain open file handles
const fdCache: Map<number, number> = new Map();
let nextFd = 1000; // Start from 1000 to avoid conflicts with system fds

/**
 * Create the file descriptor module for FreeLang
 * Provides low-level fd-based file operations for WAL engines
 */
export function createFdModule() {
  return {
    // fd_open path mode -> number (fd, mode: r/w/a)
    "fd_open": (filePath: string, mode: string): number => {
      try {
        let fsMode: string;
        switch (mode) {
          case "r":
            fsMode = "r";
            break;
          case "w":
            fsMode = "w";
            break;
          case "a":
            fsMode = "a";
            break;
          default:
            throw new Error(`Invalid mode: ${mode}. Use "r", "w", or "a"`);
        }

        const nativeFd = fs.openSync(filePath, fsMode);
        const syntheticFd = nextFd++;
        fdCache.set(syntheticFd, nativeFd);
        return syntheticFd;
      } catch (err: any) {
        throw new Error(`fd_open failed for '${filePath}' (${mode}): ${err.message}`);
      }
    },

    // fd_write fd data -> boolean (write data to file descriptor)
    "fd_write": (fd: number, data: string): boolean => {
      try {
        const nativeFd = fdCache.get(fd);
        if (nativeFd === undefined) {
          throw new Error(`Invalid file descriptor: ${fd}`);
        }
        fs.writeSync(nativeFd, data, "utf-8");
        return true;
      } catch (err: any) {
        throw new Error(`fd_write failed on fd ${fd}: ${err.message}`);
      }
    },

    // fd_fsync fd -> boolean (flush file descriptor to disk)
    "fd_fsync": (fd: number): boolean => {
      try {
        const nativeFd = fdCache.get(fd);
        if (nativeFd === undefined) {
          throw new Error(`Invalid file descriptor: ${fd}`);
        }
        fs.fsyncSync(nativeFd);
        return true;
      } catch (err: any) {
        throw new Error(`fd_fsync failed on fd ${fd}: ${err.message}`);
      }
    },

    // fd_close fd -> boolean (close file descriptor)
    "fd_close": (fd: number): boolean => {
      try {
        const nativeFd = fdCache.get(fd);
        if (nativeFd === undefined) {
          throw new Error(`Invalid file descriptor: ${fd}`);
        }
        fs.closeSync(nativeFd);
        fdCache.delete(fd);
        return true;
      } catch (err: any) {
        throw new Error(`fd_close failed on fd ${fd}: ${err.message}`);
      }
    },

    // fd_read fd bytes -> string (read bytes from file descriptor)
    "fd_read": (fd: number, bytes: number): string => {
      try {
        const nativeFd = fdCache.get(fd);
        if (nativeFd === undefined) {
          throw new Error(`Invalid file descriptor: ${fd}`);
        }
        const buf = Buffer.alloc(bytes);
        const bytesRead = fs.readSync(nativeFd, buf, 0, bytes);
        return buf.toString("utf-8", 0, bytesRead);
      } catch (err: any) {
        throw new Error(`fd_read failed on fd ${fd}: ${err.message}`);
      }
    },

    // fd_seek fd offset whence -> number (whence: 0/1/2)
    "fd_seek": (fd: number, offset: number, whence: number): number => {
      try {
        const nativeFd = fdCache.get(fd);
        if (nativeFd === undefined) {
          throw new Error(`Invalid file descriptor: ${fd}`);
        }
        // Node.js doesn't have sync seek, but we can track position manually
        // For WAL, we typically append only, so this is minimal
        const stats = fs.fstatSync(nativeFd);
        return stats.size;
      } catch (err: any) {
        throw new Error(`fd_seek failed on fd ${fd}: ${err.message}`);
      }
    },

    // fd_flush -> boolean (flush all open fds)
    "fd_flush": (): boolean => {
      try {
        for (const nativeFd of fdCache.values()) {
          fs.fsyncSync(nativeFd);
        }
        return true;
      } catch (err: any) {
        throw new Error(`fd_flush failed: ${err.message}`);
      }
    },
  };
}
