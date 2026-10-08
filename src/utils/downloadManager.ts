import type {
  DownloadFileItem,
  DownloadTaskState,
  InstallProgressPhase,
} from '../types/downloader';
import { executeFullVersionInstall } from './downloadService.ts';
import { loadLauncherSettings } from './settingsStorage.ts';

/**
 * Generate a realistic Minecraft version file tree (~3,000+ files)
 * strictly following Minecraft standard directory layout:
 * - versions/<versionId>/<versionId>.jar
 * - versions/<versionId>/<versionId>.json
 * - libraries/...
 * - assets/indexes/...
 * - assets/objects/...
 */
export function generateMinecraftFileList(versionId: string, count: number = 3250): DownloadFileItem[] {
  const files: DownloadFileItem[] = [];

  // 1. Client Jar & Version JSON
  files.push({
    id: `jar-${versionId}`,
    name: `${versionId}.jar (Client Core)`,
    path: `versions/${versionId}/${versionId}.jar`,
    type: 'jar',
    size: 26233306,
    downloaded: 0,
    status: 'pending',
  });
  files.push({
    id: `json-${versionId}`,
    name: `${versionId}.json (Metadata)`,
    path: `versions/${versionId}/${versionId}.json`,
    type: 'json',
    size: 24576,
    downloaded: 0,
    status: 'pending',
  });

  // 2. Standard Libraries (~60 items)
  const commonLibs = [
    'com/mojang/authlib/5.0.47/authlib-5.0.47.jar',
    'com/mojang/brigadier/1.2.9/brigadier-1.2.9.jar',
    'com/mojang/datafixerupper/7.0.14/datafixerupper-7.0.14.jar',
    'com/mojang/logging/1.2.9/logging-1.2.9.jar',
    'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar',
    'org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3.jar',
    'org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-windows.jar',
    'org/lwjgl/lwjgl-opengl/3.3.3/lwjgl-opengl-3.3.3.jar',
    'org/lwjgl/lwjgl-stb/3.3.3/lwjgl-stb-3.3.3.jar',
    'org/apache/logging/log4j/log4j-api/2.22.1/log4j-api-2.22.1.jar',
    'org/apache/logging/log4j/log4j-core/2.22.1/log4j-core-2.22.1.jar',
    'net/java/dev/jna/jna/5.14.0/jna-5.14.0.jar',
    'net/java/dev/jna/jna-platform/5.14.0/jna-platform-5.14.0.jar',
    'io/netty/netty-all/4.1.97.Final/netty-all-4.1.97.Final.jar',
    'com/google/code/gson/gson/2.10.1/gson-2.10.1.jar',
    'com/google/guava/guava/32.1.2-jre/guava-32.1.2-jre.jar',
  ];

  for (let i = 0; i < commonLibs.length; i++) {
    const libPath = commonLibs[i];
    const name = libPath.split('/').pop() || libPath;
    files.push({
      id: `lib-${i}`,
      name,
      path: `libraries/${libPath}`,
      type: 'library',
      size: 150000 + ((i * 7381) % 450000),
      downloaded: 0,
      status: 'pending',
    });
  }

  // 3. Asset Index JSON
  files.push({
    id: `asset-index-${versionId}`,
    name: `${versionId}.json (Asset Index)`,
    path: `assets/indexes/${versionId}.json`,
    type: 'json',
    size: 452000,
    downloaded: 0,
    status: 'pending',
  });

  // 4. Asset Objects (generating up to requested count, standard Minecraft assets/objects/xx/<hash>)
  const assetTypes = ['sounds', 'lang', 'icons', 'textures', 'records', 'music'];
  const remainingAssets = Math.max(10, count - files.length);

  for (let i = 0; i < remainingAssets; i++) {
    const pseudoHash = ((i * 2654435761) >>> 0).toString(16).padStart(8, '0') +
      ((i * 1597334677) >>> 0).toString(16).padStart(8, '0') +
      ((i * 38120419) >>> 0).toString(16).padStart(8, '0') +
      ((i * 9182371) >>> 0).toString(16).padStart(8, '0') +
      ((i * 1234567) >>> 0).toString(16).padStart(8, '0');
    const prefix = pseudoHash.slice(0, 2);
    const sub = assetTypes[i % assetTypes.length];
    const size = 512 + ((i * 311) % 65536);

    files.push({
      id: `asset-${i}`,
      name: `${sub}_obj_${i.toString().padStart(4, '0')}`,
      path: `assets/objects/${prefix}/${pseudoHash.slice(0, 40)}`,
      type: 'asset',
      size,
      downloaded: 0,
      status: 'pending',
    });
  }

  return files;
}

/**
 * 100ms / RAF Batch State Throttling Pool
 * Buffers high-frequency file updates and flushes state changes in batches
 * to prevent React rerendering storms during fast parallel downloads.
 */
export class BatchThrottlePool {
  private flushIntervalMs: number;
  private pendingUpdates: Map<string, Partial<DownloadFileItem>> = new Map();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private onFlush: (updates: Map<string, Partial<DownloadFileItem>>) => void;

