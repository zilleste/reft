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

app.setActivationPolicy("accessory");

export const setup = (mainWindow: () => BrowserWindow) => {
  let mode = "unset" as "locked" | "unlocked" | "unset";
  let tray: Tray | null = null;

  let focusIval = null as NodeJS.Timeout | null;

  // Set up power monitor events to trigger device lock
  powerMonitor.on("suspend", () => {
    mainWindow().webContents.send("device-lock");
  });

  powerMonitor.on("shutdown", () => {
    mainWindow().webContents.send("device-lock");
  });

  powerMonitor.on("lock-screen", () => {
    mainWindow().webContents.send("device-lock");
  });

  powerMonitor.on("user-did-resign-active", () => {
    mainWindow().webContents.send("device-lock");
  });

  // Initialize tray
  const createTray = () => {
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

  const setMode = (newMode: "locked" | "unlocked") => {
    if (mode === newMode) {
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    if (newMode === "locked") {
      mainWindow().setAlwaysOnTop(true, "screen-saver", 100);
      mainWindow().setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true,
      });
      mainWindow().setFullScreenable(false);
      mainWindow().setResizable(false);
      mainWindow().setMovable(false);
      mainWindow().show();

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
        if (!mainWindow().isFocused() || !mainWindow().isVisible()) {
          mainWindow().show();
          mainWindow().focus();
        }
      }, 500);
    }

    if (newMode === "unlocked") {
      mainWindow().setAlwaysOnTop(false);
      mainWindow().setVisibleOnAllWorkspaces(false);
      mainWindow().setFullScreenable(true);
      mainWindow().setResizable(true);
      mainWindow().setMovable(true);
      mainWindow().hide();

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

  ipcMain.handle("set-mode", async (_, newMode: "locked" | "unlocked") => {
    setMode(newMode);
    return true;
  });

  ipcMain.handle("quit", async () => {
    app.exit();
    return true;
  });

  ipcMain.handle("shutdown", async () => {
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
      console.error("Shutdown sequence error:", e);
    }
    return true;
  });

  // Add new handlers for tray functionality
  ipcMain.handle("set-tray-title", async (_, title: string) => {
    if (tray) {
      tray.setTitle(title, {
        fontType: "monospacedDigit",
      });
      return true;
    }
    return false;
  });

  return () => {
    createTray();
  };
};
