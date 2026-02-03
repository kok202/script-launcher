import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
} from "electron";
import * as path from "path";
import * as vm from "vm";
import * as fs from "fs";
import { spawn } from "child_process";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isVisible = false;
let currentShortcut = "Alt+Space";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const userDataPath = app.getPath("userData");
const settingsPath = path.join(userDataPath, "settings.json");

// 아이콘 경로
function getIconPath(filename: string): string {
  if (isDev) {
    return path.join(__dirname, "../../public", filename);
  }
  return path.join(process.resourcesPath, filename);
}

interface AppSettings {
  shortcut: string;
  windowWidth: number;
  windowHeight: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  shortcut: "Alt+Space",
  windowWidth: 800,
  windowHeight: 450,
};

// 설정 로드
function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return DEFAULT_SETTINGS;
}

// 설정 저장
function saveSettings(settings: Partial<AppSettings>) {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

function createTrayIcon(): Electron.NativeImage {
  // macOS에서는 Template 이미지 사용 (자동으로 다크/라이트 모드 대응)
  // "Template" 이름이 포함된 PNG는 Electron이 자동으로 템플릿 이미지로 인식
  if (process.platform === "darwin") {
    const iconPath = getIconPath("tray-iconTemplate.png");
    try {
      const icon = nativeImage.createFromPath(iconPath);
      icon.setTemplateImage(true);
      return icon;
    } catch (e) {
      console.error("Failed to load tray icon:", e);
    }
  }

  // Windows/Linux: app-icon-128.png 사용하고 리사이즈
  const iconPath = getIconPath("app-icon-128.png");
  try {
    const icon = nativeImage.createFromPath(iconPath);
    return icon.resize({ width: 22, height: 22 });
  } catch (e) {
    console.error("Failed to load tray icon:", e);
  }

  // 폴백: 빈 이미지
  return nativeImage.createEmpty();
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("Script Launcher");

  updateTrayMenu();
  tray.on("click", () => toggleWindow());
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Toggle`,
      click: () => toggleWindow(),
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => openSettings(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createWindow() {
  const settings = loadSettings();

  // 앱 아이콘 설정
  const iconPath =
    process.platform === "darwin"
      ? getIconPath("app-mac-icon.icns")
      : getIconPath("app-window-icon.ico");

  mainWindow = new BrowserWindow({
    width: settings.windowWidth,
    height: settings.windowHeight,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Monaco Editor CDN 로드 허용
    },
  });

  if (process.platform === "darwin") {
    app.dock.hide();
  }

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("blur", () => {
    hideWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function openSettings() {
  // 메인 윈도우에서 settings 뷰로 전환
  if (mainWindow) {
    if (!isVisible) {
      showWindow();
    }
    mainWindow.webContents.send("toggle-settings");
  }
}

function toggleWindow() {
  if (isVisible) {
    hideWindow();
  } else {
    showWindow();
  }
}

function showWindow() {
  if (mainWindow) {
    // 마우스가 있는 모니터 찾기
    const cursorPoint = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width } = currentDisplay.workArea;

    // 해당 모니터의 상단 중앙에 위치
    const settings = loadSettings();
    const windowX = Math.floor(x + (width - settings.windowWidth) / 2);
    const windowY = y + 50;

    mainWindow.setPosition(windowX, windowY);
    mainWindow.show();
    mainWindow.focus();
    isVisible = true;
    mainWindow.webContents.send("window-shown");
  }
}

function hideWindow() {
  if (mainWindow && isVisible) {
    mainWindow.hide();
    isVisible = false;
    mainWindow.webContents.send("window-hidden");
  }
}

function registerGlobalShortcut(shortcut: string): boolean {
  globalShortcut.unregisterAll();

  try {
    const ret = globalShortcut.register(shortcut, () => {
      toggleWindow();
    });

    if (ret) {
      currentShortcut = shortcut;
      updateTrayMenu();
      return true;
    }
  } catch (e) {
    console.error("Failed to register shortcut:", e);
  }

  if (shortcut !== "Alt+Space") {
    globalShortcut.register("Alt+Space", () => {
      toggleWindow();
    });
    currentShortcut = "Alt+Space";
    updateTrayMenu();
  }

  return false;
}

// 동기식 쉘 명령 실행 (JavaScript 샌드박스용)
function execSync(command: string): string {
  const { execSync: nodeExecSync } = require("child_process");
  try {
    const result = nodeExecSync(command, {
      encoding: "utf-8",
      timeout: 30000,
      cwd: process.env.HOME || process.env.USERPROFILE,
    });
    return result.trim();
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stderr" in error) {
      throw new Error((error as { stderr: string }).stderr || String(error));
    }
    throw error;
  }
}

// JavaScript 스크립트 실행 (async/await 지원)
async function executeJavaScript(
  code: string,
  inputs: Record<string, string | number>
): Promise<{ logs: string[]; result: unknown; error?: string }> {
  const logs: string[] = [];

  const customConsole = {
    log: (...args: unknown[]) => {
      logs.push(
        args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(" ")
      );
    },
    error: (...args: unknown[]) => {
      logs.push(
        "[ERROR] " +
          args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg)
            )
            .join(" ")
      );
    },
    warn: (...args: unknown[]) => {
      logs.push(
        "[WARN] " +
          args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg)
            )
            .join(" ")
      );
    },
    info: (...args: unknown[]) => {
      logs.push(
        "[INFO] " +
          args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg)
            )
            .join(" ")
      );
    },
  };

  // exec 함수: 쉘 명령 실행 (동기)
  const exec = (command: string): string => {
    const result = execSync(command);
    if (result) {
      logs.push(result);
    }
    return result;
  };

  // fetch 함수: HTTP 요청 (비동기)
  const customFetch = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, options);
    return response;
  };

  // sleep 함수: 지연 (비동기)
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, Math.min(ms, 30000)));

  const sandbox = {
    console: customConsole,
    exec,
    fetch: customFetch,
    sleep,
    ...inputs,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Map,
    Set,
    Promise,
    setTimeout: (fn: () => void, ms: number) =>
      setTimeout(fn, Math.min(ms, 5000)),
    clearTimeout,
    setInterval: (fn: () => void, ms: number) =>
      setInterval(fn, Math.max(ms, 100)),
    clearInterval,
  };

  try {
    const context = vm.createContext(sandbox);

    // async IIFE로 감싸서 top-level await 지원
    const wrappedCode = `(async () => { ${code} })()`;
    const script = new vm.Script(wrappedCode);

    // Promise 실행 및 타임아웃 처리
    const resultPromise = script.runInContext(context);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Script execution timed out (10s)")),
        10000
      )
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);
    return { logs, result };
  } catch (error) {
    return {
      logs,
      result: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Python 스크립트 실행
function executePython(
  code: string,
  inputs: Record<string, string | number>
): Promise<{ logs: string[]; result: unknown; error?: string }> {
  return new Promise((resolve) => {
    const logs: string[] = [];

    // 입력값을 Python 변수로 변환
    let inputCode = "";
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === "string") {
        inputCode += `${key} = "${value.replace(/"/g, '\\"')}"\n`;
      } else {
        inputCode += `${key} = ${value}\n`;
      }
    }

    const fullCode = inputCode + code;

    const python = spawn("python3", ["-c", fullCode]);
    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (exitCode) => {
      if (stdout) {
        stdout
          .split("\n")
          .filter((line) => line)
          .forEach((line) => logs.push(line));
      }

      if (exitCode !== 0 || stderr) {
        resolve({
          logs,
          result: undefined,
          error: stderr || `Process exited with code ${exitCode}`,
        });
      } else {
        resolve({ logs, result: undefined });
      }
    });

    python.on("error", (err) => {
      resolve({
        logs,
        result: undefined,
        error: `Failed to execute Python: ${err.message}`,
      });
    });

    setTimeout(() => {
      python.kill();
      resolve({
        logs,
        result: undefined,
        error: "Script execution timed out (10s)",
      });
    }, 10000);
  });
}

