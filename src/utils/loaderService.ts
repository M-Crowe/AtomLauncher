import type { DownloadSource, ModLoaderType } from '../types/downloader';

export interface LoaderInfo {
  type: ModLoaderType;
  name: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  supported: boolean;
  recommendedVersion: string;
  versions: string[];
}

export function getAvailableLoaders(mcVersion: string): LoaderInfo[] {
  // 简易版本大小比较
  const is120OrAbove = !mcVersion.startsWith('1.1') || mcVersion.startsWith('1.2');
  const is1202OrAbove = is120OrAbove && mcVersion !== '1.20' && mcVersion !== '1.20.1';

  return [
    {
      type: 'vanilla',
      name: '纯净原版',
      tagline: '官方原生客户端，无需加载器',
      badge: 'Vanilla',
      badgeColor: 'bg-grass-80 text-white',
      supported: true,
      recommendedVersion: '原生',
      versions: ['原生'],
    },
    {
      type: 'fabric',
      name: 'Fabric',
      tagline: '轻量高效，流行高版本模组生态',
      badge: 'Fabric',
      badgeColor: 'bg-amber-700 text-white',
      supported: true,
      recommendedVersion: '0.16.10 (推荐)',
      versions: ['0.16.10 (推荐)', '0.16.9', '0.16.7', '0.16.5'],
    },
    {
      type: 'neoforge',
      name: 'NeoForge',
      tagline: '1.20.2+ 现代模组加载器新标准',
      badge: 'NeoForge',
      badgeColor: 'bg-orange-600 text-white',
      supported: is1202OrAbove,
      recommendedVersion: '21.1.65 (最新)',
      versions: ['21.1.65 (最新)', '21.1.40', '21.0.167'],
    },
    {
      type: 'forge',
      name: 'Minecraft Forge',
      tagline: '成熟传统生态，大型模组包首选',
      badge: 'Forge',
      badgeColor: 'bg-stone-70 text-white',
      supported: true,
      recommendedVersion: '51.0.8 (稳定版)',
      versions: ['51.0.8 (稳定版)', '51.0.1', '50.1.0'],
    },
    {
      type: 'quilt',
      name: 'Quilt Loader',
      tagline: '兼容 Fabric 的社区现代化分支',
      badge: 'Quilt',
      badgeColor: 'bg-purple-700 text-white',
      supported: true,
      recommendedVersion: '0.27.1 (推荐)',
      versions: ['0.27.1 (推荐)', '0.26.0', '0.25.0'],
    },
  ];
}

export function getDefaultInstanceName(mcVersion: string, loader: ModLoaderType): string {
  const cleanVer = mcVersion.trim() || '1.21.1';
  switch (loader) {
    case 'fabric':
      return `${cleanVer}-Fabric`;
    case 'neoforge':
      return `${cleanVer}-NeoForge`;
    case 'forge':
      return `${cleanVer}-Forge`;
    case 'quilt':
      return `${cleanVer}-Quilt`;
    case 'vanilla':
    default:
      return cleanVer;
  }
}

