const electronAPI = (globalThis as any).electronAPI as
  | {
      setMode: (mode: "locked" | "unlocked") => void;
      quit: () => void;
      shutdown: () => Promise<void> | void;
      screenshot: () => Promise<string>;
      setTrayTitle: (title: string) => Promise<boolean>;
      onDeviceLock: (callback: () => void) => () => void;
      onTrayClick: (callback: () => void) => () => void;
    }
  | undefined;

export const desktop = {
  setMode: (mode: "locked" | "unlocked") => {
    if (!electronAPI) {
      return;
    }
    electronAPI.setMode(mode);
  },
  quit: () => {
    if (!electronAPI) {
      return;
    }
    electronAPI.quit();
  },
  shutdown: async () => {
    if (!electronAPI) {
      throw new Error("Desktop API not available");
    }
    await electronAPI.shutdown();
  },
  screenshot: () => {
    if (!electronAPI) {
      throw new Error("Desktop API not available");
    }
    return electronAPI.screenshot();
  },
  setTrayTitle: (title: string) => {
    if (!electronAPI) {
      return Promise.resolve(false);
    }
    return electronAPI.setTrayTitle(title);
  },
  onDeviceLock: (callback: () => void): (() => void) => {
    if (!electronAPI) {
      return () => {};
    }
    return electronAPI.onDeviceLock(callback);
  },
  onTrayClick: (callback: () => void): (() => void) => {
    if (!electronAPI) {
      return () => {};
    }
    return electronAPI.onTrayClick(callback);
  },
};
