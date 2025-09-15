import * as esbuild from "esbuild";
import * as path from "path";
import * as fs from "fs";
import { commonjs } from "@hyrious/esbuild-plugin-commonjs";

async function buildElectronFiles() {
  try {
    // Ensure the output directory exists
    const outputDir = path.resolve("electron/inputs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build the main.ts file
    const mainResult = await esbuild.build({
      entryPoints: [path.resolve("electron_backend/src/main.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.resolve("electron/inputs/main.mjs"),
      external: ["electron"],
      sourcemap: true,
      plugins: [commonjs()],
    });

    if (mainResult.errors.length > 0) {
      console.error("Main build failed:", mainResult.errors);
      process.exit(1);
    }

    console.log(
      "Successfully built electron_backend/src/main.ts to electron/inputs/main.mjs"
    );

    // Build the preload.ts file
    const preloadResult = await esbuild.build({
      entryPoints: [path.resolve("electron_preload/src/main.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: path.resolve("electron/inputs/preload.js"),
      external: ["electron"],
      sourcemap: true,
    });

    if (preloadResult.errors.length > 0) {
      console.error("Preload build failed:", preloadResult.errors);
      process.exit(1);
    }

    console.log(
      "Successfully built electron_preload/src/main.ts to electron/inputs/preload.js"
    );
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

buildElectronFiles();
