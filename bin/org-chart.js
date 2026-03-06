#!/usr/bin/env node

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const autoloadPath = resolve(rootDir, 'public', '_autoload.yaml');

// --- Argument parsing ---
const args = process.argv.slice(2);
let filePath = null;
let yamlContent = null;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--file' || args[i] === '-f') && args[i + 1]) {
    filePath = args[++i];
  } else if ((args[i] === '--yaml' || args[i] === '-y') && args[i + 1]) {
    yamlContent = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Organization Chart Viewer

Usage: org-chart [options]

Options:
  -f, --file <path>    Path to a YAML/JSON manifest file
  -y, --yaml <string>  Inline YAML manifest content
  -h, --help           Show this help message

Examples:
  org-chart --file ./my-org.yaml
  org-chart --yaml "name: My Org"
  org-chart                          (opens the upload UI)
`);
    process.exit(0);
  }
}

// --- Read manifest from file ---
if (filePath) {
  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }
  yamlContent = readFileSync(resolvedPath, 'utf-8');
}

// --- Install dependencies if needed ---
const nodeModulesPath = resolve(rootDir, 'node_modules');
if (!existsSync(nodeModulesPath)) {
  console.log('Installing dependencies...');
  execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
}

// Remove stale autoload data from a previous unclean exit.
if (existsSync(autoloadPath)) {
  try {
    unlinkSync(autoloadPath);
  } catch {
    // Ignore startup cleanup errors
  }
}

// --- Write autoload manifest if provided ---
if (yamlContent) {
  writeFileSync(autoloadPath, yamlContent, 'utf-8');
  console.log('Manifest loaded — starting viewer...');
}

// --- Cleanup on exit ---
function cleanup() {
  try {
    if (existsSync(autoloadPath)) {
      unlinkSync(autoloadPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// --- Start Vite dev server ---
const env = { ...process.env };
if (yamlContent) {
  env.VITE_AUTOLOAD = 'true';
}

const isWindows = process.platform === 'win32';
const viteBin = resolve(rootDir, 'node_modules', '.bin', isWindows ? 'vite.cmd' : 'vite');

const vite = spawn(viteBin, ['--open'], {
  cwd: rootDir,
  stdio: 'inherit',
  env,
  shell: isWindows,
});

vite.on('close', (code) => {
  cleanup();
  process.exit(code ?? 0);
});
