import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
  systemPreferences,
  powerMonitor,
  Tray,
  nativeImage,
} from "electron";
import { execa } from "execa";
import { log } from "./logger.js";
import * as path from "path";
import * as fs from "fs";

export const setup = (
  mainWindow: <T = BrowserWindow>(
    notFound?: () => BrowserWindow | T
  ) => BrowserWindow | T
) => {
  let mode = "unset" as "locked" | "unlocked" | "unset";
  let tray: Tray | null = null;

  let focusIval = null as NodeJS.Timeout | null;

  // Set up power monitor events to trigger device lock
  powerMonitor.on("suspend", () => {
    log("power:suspend");
    mainWindow().webContents.send("device-lock");
  });

  powerMonitor.on("shutdown", () => {
    log("power:shutdown");
    mainWindow().webContents.send("device-lock");
  });

  powerMonitor.on("lock-screen", () => {
    log("power:lock-screen");
    mainWindow().webContents.send("device-lock");
  });

  powerMonitor.on("user-did-resign-active", () => {
    log("power:user-did-resign-active");
    mainWindow().webContents.send("device-lock");
  });

  // Initialize tray
  const createTray = () => {
    log("tray:create");
    tray = new Tray(nativeImage.createEmpty());
    tray.setTitle("Reft", {
      fontType: "monospacedDigit",
    }); // Default title

    // Click handler
    tray.on("click", () => {
      mainWindow().webContents.send("tray-click");
    });

    return tray;
  };

  let setModeCalls = 0;

  const setMode = async (newMode: "locked" | "unlocked") => {
    log("setMode:enter", { from: mode, to: newMode });
    if (mode === newMode) {
      log("setMode:noop");
      return;
    }

    const currentSetModeCall = ++setModeCalls;
    while (mainWindow(() => null) == null) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (currentSetModeCall !== setModeCalls) {
        log("setMode:stale");
        return;
      }
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    if (newMode === "locked") {
      log("mode:locked:configure");
      mainWindow().setAlwaysOnTop(true, "screen-saver", 100);
      mainWindow().setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
      mainWindow().setFullScreenable(false);
      mainWindow().setResizable(false);
      mainWindow().setMovable(false);
      mainWindow().show();
      log("mode:locked:show");
      // ensure we're treated as an accessory app and hidden from the Dock
      app.dock?.hide();
      app.setActivationPolicy("accessory");
      // after showing, force activation so the window becomes visible on boot
      setImmediate(() => {
        try {
          // steal focus if we're launched at login and not activated yet (macOS)
          // @ts-ignore Electron types allow an options object on macOS
          app.focus?.({ steal: true });
        } catch {}
      });

      mainWindow().setBounds({
        x: -1,
        y: -1,
        width: width + 2,
        height: height + 2,
      });

      if (focusIval) {
        clearInterval(focusIval);
      }

      focusIval = setInterval(() => {
        const focused = mainWindow().isFocused();
        const visible = mainWindow().isVisible();
        if (!focused || !visible) {
          log("mode:locked:ensure-focus", { focused, visible });
          mainWindow().show();
          mainWindow().focus();
        }
      }, 500);
    }

    if (newMode === "unlocked") {
      log("mode:unlocked:configure");
      mainWindow().setAlwaysOnTop(false);
      mainWindow().setVisibleOnAllWorkspaces(false);
      mainWindow().setFullScreenable(true);
      mainWindow().setResizable(true);
      mainWindow().setMovable(true);
      mainWindow().hide();
      log("mode:unlocked:hide");

      mainWindow().setBounds({
        x: width * 0.25,
        y: height * 0.25,
        width: width * 0.5,
        height: height * 0.5,
      });

      if (focusIval) {
        clearInterval(focusIval);
      }
    }

    mode = newMode;
  };

  app.on("ready", () => {
    log("app:ready:api");
    if (mode === "unset") {
      setMode("locked");
    }
  });

  ipcMain.handle("set-mode", async (_, newMode: "locked" | "unlocked") => {
    log("ipc:set-mode", newMode);
    setMode(newMode);
    return true;
  });

  ipcMain.handle("quit", async () => {
    log("ipc:quit");
    app.exit();
    return true;
  });

  ipcMain.handle("shutdown", async () => {
    log("ipc:shutdown");
    try {
      // user added this command as a nopasswd command
      execa("sudo", ["/sbin/shutdown", "-h", "+1"], {
        detached: true,
        stdio: "ignore",
      });

      execa("open", ["-a", "/Applications/ShutterDowner.app"], {
        detached: true,
        stdio: "ignore",
      });

      app.exit();
    } catch (e) {
      log("shutdown:error", e);
    }
    return true;
  });

  // Add new handlers for tray functionality
  ipcMain.handle("set-tray-title", async (_, title: string) => {
    if (tray) {
      tray.setTitle(title, {
        fontType: "monospacedDigit",
      });
      log("tray:title", title);
      return true;
    }
    return false;
  });

  const appDataPath = app.getPath("userData");
  const notepadPath = path.join(appDataPath, "reftpad.txt");

  const getNotepadContent = async () => {
    if (fs.existsSync(notepadPath)) {
      return fs.readFileSync(notepadPath, "utf8");
    } else {
      return "Welcome to your notepad!";
    }
  };

  ipcMain.handle("get-notepad-content", async () => {
    try {
      return await getNotepadContent();
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return await getNotepadContent();
    }
  });

  ipcMain.handle("set-notepad-content", async (_, content: string) => {
    fs.writeFileSync(notepadPath, content);
  });

  return () => {
    log("api:init-return:createTray");
    createTray();
  };
};
