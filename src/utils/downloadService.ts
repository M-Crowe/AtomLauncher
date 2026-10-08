import type {
  DownloadSource,
  IntegrityReport,
  MissingLibraryInfo,
  ModLoaderType,
  VersionInstallStatus,
  VersionManifest,
} from '../types/downloader';
import { fetchLoaderProfile } from './loaderService.ts';
import { loadLauncherSettings } from './settingsStorage.ts';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export const OFFICIAL_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
export const BMCLAPI_MANIFEST_URL = 'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json';

export const MCBBS_MANIFEST_URL = 'https://download.mcbbs.net/mc/game/version_manifest_v2.json';

export function transformDownloadUrl(url: string, source: DownloadSource | string = 'bmclapi'): string {
  const lower = source.toLowerCase();
  if (lower === 'mojang' || lower === 'official') {
    return url;
  }

  const mirrorBase = lower === 'mcbbs' ? 'https://download.mcbbs.net' : 'https://bmclapi2.bangbang93.com';
  let transformed = url;

  // 1. Mojang Meta & Packages
  transformed = transformed.replace('https://piston-meta.mojang.com', mirrorBase);
  transformed = transformed.replace('http://piston-meta.mojang.com', mirrorBase);
  transformed = transformed.replace('https://launchermeta.mojang.com', mirrorBase);
  transformed = transformed.replace('http://launchermeta.mojang.com', mirrorBase);

  // 2. Client / Server / Piston Data
  transformed = transformed.replace('https://piston-data.mojang.com', mirrorBase);
  transformed = transformed.replace('http://piston-data.mojang.com', mirrorBase);

  // 3. Libraries (libraries.minecraft.net -> <mirror>/maven)
  transformed = transformed.replace('https://libraries.minecraft.net', `${mirrorBase}/maven`);
  transformed = transformed.replace('http://libraries.minecraft.net', `${mirrorBase}/maven`);

  // 4. Asset Objects (resources.download.minecraft.net -> <mirror>/assets)
  transformed = transformed.replace('https://resources.download.minecraft.net', `${mirrorBase}/assets`);
  transformed = transformed.replace('http://resources.download.minecraft.net', `${mirrorBase}/assets`);

  // 5. Maven Forge / Fabric / NeoForged
  transformed = transformed.replace('https://files.minecraftforge.net/maven', `${mirrorBase}/maven`);
  transformed = transformed.replace('https://maven.minecraftforge.net', `${mirrorBase}/maven`);
  transformed = transformed.replace('https://maven.fabricmc.net', `${mirrorBase}/maven`);
  transformed = transformed.replace('https://maven.neoforged.net/releases', `${mirrorBase}/maven`);

  return transformed;
}

export async function inferVersionJava(versionId: string, declaredMajor?: number): Promise<number> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<number>('infer_version_java', {
        versionId,
        declaredMajor,
      });
    } catch {
      // Fallback
    }
  }

  if (declaredMajor) return declaredMajor;
  const vid = versionId.toLowerCase();
  if (vid.startsWith('26.') || vid.includes('26w')) return 25;
  if (vid.startsWith('1.21') || vid.includes('1.21.') || vid.includes('24w')) return 21;
  if (vid.startsWith('1.18') || vid.startsWith('1.19') || vid.startsWith('1.20')) return 17;
  if (vid.startsWith('1.17')) return 16;
  return 8;
}

