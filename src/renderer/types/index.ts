export interface ScriptInput {
  name: string;
  type: 'string' | 'number';
  label: string;
  defaultValue?: string | number;
}

export type ScriptLanguage = 'javascript' | 'python' | 'shell';

export interface Script {
  id: string;
  name: string;
  code: string;
  language: ScriptLanguage;
  inputs: ScriptInput[];
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface ScriptResult {
  logs: string[];
  result: unknown;
  error?: string;
}

export interface AppState {
  scripts: Script[];
  folders: Folder[];
  scriptFolderMap: Record<string, string | null>;
}

export type ViewMode = 'list' | 'edit' | 'input' | 'result' | 'preview' | 'settings';

export interface NavigationItem {
  type: 'folder' | 'script';
  id: string;
  name: string;
}

// ElectronAPI types
export interface AppSettings {
  shortcut: string;
}

export interface ElectronAPI {
  executeScript: (code: string, inputs: Record<string, string | number>, language: string) => Promise<ScriptResult>;
  runCommand: (command: string) => Promise<ScriptResult>;
  hideWindow: () => Promise<void>;
  onWindowShown: (callback: () => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  getCurrentShortcut: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
