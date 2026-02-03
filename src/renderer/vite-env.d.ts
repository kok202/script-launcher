/// <reference types="vite/client" />

interface ScriptResult {
  logs: string[];
  result: unknown;
  error?: string;
}

interface AppSettings {
  shortcut: string;
}

interface ElectronAPI {
  executeScript: (code: string, inputs: Record<string, string | number>, language: string) => Promise<ScriptResult>;
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

export {};