export async function fetchVersionManifest(source?: DownloadSource): Promise<VersionManifest> {
  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<VersionManifest>('fetch_version_manifest', {
        downloadSource: effectiveSource,
      });
    } catch (err) {
      console.warn('[downloadService] fetch_version_manifest invoke failed, fallback to mock:', err);
    }
  }

  // Graceful fallback for test/offline environments
  const sourceStr = String(effectiveSource).toLowerCase();
  const basePackageUrl =
    sourceStr === 'mojang' || sourceStr === 'official'
      ? 'https://piston-meta.mojang.com/v1/packages'
      : sourceStr === 'mcbbs'
      ? 'https://download.mcbbs.net/v1/packages'
      : 'https://bmclapi2.bangbang93.com/v1/packages';

  return {
    latest: {
      release: '1.21.1',
      snapshot: '24w33a',
    },
    versions: [
      {
        id: '1.21.1',
        type: 'release',
        url: `${basePackageUrl}/1.21.1/1.21.1.json`,
        time: '2024-08-08T00:00:00+00:00',
        releaseTime: '2024-08-08T00:00:00+00:00',
        sha1: 'e499c855aa13b1940e72bdca5e28a50de75bcddb',
        complianceLevel: 1,
      },
      {
        id: '1.20.4',
        type: 'release',
        url: `${basePackageUrl}/1.20.4/1.20.4.json`,
        time: '2023-12-07T00:00:00+00:00',
        releaseTime: '2023-12-07T00:00:00+00:00',
        sha1: '3fd1fb35ca4e50eb19b015e1fe7ee0424564506c',
        complianceLevel: 1,
      },
      {
        id: '1.16.5',
        type: 'release',
        url: `${basePackageUrl}/1.16.5/1.16.5.json`,
        time: '2021-01-15T00:00:00+00:00',
        releaseTime: '2021-01-15T00:00:00+00:00',
        sha1: '1fa9d15024b896da4663d2077e6f30d072483842',
        complianceLevel: 1,
      },
      {
        id: '24w33a',
        type: 'snapshot',
        url: `${basePackageUrl}/24w33a/24w33a.json`,
        time: '2024-08-14T00:00:00+00:00',
        releaseTime: '2024-08-14T00:00:00+00:00',
        sha1: 'bf12461877401d2179b5c393d0d8bbeccebafeaa',
        complianceLevel: 1,
      },
    ],
  };
}

export async function fetchVersionDetail(versionUrl: string, source?: DownloadSource): Promise<Record<string, unknown>> {
  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<Record<string, unknown>>('fetch_version_detail', {
      versionUrl,
      downloadSource: effectiveSource,
    });
  }

  // Mock detail payload
  return {
    id: '1.20.4',
    type: 'release',
    mainClass: 'net.minecraft.client.main.Main',
    assets: '1.20',
    assetIndex: {
      id: '1.20',
      sha1: '52c5058fa1ef3d7632ce8e21703cf9fb399d8b85',
      size: 442999,
      totalSize: 712211910,
      url: transformDownloadUrl('https://piston-meta.mojang.com/v1/packages/52c5058fa1ef3d7632ce8e21703cf9fb399d8b85/1.20.json', effectiveSource),
    },
    downloads: {
      client: {
        sha1: '8c31622329244038a8e100e478544e3922de1ff7',
        size: 26233306,
        url: transformDownloadUrl('https://piston-data.mojang.com/v1/objects/8c31622329244038a8e100e478544e3922de1ff7/client.jar', effectiveSource),
      },
    },
    libraries: [
      {
        name: 'com.mojang:authlib:5.0.47',
        downloads: {
          artifact: {
            path: 'com/mojang/authlib/5.0.47/authlib-5.0.47.jar',
            sha1: 'a87858cbfbbbf65e2a225dc22b0c3d9fe21a3e63',
            size: 135899,
            url: transformDownloadUrl('https://libraries.minecraft.net/com/mojang/authlib/5.0.47/authlib-5.0.47.jar', effectiveSource),
          },
        },
      },
    ],
  };
}

export async function resolveVersionInstallPlan(
  gameDir: string,
  versionId: string,
  versionJson?: Record<string, unknown>,
  source?: DownloadSource
): Promise<IntegrityReport> {
  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<IntegrityReport>('resolve_version_install_plan', {
      gameDir,
      versionId,
      versionJson,
      downloadSource: effectiveSource,
    });
  }

  return {
    isComplete: false,
    missingVersionJar: true,
    totalMissingCount: 2,
    missingLibraries: [
      {
        name: 'com.mojang:authlib:5.0.47',
        path: `${gameDir}/libraries/com/mojang/authlib/5.0.47/authlib-5.0.47.jar`,
        url: transformDownloadUrl('https://libraries.minecraft.net/com/mojang/authlib/5.0.47/authlib-5.0.47.jar', effectiveSource),
        sha1: 'a87858cbfbbbf65e2a225dc22b0c3d9fe21a3e63',
        size: 135899,
      },
    ],
    missingAssets: [
      {
        name: 'Asset Index: 1.20',
        path: `${gameDir}/assets/indexes/1.20.json`,
        hash: '',
        size: 0,
      },
    ],
  };
}

