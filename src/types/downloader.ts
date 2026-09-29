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

export type { IntegrityReport, MissingLibraryInfo, MissingAssetInfo, DownloadSource };
