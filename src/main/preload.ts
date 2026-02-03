import { contextBridge, ipcRenderer } from 'electron';

export interface ScriptResult {
  logs: string[];
  result: unknown;
  error?: string;
}

export interface AppSettings {
  shortcut: string;
  windowWidth?: number;
  windowHeight?: number;
}

export interface ElectronAPI {
  executeScript: (code: string, inputs: Record<string, string | number>, language: string) => Promise<ScriptResult>;
  runCommand: (command: string) => Promise<ScriptResult>;
  hideWindow: () => Promise<void>;
  openSettings: () => Promise<void>;
  onWindowShown: (callback: () => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  onToggleSettings: (callback: () => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  getCurrentShortcut: () => Promise<string>;
}

const electronAPI: ElectronAPI = {
  executeScript: (code: string, inputs: Record<string, string | number>, language: string) => {
    return ipcRenderer.invoke('execute-script', code, inputs, language);
  },
  runCommand: (command: string) => {
    return ipcRenderer.invoke('run-command', command);
  },
  hideWindow: () => {
    return ipcRenderer.invoke('hide-window');
  },
  openSettings: () => {
    return ipcRenderer.invoke('open-settings');
  },
  onWindowShown: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('window-shown', handler);
    return () => ipcRenderer.removeListener('window-shown', handler);
  },
  onWindowHidden: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('window-hidden', handler);
    return () => ipcRenderer.removeListener('window-hidden', handler);
  },
  onToggleSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-settings', handler);
    return () => ipcRenderer.removeListener('toggle-settings', handler);
  },
  getSettings: () => {
    return ipcRenderer.invoke('get-settings');
  },
  saveSettings: (settings: AppSettings) => {
    return ipcRenderer.invoke('save-settings', settings);
  },
  getCurrentShortcut: () => {
    return ipcRenderer.invoke('get-current-shortcut');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