export async function installVersionJarAndJson(
  gameDir: string,
  versionId: string,
  versionJson: Record<string, unknown>,
  source?: DownloadSource
): Promise<boolean> {
  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('install_version_jar_and_json', {
      gameDir,
      versionId,
      versionJson,
      downloadSource: effectiveSource,
    });
  }
  return true;
}

export async function downloadMissingLibraries(
  gameDir: string,
  missingLibraries: MissingLibraryInfo[],
  source?: DownloadSource
): Promise<number> {
  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<number>('download_missing_libraries', {
      gameDir,
      missingLibraries,
      downloadSource: effectiveSource,
    });
  }
  return missingLibraries.length;
}

export async function downloadAssetObjects(
  gameDir: string,
  assetIndexId: string,
  source?: DownloadSource,
  maxItems?: number
): Promise<number> {
  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<number>('download_asset_objects', {
      gameDir,
      assetIndexId,
      downloadSource: effectiveSource,
      maxItems,
    });
  }
  return 0;
}

export interface FullVersionInstallOptions {
  gameDir: string;
  versionId: string;
  baseMcVersion?: string;
  versionUrl?: string;
  loader?: ModLoaderType;
  loaderVersion?: string;
  onProgress?: (status: VersionInstallStatus) => void;
  source?: DownloadSource;
}

export async function resolveAccurateVersionUrl(
  baseVersionId: string,
  providedUrl: string = '',
  source: DownloadSource = 'bmclapi'
): Promise<string> {
  const hasPackageHash = /\/packages\/[a-f0-9]{40}\//i.test(providedUrl);
  if (hasPackageHash) {
    return transformDownloadUrl(providedUrl, source);
  }

  try {
    const manifest = await fetchVersionManifest(source);
    const matched = manifest.versions.find((v) => v.id === baseVersionId);
    if (matched && matched.url) {
      return transformDownloadUrl(matched.url, source);
    }
  } catch (err) {
    console.warn('[downloadService] resolveAccurateVersionUrl manifest lookup fallback:', err);
  }

  return (
    providedUrl ||
    transformDownloadUrl(
      `https://piston-meta.mojang.com/v1/packages/${baseVersionId}/${baseVersionId}.json`,
      source
    )
  );
}

/**
 * 完整的一键版本下载与安装引擎编排器 (支持 Vanilla 与各类 ModLoader 完整闭环)
 */
