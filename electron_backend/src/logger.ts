import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

let logFilePath: string | null = null;

export const initLogger = () => {
  try {
    const userData = app.getPath("userData");
    const logsDir = path.join(userData, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    logFilePath = path.join(logsDir, "reft.log");
    // rotate if > 5MB
    try {
      const stat = fs.statSync(logFilePath);
      if (stat.size > 5 * 1024 * 1024) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        fs.renameSync(logFilePath, path.join(logsDir, `reft-${ts}.log`));
      }
    } catch {}
  } catch {}
};

export const log = (...args: any[]) => {
  try {
    if (!logFilePath) initLogger();
    const ts = new Date().toISOString();
    const line = `${ts} ${args
      .map((a) => {
        try {
          if (typeof a === "string") return a;
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ")}`;
    fs.appendFileSync(logFilePath!, line + "\n");
  } catch {}
};

export const attachProcessLogging = () => {
  process.on("uncaughtException", (e) =>
    log("uncaughtException", e?.stack || e)
  );
  process.on("unhandledRejection", (e) => log("unhandledRejection", e));
};