// Shell 스크립트 실행
function executeShell(
  code: string,
  inputs: Record<string, string | number>
): Promise<{ logs: string[]; result: unknown; error?: string }> {
  return new Promise((resolve) => {
    const logs: string[] = [];

    // 입력값을 환경 변수로 설정
    const env = { ...process.env };
    for (const [key, value] of Object.entries(inputs)) {
      env[key] = String(value);
    }

    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
    const shellFlag = process.platform === "win32" ? "/c" : "-c";

    const child = spawn(shell, [shellFlag, code], {
      cwd: process.env.HOME || process.env.USERPROFILE,
      env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      if (stdout) {
        stdout
          .split("\n")
          .filter((line) => line)
          .forEach((line) => logs.push(line));
      }

      if (exitCode !== 0 || stderr) {
        if (stderr) {
          stderr
            .split("\n")
            .filter((line) => line)
            .forEach((line) => logs.push(`[ERROR] ${line}`));
        }
        resolve({
          logs,
          result: undefined,
          error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined,
        });
      } else {
        resolve({ logs, result: undefined });
      }
    });

    child.on("error", (err) => {
      resolve({
        logs,
        result: undefined,
        error: `Failed to execute shell: ${err.message}`,
      });
    });

    setTimeout(() => {
      child.kill();
      resolve({
        logs,
        result: undefined,
        error: "Script execution timed out (30s)",
      });
    }, 30000);
  });
}