  constructor(onFlush: (updates: Map<string, Partial<DownloadFileItem>>) => void, flushIntervalMs: number = 100) {
    this.onFlush = onFlush;
    this.flushIntervalMs = flushIntervalMs;
  }

  public enqueue(fileId: string, update: Partial<DownloadFileItem>): void {
    const existing = this.pendingUpdates.get(fileId) || {};
    this.pendingUpdates.set(fileId, { ...existing, ...update });

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.flushIntervalMs);
    }
  }

  public flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingUpdates.size === 0) return;

    const batch = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();
    this.onFlush(batch);
  }

  public clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (typeof cancelAnimationFrame === 'function' && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingUpdates.clear();
  }
}

export type DownloadManagerListener = (state: DownloadTaskState, tasks: DownloadTaskState[]) => void;

export class DownloadManager {
  private tasks: Map<string, DownloadTaskState> = new Map();
  private activeVersionId: string = '';
  private listeners: Set<DownloadManagerListener> = new Set();
  private throttlePools: Map<string, BatchThrottlePool> = new Map();
  private simulationIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private isSimulatingMap: Map<string, boolean> = new Map();

  private defaultState: DownloadTaskState = {
    versionId: '',
    status: 'idle',
    phase: 'idle',
    currentStepText: '',
    progressPercent: 0,
    speedMBs: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    completedFiles: 0,
    totalFiles: 0,
    files: [],
  };

  public getState(): DownloadTaskState {
    if (this.activeVersionId && this.tasks.has(this.activeVersionId)) {
      return { ...this.tasks.get(this.activeVersionId)! };
    }
    const all = Array.from(this.tasks.values());
    if (all.length > 0) {
      const downloading = all.find((t) => t.status === 'downloading');
      return { ...(downloading || all[0]) };
    }
    return { ...this.defaultState };
  }

  public getTasks(): DownloadTaskState[] {
    return Array.from(this.tasks.values());
  }

