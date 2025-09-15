const { contextBridge, ipcRenderer } = require("electron");

console.log("preload setting up");

contextBridge.exposeInMainWorld("electronAPI", {
  setMode: (mode: "locked" | "unlocked") =>
    ipcRenderer.invoke("set-mode", mode),
  quit: () => ipcRenderer.invoke("quit"),
  shutdown: () => ipcRenderer.invoke("shutdown"),
  setTrayTitle: (title: string) => ipcRenderer.invoke("set-tray-title", title),
  onDeviceLock: (callback: () => void) => {
    // Create a handler function that we can reference later for removal
    const deviceLockHandler = () => callback();

    // Register the event listener
    ipcRenderer.on("device-lock", deviceLockHandler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener("device-lock", deviceLockHandler);
    };
  },
  onTrayClick: (callback: () => void) => {
    const trayClickHandler = () => callback();

    ipcRenderer.on("tray-click", trayClickHandler);

    return () => {
      ipcRenderer.removeListener("tray-click", trayClickHandler);
    };
  },
});