// IPC 핸들러
ipcMain.handle(
  "execute-script",
  async (
    _event,
    code: string,
    inputs: Record<string, string | number>,
    language: string
  ) => {
    if (language === "python") {
      return executePython(code, inputs);
    }
    if (language === "shell") {
      return executeShell(code, inputs);
    }
    return executeJavaScript(code, inputs);
  }
);

ipcMain.handle("hide-window", () => {
  hideWindow();
});

ipcMain.handle("open-settings", () => {
  openSettings();
});

ipcMain.handle("get-settings", () => {
  return loadSettings();
});

ipcMain.handle(
  "save-settings",
  (
    _event,
    settings: { shortcut: string; windowWidth?: number; windowHeight?: number }
  ) => {
    const success = registerGlobalShortcut(settings.shortcut);
    if (success) {
      saveSettings(settings);

      // 윈도우 크기 변경
      if (mainWindow && (settings.windowWidth || settings.windowHeight)) {
        const currentSettings = loadSettings();
        mainWindow.setSize(
          currentSettings.windowWidth,
          currentSettings.windowHeight
        );
      }
    }
    return success;
  }
);

ipcMain.handle("get-current-shortcut", () => {
  return currentShortcut;
});

// 터미널 명령어 실행
ipcMain.handle("run-command", async (_event, command: string) => {
  return new Promise((resolve) => {
    const logs: string[] = [];

    // 쉘 명령어 실행
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
    const shellFlag = process.platform === "win32" ? "/c" : "-c";

    const child = spawn(shell, [shellFlag, command], {
      cwd: process.env.HOME || process.env.USERPROFILE,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      if (stdout) {
        stdout
          .split("\n")
          .filter((line) => line)
          .forEach((line) => logs.push(line));
      }

      if (exitCode !== 0 || stderr) {
        if (stderr) {
          stderr
            .split("\n")
            .filter((line) => line)
            .forEach((line) => logs.push(`[ERROR] ${line}`));
        }
        resolve({
          logs,
          result: undefined,
          error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined,
        });
      } else {
        resolve({ logs, result: undefined });
      }
    });

    child.on("error", (err) => {
      resolve({
        logs,
        result: undefined,
        error: `Failed to execute command: ${err.message}`,
      });
    });

    // 30초 타임아웃
    setTimeout(() => {
      child.kill();
      resolve({
        logs,
        result: undefined,
        error: "Command execution timed out (30s)",
      });
    }, 30000);
  });
});

// 앱 이벤트
app.whenReady().then(() => {
  const settings = loadSettings();
  currentShortcut = settings.shortcut;

  createWindow();
  createTray();
  registerGlobalShortcut(currentShortcut);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