export async function executeFullVersionInstall(
  gameDirOrOptions: string | FullVersionInstallOptions,
  versionIdParam?: string,
  versionUrlParam?: string,
  onProgressParam?: (status: VersionInstallStatus) => void,
  sourceParam?: DownloadSource
): Promise<boolean> {
  let gameDir: string;
  let versionId: string;
  let baseMcVersion: string;
  let versionUrl: string;
  let loader: ModLoaderType;
  let loaderVersion: string;
  let onProgress: ((status: VersionInstallStatus) => void) | undefined;
  let source: DownloadSource | undefined;

  if (typeof gameDirOrOptions === 'object') {
    gameDir = gameDirOrOptions.gameDir;
    versionId = gameDirOrOptions.versionId;
    baseMcVersion = gameDirOrOptions.baseMcVersion || versionId.split('-')[0] || versionId;
    versionUrl = gameDirOrOptions.versionUrl || '';
    loader = gameDirOrOptions.loader || 'vanilla';
    loaderVersion = gameDirOrOptions.loaderVersion || '';
    onProgress = gameDirOrOptions.onProgress;
    source = gameDirOrOptions.source;
  } else {
    gameDir = gameDirOrOptions;
    versionId = versionIdParam || '1.21.1';
    baseMcVersion = versionId.split('-')[0] || versionId;
    versionUrl = versionUrlParam || '';
    loader = 'vanilla';
    loaderVersion = '';
    onProgress = onProgressParam;
    source = sourceParam;
  }

  const currentSettings = loadLauncherSettings();
  const effectiveSource = source || currentSettings.downloadSource || 'bmclapi';

  try {
    // 阶段 1: 解析基础版本准确 URL 并拉取元数据
    onProgress?.({
      phase: 'details',
      currentStepText: `正在拉取 ${baseMcVersion} 基础版本元数据...`,
      progressPercent: 10,
      totalItems: 4,
      completedItems: 0,
    });

    const accurateUrl = await resolveAccurateVersionUrl(baseMcVersion, versionUrl, effectiveSource);
    const baseVersionDetail = await fetchVersionDetail(accurateUrl, effectiveSource);

    // 阶段 2: 写入基础客户端版本配置并下载 Client JAR
    onProgress?.({
      phase: 'client_jar',
      currentStepText: `正在下载 ${baseMcVersion} Client 核心 JAR...`,
      progressPercent: 35,
      totalItems: 4,
      completedItems: 1,
    });
    await installVersionJarAndJson(gameDir, baseMcVersion, baseVersionDetail, effectiveSource);

    // 阶段 3: 如果配置了 Mod 加载器 (Fabric / Quilt / NeoForge / Forge)
    if (loader && loader !== 'vanilla') {
      onProgress?.({
        phase: 'details',
        currentStepText: `正在拉取 ${loader} 加载器配置与依赖信息...`,
        progressPercent: 45,
        totalItems: 4,
        completedItems: 1,
      });

      const loaderProfile = await fetchLoaderProfile(baseMcVersion, loader, loaderVersion, effectiveSource);
      if (loaderProfile) {
        loaderProfile.id = versionId;
        loaderProfile.inheritsFrom = baseMcVersion;
        await installVersionJarAndJson(gameDir, versionId, loaderProfile, effectiveSource);

        // 分析并下载加载器专属依赖库
        onProgress?.({
          phase: 'libraries',
          currentStepText: `正在下载 ${loader} 加载器核心依赖库...`,
          progressPercent: 55,
          totalItems: 4,
          completedItems: 2,
        });
        const loaderPlan = await resolveVersionInstallPlan(gameDir, versionId, loaderProfile, effectiveSource);
        if (loaderPlan.missingLibraries.length > 0) {
          await downloadMissingLibraries(gameDir, loaderPlan.missingLibraries, effectiveSource);
        }
      }
    } else if (versionId !== baseMcVersion) {
      // 自定义命名的纯净原版副本，配置继承或复制
      const customVanillaJson = {
        ...baseVersionDetail,
        id: versionId,
        inheritsFrom: baseMcVersion,
      };
      await installVersionJarAndJson(gameDir, versionId, customVanillaJson, effectiveSource);
    }

    // 阶段 4: 评估基础依赖完整性并补充缺失依赖
    onProgress?.({
      phase: 'libraries',
      currentStepText: `正在分析跨平台依赖库 (Libraries)...`,
      progressPercent: 70,
      totalItems: 4,
      completedItems: 2,
    });
    const basePlan = await resolveVersionInstallPlan(gameDir, baseMcVersion, baseVersionDetail, effectiveSource);

    if (basePlan.missingLibraries.length > 0) {
      onProgress?.({
        phase: 'libraries',
        currentStepText: `正在下载缺失的基础依赖库 (${basePlan.missingLibraries.length} 项)...`,
        progressPercent: 80,
        totalItems: 4,
        completedItems: 2,
      });
      await downloadMissingLibraries(gameDir, basePlan.missingLibraries, effectiveSource);
    }

    // 阶段 5: 下载缺失 Assets 资源索引
    const assetId =
      (baseVersionDetail.assets as string) ||
      (baseVersionDetail.assetIndex as { id?: string })?.id ||
      'legacy';
    onProgress?.({
      phase: 'assets',
      currentStepText: `正在校验静态资源索引 (${assetId})...`,
      progressPercent: 90,
      totalItems: 4,
      completedItems: 3,
    });
    await downloadAssetObjects(gameDir, assetId, effectiveSource, 50);

    // 阶段 6: 完成安装
    onProgress?.({
      phase: 'completed',
      currentStepText: `${versionId} 版本安装完成！`,
      progressPercent: 100,
      totalItems: 4,
      completedItems: 4,
    });
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    onProgress?.({
      phase: 'error',
      currentStepText: `安装失败: ${errorMsg}`,
      progressPercent: 0,
      totalItems: 4,
      completedItems: 0,
      error: errorMsg,
    });
    return false;
  }
}
