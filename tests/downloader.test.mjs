import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  transformDownloadUrl,
  fetchVersionManifest,
  fetchVersionDetail,
  resolveVersionInstallPlan,
  installVersionJarAndJson,
  downloadMissingLibraries,
  downloadAssetObjects,
  executeFullVersionInstall,
} from '../src/utils/downloadService.ts';
import { loadLauncherSettings } from '../src/utils/settingsStorage.ts';

test('Downloader R1. BMCLAPI and Domestic Mirror URL transformation rules', () => {
  // 1. Client JAR 转换
  const clientJarMojang = 'https://piston-data.mojang.com/v1/objects/8c31622329244038a8e100e478544e3922de1ff7/client.jar';
  const clientJarBmclapi = transformDownloadUrl(clientJarMojang, 'bmclapi');
  assert.equal(
    clientJarBmclapi,
    'https://bmclapi2.bangbang93.com/v1/objects/8c31622329244038a8e100e478544e3922de1ff7/client.jar',
    'Client JAR translates to BMCLAPI mirror'
  );

  // 2. Libraries 运行库转换 (转至 /maven)
  const libMojang = 'https://libraries.minecraft.net/com/mojang/authlib/5.0.47/authlib-5.0.47.jar';
  const libBmclapi = transformDownloadUrl(libMojang, 'bmclapi');
  assert.equal(
    libBmclapi,
    'https://bmclapi2.bangbang93.com/maven/com/mojang/authlib/5.0.47/authlib-5.0.47.jar',
    'Libraries translate to BMCLAPI /maven'
  );

  // 3. Asset Objects 资源对象转换 (转至 /assets)
  const assetMojang = 'https://resources.download.minecraft.net/52/52c5058fa1ef3d7632ce8e21703cf9fb399d8b85';
  const assetBmclapi = transformDownloadUrl(assetMojang, 'bmclapi');
  assert.equal(
    assetBmclapi,
    'https://bmclapi2.bangbang93.com/assets/52/52c5058fa1ef3d7632ce8e21703cf9fb399d8b85',
    'Asset objects translate to BMCLAPI /assets'
  );

  // 4. Version Manifest & Meta packages 转换
  const metaMojang = 'https://piston-meta.mojang.com/v1/packages/52c5058fa1ef3d7632ce8e21703cf9fb399d8b85/1.20.4.json';
  const metaBmclapi = transformDownloadUrl(metaMojang, 'bmclapi');
  assert.equal(
    metaBmclapi,
    'https://bmclapi2.bangbang93.com/v1/packages/52c5058fa1ef3d7632ce8e21703cf9fb399d8b85/1.20.4.json',
    'Version Meta translates to BMCLAPI mirror'
  );

  // 5. 第三方加载器 Maven 镜像转换 (Forge / Fabric / NeoForged)
  const forgeMaven = 'https://files.minecraftforge.net/maven/net/minecraftforge/forge/1.20.4/forge-1.20.4.jar';
  const fabricMaven = 'https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.16.0/fabric-loader-0.16.0.jar';
  assert.ok(transformDownloadUrl(forgeMaven, 'bmclapi').includes('https://bmclapi2.bangbang93.com/maven'));
  assert.ok(transformDownloadUrl(fabricMaven, 'bmclapi').includes('https://bmclapi2.bangbang93.com/maven'));

  // 6. 官方源保持原样不作篡改
  assert.equal(transformDownloadUrl(clientJarMojang, 'mojang'), clientJarMojang, 'Mojang source preserves exact URL');
  assert.equal(transformDownloadUrl(clientJarMojang, 'official'), clientJarMojang, 'Official alias preserves exact URL');
});

test('Downloader R1 & R2. Version Manifest and Detail Data Fetch Contracts', async () => {
  // 1. 获取版本清单测试 (默认使用设置中的下载源)
  const manifest = await fetchVersionManifest('bmclapi');
  assert.ok(manifest.latest, 'Manifest has latest versions block');
  assert.ok(manifest.latest.release, 'Manifest identifies latest release');
  assert.ok(manifest.latest.snapshot, 'Manifest identifies latest snapshot');
  assert.ok(Array.isArray(manifest.versions), 'Manifest versions is an array');
  assert.ok(manifest.versions.length >= 3, 'Manifest contains multiple versions');

  const v1204 = manifest.versions.find((v) => v.id === '1.20.4');
  assert.ok(v1204, 'Version 1.20.4 exists in manifest');
  assert.equal(v1204.type, 'release');
  assert.ok(v1204.url.includes('bmclapi'), 'BMCLAPI manifest provides converted URLs');

  // 2. 获取版本详情测试
  const detail = await fetchVersionDetail(v1204.url, 'bmclapi');
  assert.equal(detail.id, '1.20.4');
  assert.ok(detail.downloads && detail.downloads.client, 'Detail contains client downloads');
  assert.ok(detail.downloads.client.url.includes('bmclapi'), 'Client download URL points to mirror');
  assert.ok(Array.isArray(detail.libraries), 'Detail contains libraries array');
});

