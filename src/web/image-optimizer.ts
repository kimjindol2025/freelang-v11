/**
 * FreeLang v11 - Image Optimizer (W6)
 * 이미지 최적화: WebP/AVIF 변환 (sharp 동적 로드, graceful fallback)
 */

import * as fs from "fs";
import * as path from "path";

export type OptimizationBackend = "sharp" | "cwebp" | "none";

export interface ImageOptimizeOptions {
  width?: number;
  format?: "webp" | "avif";
  quality?: number;
}

/**
 * 이미지 최적화 엔진
 */
export class ImageOptimizer {
  private backend: OptimizationBackend = "none";
  private cache: Map<string, boolean> = new Map(); // 변환된 파일 캐시

  constructor() {
    this.detectAvailableBackend();
  }

  /**
   * 사용 가능한 백엔드 감지
   */
  private detectAvailableBackend(): void {
    try {
      // sharp 감지
      require("sharp");
      this.backend = "sharp";
      console.log("ImageOptimizer: sharp backend available");
      return;
    } catch (err) {
      // sharp 없음
    }

    try {
      // cwebp 감지 (시스템 바이너리)
      const { execSync } = require("child_process");
      execSync("which cwebp", { stdio: "pipe" });
      this.backend = "cwebp";
      console.log("ImageOptimizer: cwebp backend available");
      return;
    } catch (err) {
      // cwebp 없음
    }

    // fallback to none
    this.backend = "none";
    console.log("ImageOptimizer: no optimization backend (graceful fallback)");
  }

  /**
   * 감지된 백엔드 반환
   */
  detectBackend(): OptimizationBackend {
    return this.backend;
  }

  /**
   * 이미지 최적화
   */
  async optimizeImage(
    srcPath: string,
    destDir: string,
    options: ImageOptimizeOptions = {}
  ): Promise<void> {
    // 파일 존재 확인
    if (!fs.existsSync(srcPath)) {
      console.warn(`ImageOptimizer: file not found ${srcPath}`);
      return;
    }

    const fileName = path.basename(srcPath);
    const baseName = path.parse(fileName).name;

    // 캐시 확인
    if (this.cache.has(srcPath)) {
      console.log(`ImageOptimizer: cache hit ${srcPath}`);
      return;
    }

    try {
      switch (this.backend) {
        case "sharp":
          await this.optimizeWithSharp(srcPath, destDir, baseName, options);
          break;
        case "cwebp":
          await this.optimizeWithCwebp(srcPath, destDir, baseName);
          break;
        case "none":
          this.copyOriginal(srcPath, destDir, fileName);
          break;
      }

      this.cache.set(srcPath, true);
    } catch (err: any) {
      console.error(`ImageOptimizer: error optimizing ${srcPath}:`, err.message);
      // graceful fallback: 원본 복사
      this.copyOriginal(srcPath, destDir, fileName);
    }
  }

  /**
   * sharp를 이용한 최적화
   */
  private async optimizeWithSharp(
    srcPath: string,
    destDir: string,
    baseName: string,
    options: ImageOptimizeOptions
  ): Promise<void> {
    try {
      const sharp = require("sharp");

      // WebP 생성
      if (options.format !== "avif") {
        const webpPath = path.join(destDir, `${baseName}.webp`);
        if (!fs.existsSync(webpPath)) {
          await sharp(srcPath)
            .webp({ quality: options.quality || 80 })
            .toFile(webpPath);
          console.log(`ImageOptimizer: generated WebP ${webpPath}`);
        }
      }

      // AVIF 생성 (선택사항)
      if (options.format === "avif") {
        const avifPath = path.join(destDir, `${baseName}.avif`);
        if (!fs.existsSync(avifPath)) {
          try {
            await sharp(srcPath)
              .avif({ quality: options.quality || 75 })
              .toFile(avifPath);
            console.log(`ImageOptimizer: generated AVIF ${avifPath}`);
          } catch (err) {
            // AVIF 실패하면 무시 (optional)
            console.warn(`ImageOptimizer: AVIF generation failed, skipping`);
          }
        }
      }
    } catch (err: any) {
      console.error(`ImageOptimizer: sharp optimization failed:`, err.message);
      throw err;
    }
  }

  /**
   * cwebp를 이용한 최적화
   */
  private async optimizeWithCwebp(
    srcPath: string,
    destDir: string,
    baseName: string
  ): Promise<void> {
    const { execSync } = require("child_process");

    try {
      const webpPath = path.join(destDir, `${baseName}.webp`);
      if (!fs.existsSync(webpPath)) {
        execSync(`cwebp -q 80 "${srcPath}" -o "${webpPath}"`);
        console.log(`ImageOptimizer: generated WebP ${webpPath}`);
      }
    } catch (err: any) {
      console.error(`ImageOptimizer: cwebp failed:`, err.message);
      throw err;
    }
  }

  /**
   * 원본 파일 복사 (백엔드 없을 때)
   */
  private copyOriginal(srcPath: string, destDir: string, fileName: string): void {
    try {
      const destPath = path.join(destDir, fileName);

      // 대상 디렉토리 생성
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // 파일 복사
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`ImageOptimizer: copied original ${destPath}`);
      }
    } catch (err: any) {
      console.error(`ImageOptimizer: copy failed:`, err.message);
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
    console.log("ImageOptimizer: cache cleared");
  }
}

export default ImageOptimizer;
