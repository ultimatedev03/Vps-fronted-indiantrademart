import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

const children = [];
let shuttingDown = false;

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

const resolveNpmExecPath = () => {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return process.env.npm_execpath;
  }

  if (!isWindows) return null;

  const bundledNpmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (existsSync(bundledNpmCli)) return bundledNpmCli;

  if (process.env.APPDATA) {
    const roamingNpmCli = path.join(
      process.env.APPDATA,
      "npm",
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js"
    );
    if (existsSync(roamingNpmCli)) return roamingNpmCli;
  }

  return null;
};

const npmExecPath = resolveNpmExecPath();

const parseBackendPort = (content = "") => {
  const match = String(content || "").match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
  return match?.[1] || "";
};

const readBackendPort = () => {
  const candidates = [
    path.resolve(process.cwd(), "../backend/.env.local"),
    path.resolve(process.cwd(), "../backend/.env"),
    path.resolve(process.cwd(), "backend/.env.local"),
    path.resolve(process.cwd(), "backend/.env"),
  ];

  for (const filePath of candidates) {
    try {
      if (!existsSync(filePath)) continue;
      const port = parseBackendPort(readFileSync(filePath, "utf8"));
      if (port) return port;
    } catch {
      // Ignore unreadable env files and continue with the next fallback.
    }
  }

  return "3001";
};

const defaultServerHealthUrl = `http://127.0.0.1:${readBackendPort()}/health`;
const SERVER_HEALTH_URL = process.env.DEV_SERVER_HEALTH_URL || defaultServerHealthUrl;
const SERVER_READY_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.DEV_SERVER_READY_TIMEOUT_MS || 30000)
);
const SERVER_READY_POLL_MS = Math.max(100, Number(process.env.DEV_SERVER_READY_POLL_MS || 500));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const killChildTree = (child) => {
  if (!child?.pid) return;

  try {
    if (isWindows) {
      // Windows does not reliably terminate npm child trees with child.kill().
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    }

    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  } catch {
    // Ignore process kill errors during shutdown.
  }
};

const spawnTask = (scriptName) => {
  const command = npmExecPath ? process.execPath : npmCommand;
  const args = npmExecPath ? [npmExecPath, "run", scriptName] : ["run", scriptName];

  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
    detached: !isWindows,
  });

  child.on("error", (error) => {
    console.error(`[devAll] Failed to start ${scriptName}:`, error?.message || error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.log(`[devAll] ${scriptName} exited with signal ${signal}`);
    } else if (code !== 0) {
      console.log(`[devAll] ${scriptName} exited with code ${code}`);
    }
    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
};

const waitForServer = async (url, timeoutMs, pollMs) => {
  const deadline = Date.now() + timeoutMs;

  while (!shuttingDown && Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) return true;
    } catch {
      // Keep polling until timeout.
    }

    await sleep(pollMs);
  }

  return false;
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    killChildTree(child);
  }

  setTimeout(() => process.exit(exitCode), 250);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const main = async () => {
  spawnTask("dev:server");

  const serverReady = await waitForServer(
    SERVER_HEALTH_URL,
    SERVER_READY_TIMEOUT_MS,
    SERVER_READY_POLL_MS
  );

  if (!serverReady) {
    console.error(
      `[devAll] Server was not reachable at ${SERVER_HEALTH_URL} within ${SERVER_READY_TIMEOUT_MS}ms.`
    );
    shutdown(1);
    return;
  }

  spawnTask("dev:client");
};

main().catch((error) => {
  console.error("[devAll] Startup failed:", error?.message || error);
  shutdown(1);
});