test('Downloader R2. Deep Integration with Core Integrity & Missing Models', async () => {
  const gameDir = 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft';
  const plan = await resolveVersionInstallPlan(gameDir, '1.20.4', undefined, 'bmclapi');

  // 验证返回类型复用 IntegrityReport 契约
  assert.equal(typeof plan.isComplete, 'boolean', 'IntegrityReport has isComplete');
  assert.equal(typeof plan.missingVersionJar, 'boolean', 'IntegrityReport has missingVersionJar');
  assert.equal(typeof plan.totalMissingCount, 'number', 'IntegrityReport has totalMissingCount');
  assert.ok(Array.isArray(plan.missingLibraries), 'IntegrityReport has missingLibraries');
  assert.ok(Array.isArray(plan.missingAssets), 'IntegrityReport has missingAssets');

  if (plan.missingLibraries.length > 0) {
    const lib = plan.missingLibraries[0];
    assert.ok(lib.name, 'Missing library has name');
    assert.ok(lib.path, 'Missing library has path');
    assert.ok(lib.url.includes('bmclapi'), 'Missing library URL uses mirror');
  }
});

test('Downloader R3. Full Installation Orchestration Flow with Step Progress', async () => {
  const gameDir = 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft';
  const steps = [];

  const success = await executeFullVersionInstall(
    gameDir,
    '1.20.4',
    'https://bmclapi2.bangbang93.com/v1/packages/1.20.4/1.20.4.json',
    (status) => {
      steps.push(status);
    },
    'bmclapi'
  );

  assert.equal(success, true, 'executeFullVersionInstall succeeds');
  assert.ok(steps.length >= 4, 'Emits progress for details, client_jar, libraries, assets, completed');
  const lastStep = steps[steps.length - 1];
  assert.equal(lastStep.phase, 'completed', 'Final phase is completed');
  assert.equal(lastStep.progressPercent, 100, 'Final progress reaches 100%');
});

test('Downloader R4. Rust Backend Downloader & Installer Core Engine Source Checks', () => {
  const downloaderRs = readFileSync(resolve('src-tauri/src/core/downloader.rs'), 'utf-8');
  assert.ok(downloaderRs.includes('pub fn transform_download_url'), 'Exports transform_download_url');
  assert.ok(downloaderRs.includes('pub fn compute_sha1'), 'Implements pure Rust SHA-1 compute_sha1');
  assert.ok(downloaderRs.includes('pub fn fetch_version_manifest'), 'Exports fetch_version_manifest command');
  assert.ok(downloaderRs.includes('pub fn fetch_version_detail'), 'Exports fetch_version_detail command');
  assert.ok(downloaderRs.includes('pub fn resolve_version_install_plan'), 'Exports resolve_version_install_plan command');
  assert.ok(downloaderRs.includes('pub fn install_version_jar_and_json'), 'Exports install_version_jar_and_json command');
  assert.ok(downloaderRs.includes('pub fn download_missing_libraries'), 'Exports download_missing_libraries command');
  assert.ok(downloaderRs.includes('pub fn download_asset_objects'), 'Exports download_asset_objects command');

  // 验证深度复用 core::types 与 core::resolver / core::rules
  assert.ok(downloaderRs.includes('use super::types::{IntegrityReport, LauncherFeatureFlags, MissingAssetInfo, MissingLibraryInfo}'), 'Reuses core::types integrity models');
  assert.ok(downloaderRs.includes('use super::resolver::{parse_maven_coordinate, parse_rules_from_json}'), 'Reuses core::resolver parsers');
  assert.ok(downloaderRs.includes('use super::rules::evaluate_rules'), 'Reuses core::rules cross-platform evaluator');

  // 验证 core.rs 重新导出
  const coreRs = readFileSync(resolve('src-tauri/src/core.rs'), 'utf-8');
  assert.ok(coreRs.includes('pub mod downloader;'), 'core.rs declares pub mod downloader');
  assert.ok(coreRs.includes('pub use downloader::*;'), 'core.rs re-exports downloader symbols');

  // 验证 lib.rs 注册 Tauri 命令
  const libRs = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf-8');
  assert.ok(libRs.includes('fetch_version_manifest'), 'lib.rs registers fetch_version_manifest');
  assert.ok(libRs.includes('fetch_version_detail'), 'lib.rs registers fetch_version_detail');
  assert.ok(libRs.includes('resolve_version_install_plan'), 'lib.rs registers resolve_version_install_plan');
  assert.ok(libRs.includes('install_version_jar_and_json'), 'lib.rs registers install_version_jar_and_json');
  assert.ok(libRs.includes('download_missing_libraries'), 'lib.rs registers download_missing_libraries');
  assert.ok(libRs.includes('download_asset_objects'), 'lib.rs registers download_asset_objects');
  assert.ok(libRs.includes('transform_mirror_url'), 'lib.rs registers transform_mirror_url');
});