export function validateInstanceName(
  name: string,
  installedVersions: Array<{ id: string }>
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: '请输入版本名称' };
  }

  // Windows / Linux 文件名非法字符
  // eslint-disable-next-line no-useless-escape
  const invalidCharsRegex = /[\\/:*?"<>|]/;
  if (invalidCharsRegex.test(trimmed)) {
    return { valid: false, error: '名称不能包含 \\ / : * ? " < > | 等非法字符' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: '版本名称长度不能超过 50 个字符' };
  }

  const isConflict = installedVersions.some(
    (v) => v.id.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (isConflict) {
    return { valid: false, error: '该版本名称已存在，请换一个名称' };
  }

  return { valid: true };
}

export async function fetchLoaderProfile(
  baseMcVersion: string,
  loader: ModLoaderType,
  loaderVersion: string,
  source: DownloadSource = 'bmclapi'
): Promise<Record<string, unknown> | null> {
  if (loader === 'vanilla') {
    return null;
  }

  const cleanLoaderVer = loaderVersion.replace(/\s*\(.*?\)/, '').trim();
  const lowerSource = (source || 'bmclapi').toLowerCase();

  if (loader === 'fabric') {
    const metaUrl =
      lowerSource === 'mojang' || lowerSource === 'official'
        ? `https://meta.fabricmc.net/v2/versions/loader/${baseMcVersion}/${cleanLoaderVer}/profile/json`
        : `https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/${baseMcVersion}/${cleanLoaderVer}/profile/json`;

    try {
      const resp = await fetch(metaUrl);
      if (resp.ok) {
        const json = await resp.json();
        return json;
      }
    } catch {
      // offline fallback
    }

    return {
      id: `fabric-loader-${cleanLoaderVer}-${baseMcVersion}`,
      inheritsFrom: baseMcVersion,
      releaseTime: new Date().toISOString(),
      time: new Date().toISOString(),
      type: 'release',
      mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
      arguments: {
        game: [],
        jvm: ['-DFabricMcEmu= net.minecraft.client.main.Main '],
      },
      libraries: [
        { name: `net.fabricmc:fabric-loader:${cleanLoaderVer}`, url: 'https://maven.fabricmc.net/' },
        { name: `net.fabricmc:intermediary:${baseMcVersion}`, url: 'https://maven.fabricmc.net/' },
        { name: 'net.fabricmc:sponge-mixin:0.15.4+mixin.0.8.7', url: 'https://maven.fabricmc.net/' },
        { name: 'org.ow2.asm:asm:9.7.1', url: 'https://maven.fabricmc.net/' },
        { name: 'org.ow2.asm:asm-analysis:9.7.1', url: 'https://maven.fabricmc.net/' },
        { name: 'org.ow2.asm:asm-commons:9.7.1', url: 'https://maven.fabricmc.net/' },
        { name: 'org.ow2.asm:asm-tree:9.7.1', url: 'https://maven.fabricmc.net/' },
        { name: 'org.ow2.asm:asm-util:9.7.1', url: 'https://maven.fabricmc.net/' },
      ],
    };
  }

  if (loader === 'quilt') {
    const metaUrl = `https://meta.quiltmc.org/v3/versions/loader/${baseMcVersion}/${cleanLoaderVer}/profile/json`;
    try {
      const resp = await fetch(metaUrl);
      if (resp.ok) {
        const json = await resp.json();
        return json;
      }
    } catch {
      // offline fallback
    }

    return {
      id: `quilt-loader-${cleanLoaderVer}-${baseMcVersion}`,
      inheritsFrom: baseMcVersion,
      type: 'release',
      mainClass: 'org.quiltmc.loader.impl.launch.knot.KnotClient',
      arguments: {
        game: [],
      },
      libraries: [
        { name: `org.quiltmc:quilt-loader:${cleanLoaderVer}`, url: 'https://maven.quiltmc.org/repository/release/' },
        { name: `net.fabricmc:intermediary:${baseMcVersion}`, url: 'https://maven.fabricmc.net/' },
        { name: 'net.fabricmc:sponge-mixin:0.15.4+mixin.0.8.7', url: 'https://maven.fabricmc.net/' },
        { name: 'org.ow2.asm:asm:9.7.1', url: 'https://maven.fabricmc.net/' },
      ],
    };
  }

  if (loader === 'neoforge') {
    return {
      id: `neoforge-${cleanLoaderVer}`,
      inheritsFrom: baseMcVersion,
      type: 'release',
      mainClass: 'cpw.mods.bootstraplauncher.BootstrapLauncher',
      arguments: {
        game: ['--fml.neoForgeVersion', cleanLoaderVer, '--fml.mcVersion', baseMcVersion],
      },
      libraries: [
        { name: `net.neoforged:neoforge:${cleanLoaderVer}`, url: 'https://maven.neoforged.net/releases/' },
      ],
    };
  }

  if (loader === 'forge') {
    return {
      id: `${baseMcVersion}-forge-${cleanLoaderVer}`,
      inheritsFrom: baseMcVersion,
      type: 'release',
      mainClass: 'cpw.mods.bootstraplauncher.BootstrapLauncher',
      arguments: {
        game: ['--fml.forgeVersion', cleanLoaderVer, '--fml.mcVersion', baseMcVersion],
      },
      libraries: [
        { name: `net.minecraftforge:forge:${baseMcVersion}-${cleanLoaderVer}`, url: 'https://maven.minecraftforge.net/' },
      ],
    };
  }

  return null;
}
