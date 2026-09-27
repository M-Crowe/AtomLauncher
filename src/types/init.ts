export interface LauncherInitState {
  initialized: boolean;
  atom_dir: string;
  default_atom_dir: string;
  default_minecraft_dir: string;
  config: Record<string, unknown> | null;
}

export interface LauncherInitConfig {
  atom_dir?: string | null;
  game_dir: string;
  selected_java_id?: string | null;
  java_path?: string | null;
  custom_java_path?: string | null;
  offline_username?: string | null;
  memory_mb?: number | null;
}
