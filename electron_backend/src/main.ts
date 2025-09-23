import { app, BrowserWindow, screen } from "electron";
import * as path from "path";
import { setup } from "./api.js";
import serve from "electron-serve";

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

app.dock?.hide();

function createWindow() {
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

  setupWindow();
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
