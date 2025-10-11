/**
 * Actual Video Renderer using Remotion
 * 実際のRemotionレンダリングを使用した動画生成
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { SceneGraph } from '@/types/diagram';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface ActualVideoRenderOptions {
  scenes: SceneGraph[];
  audioUrl?: string;
  outputPath?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface ActualVideoRenderProgress {
  progress: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
  stage: 'preparing' | 'bundling' | 'rendering' | 'encoding' | 'complete' | 'error';
}

/**
 * 実際のRemotionレンダリングエンジン
 */
export class ActualVideoRenderer {
  private bundleCachePath: string | null = null;

  constructor() {
    // 一時ディレクトリの準備
    const tmpDir = path.join(os.tmpdir(), 'speech-to-visuals-renders');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  }

  /**
   * 実際の動画レンダリング
   */
  async renderVideo(
    options: ActualVideoRenderOptions,
    onProgress?: (progress: ActualVideoRenderProgress) => void
  ): Promise<string> {
    try {
      console.log('🎬 Starting actual Remotion video render...');

      // ステップ1: Bundling
      onProgress?.({
        progress: 0,
        currentFrame: 0,
        totalFrames: 0,
        message: 'Bundling Remotion composition...',
        stage: 'bundling',
      });

      const bundleLocation = await this.bundleComposition(onProgress);

      // ステップ2: コンポジション情報取得
      onProgress?.({
        progress: 20,
        currentFrame: 0,
        totalFrames: 0,
        message: 'Loading composition metadata...',
        stage: 'preparing',
      });

      const composition = await this.getComposition(bundleLocation, options.scenes);

      // ステップ3: 動画レンダリング
      onProgress?.({
        progress: 30,
        currentFrame: 0,
        totalFrames: composition.durationInFrames,
        message: 'Rendering video frames...',
        stage: 'rendering',
      });

      const outputPath = options.outputPath || this.generateOutputPath();
      const videoPath = await this.renderComposition(
        bundleLocation,
        composition,
        outputPath,
        options,
        onProgress
      );

      // ステップ4: 完了
      onProgress?.({
        progress: 100,
        currentFrame: composition.durationInFrames,
        totalFrames: composition.durationInFrames,
        message: 'Video render complete!',
        stage: 'complete',
      });

      console.log('✅ Video render completed:', videoPath);
      return videoPath;

    } catch (error) {
      console.error('❌ Video render failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({
        progress: 0,
        currentFrame: 0,
        totalFrames: 0,
        message: `Error: ${errorMessage}`,
        stage: 'error',
      });

      throw error;
    }
  }

  /**
   * Remotionコンポジションをバンドル
   */
  private async bundleComposition(
    onProgress?: (progress: ActualVideoRenderProgress) => void
  ): Promise<string> {
    // キャッシュがあれば再利用
    if (this.bundleCachePath && fs.existsSync(this.bundleCachePath)) {
      console.log('📦 Using cached bundle:', this.bundleCachePath);
      return this.bundleCachePath;
    }

    console.log('📦 Bundling Remotion composition...');

    const entryPoint = path.join(process.cwd(), 'src', 'remotion', 'index.ts');

    onProgress?.({
      progress: 5,
      currentFrame: 0,
      totalFrames: 0,
      message: 'Bundling with Webpack...',
      stage: 'bundling',
    });

    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    this.bundleCachePath = bundleLocation;

    onProgress?.({
      progress: 20,
      currentFrame: 0,
      totalFrames: 0,
      message: 'Bundle complete!',
      stage: 'bundling',
    });

    console.log('✅ Bundle location:', bundleLocation);
    return bundleLocation;
  }

  /**
   * コンポジション情報を取得
   */
  private async getComposition(
    bundleLocation: string,
    scenes: SceneGraph[]
  ) {
    console.log('🎯 Selecting composition...');

    // シーンから合計時間を計算
    const totalDurationMs = scenes.reduce((acc, scene) => {
      const sceneDuration = (scene.endTime - scene.startTime) * 1000;
      return Math.max(acc, scene.startTime * 1000 + sceneDuration);
    }, 0);

    const fps = 30;
    const durationInFrames = Math.ceil((totalDurationMs / 1000) * fps);

    const inputProps = {
      scenes,
      backgroundColor: '#0f0f23',
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'DiagramVideo',
      inputProps,
    });

    // 計算した時間を上書き
    composition.durationInFrames = durationInFrames;

    console.log('✅ Composition selected:', {
      id: composition.id,
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
      duration: `${(durationInFrames / fps).toFixed(2)}s`,
    });

    return composition;
  }

  /**
   * 実際のレンダリング実行
   */
  private async renderComposition(
    bundleLocation: string,
    composition: any,
    outputPath: string,
    options: ActualVideoRenderOptions,
    onProgress?: (progress: ActualVideoRenderProgress) => void
  ): Promise<string> {
    console.log('🎥 Rendering video to:', outputPath);

    const qualitySettings = this.getQualitySettings(options.quality || 'medium');

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        scenes: options.scenes,
        audioUrl: options.audioUrl,
        backgroundColor: '#0f0f23',
      },
      ...qualitySettings,
      onProgress: (progress) => {
        // progress.totalFrames が undefined の場合は composition.durationInFrames を使用
        const totalFrames = progress.totalFrames || composition.durationInFrames;
        const overallProgress = 30 + (progress.renderedFrames / totalFrames) * 60;

        onProgress?.({
          progress: overallProgress,
          currentFrame: progress.renderedFrames,
          totalFrames: totalFrames,
          message: `Rendering frame ${progress.renderedFrames}/${totalFrames}`,
          stage: 'rendering',
        });

        // 10フレームごとにログ出力（スパム防止）
        if (progress.renderedFrames % 10 === 0) {
          console.log(`📊 Render progress: ${progress.renderedFrames}/${totalFrames} (${(progress.renderedFrames / totalFrames * 100).toFixed(1)}%)`);
        }
      },
    });

    // エンコーディング完了
    onProgress?.({
      progress: 95,
      currentFrame: composition.durationInFrames,
      totalFrames: composition.durationInFrames,
      message: 'Finalizing video...',
      stage: 'encoding',
    });

    return outputPath;
  }

  /**
   * 品質設定を取得
   */
  private getQualitySettings(quality: 'low' | 'medium' | 'high') {
    const settings = {
      low: {
        scale: 0.5,
        crf: 28,
        pixelFormat: 'yuv420p' as const,
      },
      medium: {
        scale: 1,
        crf: 18,
        pixelFormat: 'yuv420p' as const,
      },
      high: {
        scale: 1,
        crf: 15,
        pixelFormat: 'yuv420p' as const,
      },
    };

    return settings[quality];
  }

  /**
   * 出力パスを生成
   */
  private generateOutputPath(): string {
    const tmpDir = path.join(os.tmpdir(), 'speech-to-visuals-renders');
    const timestamp = Date.now();
    const filename = `diagram-video-${timestamp}.mp4`;
    return path.join(tmpDir, filename);
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.bundleCachePath = null;
  }
}

// シングルトンインスタンス
export const actualVideoRenderer = new ActualVideoRenderer();
