import type { IntegrityReport, MissingLibraryInfo, MissingAssetInfo } from './launcher';
import type { DownloadSource } from './settings';

export interface ManifestVersionEntry {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel?: number;
}

export interface LatestManifestVersions {
  release: string;
  snapshot: string;
}

export interface VersionManifest {
  latest: LatestManifestVersions;
  versions: ManifestVersionEntry[];
}

export type InstallProgressPhase =
  | 'idle'
  | 'manifest'
  | 'details'
  | 'client_jar'
  | 'libraries'
  | 'assets'
  | 'completed'
  | 'error';

export interface VersionInstallStatus {
  phase: InstallProgressPhase;
  currentStepText: string;
  progressPercent: number;
  totalItems: number;
  completedItems: number;
  error?: string;
}

export interface DownloadFileItem {
  id: string;
  name: string;
  path: string;
  type: 'jar' | 'json' | 'library' | 'asset';
  size: number;
  downloaded: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  speed?: string;
  error?: string;
}

export type DownloadCategoryFilter = 'all' | 'release' | 'snapshot' | 'historical';

export interface DownloadTaskState {
  versionId: string;
  versionType?: string;
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
  phase: InstallProgressPhase;
  currentStepText: string;
  progressPercent: number;
  speedMBs: number;
  downloadedBytes: number;
  totalBytes: number;
  completedFiles: number;
  totalFiles: number;
  error?: string;
  files: DownloadFileItem[];
  createdAt?: number;
}

export type { IntegrityReport, MissingLibraryInfo, MissingAssetInfo, DownloadSource };
