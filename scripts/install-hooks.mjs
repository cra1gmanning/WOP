#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";

try {
  execSync("git rev-parse --git-dir", { stdio: "ignore" });
  execSync("git config core.hooksPath .githooks");
  fs.chmodSync(".githooks/pre-commit", 0o755);
} catch {
  process.exit(0);
}