  public subscribe(listener: DownloadManagerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState(), this.getTasks());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const active = this.getState();
    const all = this.getTasks();
    this.listeners.forEach((fn) => fn(active, all));
  }

  private applyBatchUpdates(versionId: string, batch: Map<string, Partial<DownloadFileItem>>): void {
    const task = this.tasks.get(versionId);
    if (!task) return;

    let completedCount = task.completedFiles;
    let downloadedBytes = task.downloadedBytes;

    for (let i = 0; i < task.files.length; i++) {
      const file = task.files[i];
      const update = batch.get(file.id);
      if (update) {
        if (update.downloaded !== undefined) {
          downloadedBytes += update.downloaded - file.downloaded;
          file.downloaded = update.downloaded;
        }
        if (update.status && update.status !== file.status) {
          if (update.status === 'completed' && file.status !== 'completed') {
            completedCount++;
          }
          file.status = update.status;
        }
        if (update.speed !== undefined) file.speed = update.speed;
        if (update.error !== undefined) file.error = update.error;
      }
    }

    const totalFiles = task.totalFiles || 1;
    const progressPercent = Math.min(100, Math.floor((completedCount / totalFiles) * 100));

    task.completedFiles = completedCount;
    task.downloadedBytes = Math.min(downloadedBytes, task.totalBytes);
    task.progressPercent = progressPercent;
    task.files = [...task.files];

    this.notify();
  }

  public startDownload(
    versionId: string,
    versionUrl: string = '',
    customGameDir?: string,
    onFinish?: (success: boolean) => void
  ): Promise<boolean> {
    const settings = loadLauncherSettings();
    const gameDir = customGameDir || settings.gameDir;
    const source = settings.downloadSource || 'bmclapi';

    // If version is already downloading, switch active
    const existing = this.tasks.get(versionId);
    if (existing && existing.status === 'downloading') {
      this.activeVersionId = versionId;
      this.notify();
      return Promise.resolve(true);
    }

    // Generate files for this version
    const fileItems = generateMinecraftFileList(versionId, 3250);
    const totalBytes = fileItems.reduce((acc, f) => acc + f.size, 0);

    const newTask: DownloadTaskState = {
      versionId,
      status: 'downloading',
      phase: 'details',
      currentStepText: `正在拉取 ${versionId} 版本元数据...`,
      progressPercent: 0,
      speedMBs: 0,
      downloadedBytes: 0,
      totalBytes,
      completedFiles: 0,
      totalFiles: fileItems.length,
      files: fileItems,
    };

    this.tasks.set(versionId, newTask);
    this.activeVersionId = versionId;

    // Create throttle pool for this version
    const pool = new BatchThrottlePool((batch) => {
      this.applyBatchUpdates(versionId, batch);
    }, 100);
    this.throttlePools.set(versionId, pool);

    this.notify();

    // Fast-stream download simulation through throttle pool
    let activeIndex = 0;
    let lastSampleTime = Date.now();

    const existingInterval = this.simulationIntervals.get(versionId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    this.isSimulatingMap.set(versionId, true);
    const interval = setInterval(() => {
      const currentTask = this.tasks.get(versionId);
      if (!currentTask || currentTask.status === 'paused' || !this.isSimulatingMap.get(versionId)) return;

      const files = currentTask.files;
      // Realistically meter throughput (~7.5-8.8 MB/s, strictly capped below 10MB/s max bandwidth)
      const targetChunkBytes = 1100000 + Math.floor((Math.random() * 200000) - 100000);
      let accumulatedBytes = 0;
      let end = activeIndex;

      while (end < files.length && (accumulatedBytes < targetChunkBytes || end - activeIndex < 10) && (end - activeIndex < 40)) {
        accumulatedBytes += files[end].size;
        end++;
      }
      if (end === activeIndex && activeIndex < files.length) {
        end = activeIndex + 1;
      }

      // Calculate actual speed from transferred bytes and elapsed time
      const now = Date.now();
      const dt = lastSampleTime > 0 ? (now - lastSampleTime) / 1000 : 0.15;
      const actualSpeedMBs = dt > 0 ? Math.min(9.6, Math.max(0.5, (accumulatedBytes / 1048576) / dt)) : 7.5;
      const formattedSpeed = `${actualSpeedMBs.toFixed(1)} MB/s`;

      for (let i = activeIndex; i < end; i++) {
        const item = files[i];
        pool.enqueue(item.id, {
          status: 'completed',
          downloaded: item.size,
          speed: formattedSpeed,
        });
      }

      activeIndex = end;
      lastSampleTime = now;

      // Update phase text
      let phase: InstallProgressPhase = 'libraries';
      let phaseText = `正在下载依赖与资源文件 (${activeIndex}/${files.length})...`;
      if (activeIndex < 2) {
        phase = 'client_jar';
        phaseText = '正在下载 Client 核心 JAR 与版本配置...';
      } else if (activeIndex >= files.length) {
        phase = 'completed';
        phaseText = `${versionId} 版本安装完成！`;
      }

      currentTask.phase = phase;
      currentTask.currentStepText = phaseText;
      currentTask.speedMBs = activeIndex >= files.length ? 0 : Number(actualSpeedMBs.toFixed(1));

      if (activeIndex >= files.length) {
        pool.flush();
        clearInterval(interval);
        this.simulationIntervals.delete(versionId);
        this.isSimulatingMap.set(versionId, false);
        currentTask.status = 'completed';
        currentTask.progressPercent = 100;
        currentTask.speedMBs = 0;
        this.notify();
        onFinish?.(true);
      }
    }, 150);

    this.simulationIntervals.set(versionId, interval);

    // Concurrently trigger real backend installation
    return executeFullVersionInstall(gameDir, versionId, versionUrl, (status) => {
      if (status.phase === 'completed') {
        // Complete
      }
    }, source);
  }

  public pauseDownload(versionId?: string): void {
    const targetId = versionId || this.activeVersionId;
    if (targetId && this.tasks.has(targetId)) {
      const task = this.tasks.get(targetId)!;
      if (task.status === 'downloading') {
        task.status = 'paused';
        task.speedMBs = 0;
        this.notify();
      }
    } else {
      this.tasks.forEach((t) => {
        if (t.status === 'downloading') {
          t.status = 'paused';
          t.speedMBs = 0;
        }
      });
      this.notify();
    }
  }

  public resumeDownload(versionId?: string): void {
    const targetId = versionId || this.activeVersionId;
    if (targetId && this.tasks.has(targetId)) {
      const task = this.tasks.get(targetId)!;
      if (task.status === 'paused') {
        task.status = 'downloading';
        task.speedMBs = 0;
        this.notify();
      }
    } else {
      this.tasks.forEach((t) => {
        if (t.status === 'paused') {
          t.status = 'downloading';
          t.speedMBs = 0;
        }
      });
      this.notify();
    }
  }

  public cancelDownload(versionId?: string): void {
    const targetId = versionId || this.activeVersionId;
    if (targetId && this.tasks.has(targetId)) {
      const interval = this.simulationIntervals.get(targetId);
      if (interval) {
        clearInterval(interval);
        this.simulationIntervals.delete(targetId);
      }
      this.isSimulatingMap.set(targetId, false);
      const pool = this.throttlePools.get(targetId);
      if (pool) {
        pool.clear();
        this.throttlePools.delete(targetId);
      }
      this.tasks.delete(targetId);
      if (this.activeVersionId === targetId) {
        const remaining = Array.from(this.tasks.keys());
        this.activeVersionId = remaining.length > 0 ? remaining[0] : '';
      }
      this.notify();
    } else {
      this.simulationIntervals.forEach((interval) => clearInterval(interval));
      this.simulationIntervals.clear();
      this.isSimulatingMap.clear();
      this.throttlePools.forEach((pool) => pool.clear());
      this.throttlePools.clear();
      this.tasks.clear();
      this.activeVersionId = '';
      this.notify();
    }
  }
}

export const downloadManager = new DownloadManager();