test('Downloader R5. UI Contracts, Pixel Style, and Zero Emojis Specification', () => {
  const modalContent = readFileSync(resolve('src/components/VersionDownloadModal.tsx'), 'utf-8');

  // 1. 验证像素字体与无障碍对话框
  assert.ok(modalContent.includes('font-fusion'), 'Uses FusionPixel typography');
  assert.ok(modalContent.includes('role="dialog"'), 'Has accessible dialog role');
  assert.ok(modalContent.includes('aria-modal="true"'), 'Has aria-modal attribute');
  assert.ok(modalContent.includes('aria-label='), 'Has accessible dialog label');

  // 2. 验证与 settingsStorage downloadSource 绑定联动
  assert.ok(modalContent.includes('loadLauncherSettings'), 'Loads persistent settings');
  assert.ok(modalContent.includes('settings.downloadSource'), 'Reflects persistent download source');

  // 3. 严格禁止 Emoji 规范检验
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(modalContent), false, 'Strict Zero Emojis policy satisfied in VersionDownloadModal');

  // 4. 验证 App.tsx 与 SettingsView.tsx 的入口集成
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');
  assert.ok(appContent.includes('VersionDownloadModal'), 'App imports VersionDownloadModal');
  assert.ok(appContent.includes('data-testid="open-download-modal-button"'), 'App provides download button in instance list');

  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');
  assert.ok(settingsContent.includes('VersionDownloadModal'), 'SettingsView imports VersionDownloadModal');
  assert.ok(settingsContent.includes('data-testid="settings-open-downloader-button"'), 'SettingsView provides entry to version downloader');
});

test('Downloader R6. MCBBS Mirror URL transformation and Java inference contracts', async () => {
  // 1. MCBBS 镜像 URL 转换
  const clientMojang = 'https://piston-data.mojang.com/v1/objects/8c31622329244038a8e100e478544e3922de1ff7/client.jar';
  const clientMcbbs = transformDownloadUrl(clientMojang, 'mcbbs');
  assert.equal(
    clientMcbbs,
    'https://download.mcbbs.net/v1/objects/8c31622329244038a8e100e478544e3922de1ff7/client.jar',
    'Client JAR translates to MCBBS mirror'
  );

  const libMojang = 'https://libraries.minecraft.net/com/mojang/authlib/5.0.47/authlib-5.0.47.jar';
  const libMcbbs = transformDownloadUrl(libMojang, 'mcbbs');
  assert.equal(
    libMcbbs,
    'https://download.mcbbs.net/maven/com/mojang/authlib/5.0.47/authlib-5.0.47.jar',
    'Libraries translate to MCBBS /maven'
  );

  // 2. Java 版本需求推断集成
  const { inferVersionJava } = await import('../src/utils/downloadService.ts');
  assert.equal(await inferVersionJava('26.3-snapshot'), 25, '26.x requires Java 25');
  assert.equal(await inferVersionJava('1.21.1'), 21, '1.21.1 requires Java 21');
  assert.equal(await inferVersionJava('1.20.4'), 17, '1.20.4 requires Java 17');
  assert.equal(await inferVersionJava('1.16.5'), 8, '1.16.5 requires Java 8');
});

test('Downloader R7. Empty State Download Entry and Modal Keyboard Safety', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');
  assert.ok(
    appContent.includes('data-testid="empty-download-button"'),
    'App provides download button in empty versions list state'
  );

  const modalContent = readFileSync(resolve('src/components/VersionDownloadModal.tsx'), 'utf-8');
  assert.ok(
    modalContent.includes('data-testid="close-download-modal-button"'),
    'VersionDownloadModal provides data-testid for close button'
  );
  assert.ok(
    modalContent.includes("e.key === 'Escape'"),
    'VersionDownloadModal handles Escape key to dismiss dialog'
  );
  assert.ok(
    modalContent.includes('inferVersionJava'),
    'VersionDownloadModal integrates inferVersionJava for smart Java runtime recommendation'
  );

  const downloaderRs = readFileSync(resolve('src-tauri/src/core/downloader.rs'), 'utf-8');
  assert.ok(
    downloaderRs.includes('infer_java_major_version'),
    'downloader.rs reuses infer_java_major_version'
  );
  assert.ok(
    downloaderRs.includes('pub fn infer_version_java'),
    'downloader.rs exports infer_version_java command'
  );

  const libRs = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf-8');
  assert.ok(
    libRs.includes('infer_version_java'),
    'lib.rs registers infer_version_java in invoke_handler'
  );
});

