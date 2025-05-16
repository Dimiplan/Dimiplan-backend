/**
 * AdminJS Component Bundler Script
 *
 * This script bundles the AdminJS React components for production use.
 * Run this script before deploying to production with: npm run admin:bundle
 */
const { bundle } = require("@adminjs/bundler");
const path = require("path");
const fs = require("fs");

// Output directory for bundled components
const outDir = path.join(__dirname, "../admin/.adminjs");

// Ensure the output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const bundleComponents = async () => {
  console.log("Starting AdminJS component bundling...");

  try {
    // Bundle Dashboard component
    await bundle({
      componentEntryPath: path.join(
        __dirname,
        "../admin/components/dashboard.jsx",
      ),
      destinationDir: outDir,
      watch: process.env.NODE_ENV === "development",
    });

    // Bundle LogViewer component
    await bundle({
      componentEntryPath: path.join(
        __dirname,
        "../admin/components/logViewer.jsx",
      ),
      destinationDir: outDir,
      watch: process.env.NODE_ENV === "development",
    });

    console.log("AdminJS components bundled successfully");
  } catch (error) {
    console.error("Error bundling AdminJS components:", error);
    process.exit(1);
  }
};

bundleComponents();
