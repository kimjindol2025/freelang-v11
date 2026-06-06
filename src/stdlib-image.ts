// FreeLang v11: Image Processing stdlib (Phase A — AKL Suite)
// ImageMagick spawnSync 기반 (FL은 동기 실행만 지원)

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { spawnSync } from "child_process";

function tmpPath(ext: string): string {
  const dir = path.join(os.tmpdir(), "fl-images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, crypto.randomBytes(8).toString("hex") + ext);
}

function im(args: string[]): { ok: boolean; stderr: string } {
  const r = spawnSync("convert", args, { timeout: 30000 });
  if (r.error) throw new Error("ImageMagick not found: " + r.error.message);
  const stderr = r.stderr?.toString() ?? "";
  if (r.status !== 0) throw new Error("ImageMagick error: " + stderr);
  return { ok: true, stderr };
}

function identify(filePath: string): Map<string, any> {
  const r = spawnSync("identify", ["-format", "%wx%h %m %b", filePath], { timeout: 10000 });
  const m = new Map<string, any>();
  if (r.status !== 0) {
    m.set("width", 0); m.set("height", 0); m.set("format", "unknown");
    m.set("size", 0); m.set("channels", 3); m.set("has_alpha", false);
    return m;
  }
  const out = r.stdout?.toString().trim() ?? "";
  const match = out.match(/^(\d+)x(\d+)\s+(\S+)\s+(.+)$/);
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  m.set("width", match ? parseInt(match[1]) : 0);
  m.set("height", match ? parseInt(match[2]) : 0);
  m.set("format", match ? match[3].toLowerCase() : "unknown");
  m.set("size", stat);
  m.set("channels", 3);
  m.set("has_alpha", false);
  return m;
}

export function createImageModule(): Record<string, any> {
  return {
    // image_info path → {width, height, format, size, channels, has_alpha}
    "image_info": (filePath: string): Map<string, any> => {
      return identify(filePath);
    },

    // image_resize path width height → saved_path
    "image_resize": (filePath: string, width: number, height: number): string => {
      const ext = path.extname(filePath) || ".jpg";
      const out = tmpPath(ext);
      im([filePath, "-resize", `${Math.floor(width)}x${Math.floor(height)}>`, out]);
      return out;
    },

    // image_thumbnail path size → saved_path (square crop, JPEG)
    "image_thumbnail": (filePath: string, size: number): string => {
      const sz = Math.floor(size);
      const out = tmpPath(".jpg");
      im([filePath, "-thumbnail", `${sz}x${sz}^`, "-gravity", "center", "-extent", `${sz}x${sz}`, "-quality", "85", out]);
      return out;
    },

    // image_convert path format → saved_path
    "image_convert": (filePath: string, format: string): string => {
      const fmt = (format || "jpg").toLowerCase().replace("jpeg", "jpg");
      const out = tmpPath("." + fmt);
      im([filePath, "-quality", "85", out]);
      return out;
    },

    // image_watermark path text → saved_path
    "image_watermark": (filePath: string, text: string): string => {
      const ext = path.extname(filePath) || ".jpg";
      const out = tmpPath(ext);
      im([filePath, "-gravity", "SouthEast", "-fill", "rgba(255,255,255,0.6)",
          "-pointsize", "24", "-annotate", "+10+10", text, out]);
      return out;
    },

    // image_crop path x y width height → saved_path
    "image_crop": (filePath: string, x: number, y: number, w: number, h: number): string => {
      const ext = path.extname(filePath) || ".jpg";
      const out = tmpPath(ext);
      im([filePath, "-crop", `${Math.floor(w)}x${Math.floor(h)}+${Math.floor(x)}+${Math.floor(y)}`, "+repage", out]);
      return out;
    },
  };
}
