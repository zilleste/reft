import { app, BrowserWindow, screen } from "electron";
import * as path from "path";
import { setup } from "./api.js";
import serve from "electron-serve";
import { attachProcessLogging, initLogger, log } from "./logger.js";

const isDev = process.argv.includes("--dev");

if (!isDev) {
  serve({
    directory: path.join(app.getAppPath(), "web"),
  });
}

app.setPath(
  "userData",
  path.join(app.getPath("userData"), isDev ? "dev" : "prod")
);

// initialize logging asap
try {
  initLogger();
  attachProcessLogging();
  log("proc:start", {
    isDev,
    argv: process.argv,
    pid: process.pid,
    versions: process.versions,
  });
  try {
    const lis = (app as any).getLoginItemSettings?.();
    if (lis) log("loginItemSettings", lis);
  } catch {}
} catch {}

let mainWindow = null as BrowserWindow | null;

const getMainWindow = <T = BrowserWindow>(
  notFound: () => T = () => {
    throw new Error("Main window not found");
  }
): BrowserWindow | T => {
  if (!mainWindow) {
    return notFound();
  }
  return mainWindow;
};

const setupWindow = setup(getMainWindow);

try {
  app.dock?.hide();
} catch {}

// ensure single instance and log second launches
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log("singleInstance:quit");
  app.quit();
}
app.on("second-instance", (_e, argv, cwd) => {
  log("app:second-instance", { argv, cwd });
  try {
    const w = getMainWindow(() => null as any) as BrowserWindow | null;
    if (w) {
      if (!w.isVisible()) w.show();
      w.focus();
    }
  } catch {}
});

app.on("will-finish-launching", () => log("app:will-finish-launching"));

function createWindow() {
  log("createWindow:begin");
  const primaryDisplay = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    width: primaryDisplay.bounds.width,
    height: primaryDisplay.bounds.height,
    x: 0,
    y: 0,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
    frame: false,
    roundedCorners: false,
  });

  mainWindow.on("ready-to-show", () => {
    log("mainWindow:ready-to-show");
  });
  mainWindow.on("show", () => log("mainWindow:show"));
  mainWindow.on("hide", () => log("mainWindow:hide"));
  mainWindow.on("focus", () => log("mainWindow:focus"));
  mainWindow.on("blur", () => log("mainWindow:blur"));
  mainWindow.webContents.on("did-finish-load", () =>
    log("webContents:did-finish-load")
  );
  mainWindow.webContents.on("did-fail-load", (_e, ec, ed) =>
    log("webContents:did-fail-load", { ec, ed })
  );
  mainWindow.webContents.on("render-process-gone", (_e, details) =>
    log("webContents:render-process-gone", details)
  );

  if (isDev) {
    const loadDevServer = () => {
      mainWindow!.loadURL("https://localhost:18653").catch(() => {
        setTimeout(loadDevServer, 100);
      });
    };

    loadDevServer();

    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.setClosable(false);
    mainWindow.loadURL("app://-");
  }

  mainWindow.show();
  try {
    // force activation when launching at login; if it fails, log the state
    app.focus?.({ steal: true });
    try {
      const lis = (app as any).getLoginItemSettings?.();
      const shouldFlip =
        process.env.REFT_POLICY_FLIP === "1" &&
        (lis?.wasOpenedAtLogin || lis?.wasOpenedAsHidden || lis?.restoreState);
      if (shouldFlip) {
        log("login-launch:regularize-then-accessory");
        app.setActivationPolicy?.("regular");
        setTimeout(() => {
          app.setActivationPolicy?.("accessory");
          app.dock?.hide();
        }, 500);
      } else {
        log("login-launch:no-flip");
      }
    } catch {}
  } catch {}

  setupWindow();
  log("createWindow:end");
}

app.whenReady().then(() => {
  log("app:whenReady");
  createWindow();

  app.on("activate", () => {
    log("app:activate");
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  log("app:window-all-closed");
  if (process.platform !== "darwin") app.quit();
});
