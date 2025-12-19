#!/usr/bin/env node
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ensureUtilsScaffold, runInteractiveCommand } from './utils/utils.js';
const cliArgs = process.argv.slice(2);
const options = {
    force: cliArgs.includes('--force'),
    skipReadme: cliArgs.includes('--skip-readme')
};
const spinFrames = [...'⣾⣽⣻⢿⡿⣟⣯⣷'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function loadPackageMetadata() {
    const pkgPath = path.join(".", "package.json");
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    const name = pkg.name ?? 'my-package';
    const version = pkg.version ?? '0.1.0';
    const description = pkg.description ?? 'Describe your package here.';
    const author = typeof pkg.author === 'string'
        ? pkg.author
        : pkg.author?.name ?? 'Your Name';
    const license = pkg.license ?? 'MIT';
    const cliCommand = resolveCliCommand(pkg.bin, name);
    return { name, version, description, author, license, cliCommand };
}
function resolveCliCommand(bin, fallback) {
    if (!bin) {
        return fallback;
    }
    if (typeof bin === 'string') {
        return fallback;
    }
    const [firstEntry] = Object.keys(bin);
    return firstEntry ?? fallback;
}
function buildReadmeContent(meta) {
    return `# ${meta.name}

> ${meta.description}

## Table of Contents
1. [About](#about)
2. [Getting Started](#getting-started)
3. [Usage](#usage)
4. [Configuration](#configuration)
5. [License](#license)

## About

- **Author:** ${meta.author}
- **Version:** ${meta.version}
- **Description:** ${meta.description}
- **License:** ${meta.license}

## Getting Started

Install via npm:

\`\`\`bash
npm install ${meta.name}
\`\`\`

Run the CLI without installing globally:

\`\`\`bash
npx ${meta.cliCommand}
\`\`\`

## Usage

\`\`\`bash
npx ${meta.cliCommand} --help
\`\`\`

Or within code:

\`\`\`typescript
import { main } from '${meta.name}';

main();
\`\`\`

## Configuration

- \`option-name\` – Document how users can tweak this option.
- \`another-option\` – Explain accepted values or defaults.

## License

${meta.license} ${meta.author}
`;
}
async function showHeader() {
    const banner = [
        '┌────────────────────────────────────────┐',
        '│        NODE.JS PACKAGE STARTER         │',
        '└────────────────────────────────────────┘'
    ].join('\n');
    const animation = chalkAnimation.neon(banner);
    await sleep(1500);
    animation.stop();
}
async function spinner(task, message) {
    let idx = 0;
    const interval = setInterval(() => {
        const frame = spinFrames[idx % spinFrames.length];
        process.stdout.write(`\r${chalk.blue(`Installing dependencies ${frame}`)}`);
        idx++;
    }, 100);
    try {
        await task;
        process.stdout.write(`\r${chalk.green(`${message} ✓`)}\n\n`);
    }
    catch (error) {
        process.stdout.write(`\r${chalk.red(`Installing dependencies failed ✗`)}\n`);
        throw error;
    }
    finally {
        clearInterval(interval);
    }
}
async function ensurePackageJsonInitialized() {
    const targetPackageJson = path.join('.', 'package.json');
    if (!existsSync(targetPackageJson)) {
        console.log('\nNo package.json found. Running "npm init" to create one.');
        console.log('This step is interactive [1m(you must answer the prompts)[0m.');
        console.log('You can press Ctrl+C to abort and run `npm init -y` yourself if you prefer.\n');
        await runInteractiveCommand('npm', ['init']);
        await runInteractiveCommand('npm', ['install', '-D', 'typescript']);
        await runInteractiveCommand('npm', ['install', '-D', 'ts-node']);
        await runInteractiveCommand('npm', ['install', 'chalk', 'chalk-animation']);
    }
    const targetTsConfig = path.join('.', 'tsconfig.json');
    if (existsSync(targetTsConfig)) {
        const animation = chalkAnimation.rainbow(`File ${targetTsConfig} already exists - Happy coding!\n`);
        await sleep(2500);
        animation.stop();
        return;
    }
    //   **    CREATE FILE FOR tsconfig.json    **
    await ensureFileWritten(targetTsConfig, `
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": ["node"],
        "strict": true,
        "esModuleInterop": true
    },
    "include": ["./**/*.ts"]
}
  `, 'tsconfig.json');
    //   **    CREATE FILE FOR index.ts    **
    await ensureFileWritten(path.join(".", "index.ts"), `#!/usr/bin/env node

import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function showHeader(): Promise<void> {
  const animation = chalkAnimation.rainbow(chalk.bold('Welcome!'));
  await sleep(1200);
  animation.stop();
}

export async function main(): Promise<void> {
  await showHeader();
  console.log(chalk.green('Hello World'));
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
`, 'index.ts');
    //   **    CREATE FILE FOR README.md    **
    const pkgMeta = await loadPackageMetadata();
    if (!options.skipReadme) {
        const readmeContent = buildReadmeContent(pkgMeta);
        await ensureFileWritten(path.join(".", "README.md"), readmeContent, 'README.md');
    }
    else {
        console.log('Skipping README.md (per --skip-readme).');
    }
    //   **    CREATE FILE FOR scripts/release.mjs    **
    const releaseTemplate = await fs.readFile(new URL('./scripts/release.mjs', import.meta.url), 'utf8');
    await ensureUtilsScaffold('scripts', 'release.mjs', releaseTemplate);
    //   **    UPDATE package.json STRUCTURE    **
    await ensurePackageJsonSetup(pkgMeta);
    //   **    CREATE VERSION BUMP SCRIPT & HOOKS    **
    await ensureVersionAutomation();
    //   **    CREATE FILE FOR .gitignore    **
    await ensureFileWritten(path.join(".", ".gitignore"), "node_modules\n", '.gitignore');
    //   **    CREATE FILE FOR .npmignore    **
    await ensureFileWritten(path.join(".", ".npmignore"), "", '.npmignore');
}
const versionScriptTemplate = `#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function bumpVersion(): Promise<void> {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const raw = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  const [major = 0, minor = 0, patch = 0] = (pkg.version ?? '0.0.0')
    .split('.')
    .map((value) => Number.parseInt(value, 10));
  const nextPatch = Number.isFinite(patch) ? patch + 1 : 0;
  pkg.version = [major, minor, nextPatch].join('.');
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\\n');
  console.log('package.json version bumped to', pkg.version);
}

bumpVersion().catch((error) => {
  console.error('Failed to bump version before publish:', error);
  process.exit(1);
});
`;
async function ensureVersionAutomation() {
    const scriptsDir = path.join(".", "scripts");
    const scriptName = "update-version.mjs";
    const scriptPath = path.join(scriptsDir, scriptName);
    if (!existsSync(scriptsDir)) {
        await mkdir(scriptsDir, { recursive: true });
    }
    if (!existsSync(scriptPath)) {
        await writeFile(scriptPath, versionScriptTemplate);
        console.log(`\nCreated ${path.relative(".", scriptPath)} for version bumping.`);
    }
    await ensurePrepublishHook(path.posix.join("scripts", scriptName));
}
async function ensurePrepublishHook(scriptRelativePath) {
    await editPackageJson((pkg) => {
        pkg.scripts = pkg.scripts ?? {};
        const normalizedScriptPath = scriptRelativePath.replace(/\\/g, "/");
        const hookCommand = `node ${normalizedScriptPath}`;
        const existingHook = pkg.scripts.prepublishOnly ?? "";
        if (!existingHook.includes(hookCommand)) {
            pkg.scripts.prepublishOnly = existingHook
                ? `${hookCommand} && ${existingHook}`
                : hookCommand;
        }
    });
}
async function ensurePackageJsonSetup(meta) {
    await editPackageJson((pkg) => {
        pkg.type = pkg.type ?? 'module';
        pkg.main = pkg.main ?? 'index.ts';
        const binName = meta.cliCommand || pkg.name || 'my-cli';
        if (!pkg.bin || typeof pkg.bin === 'string') {
            pkg.bin = { [binName]: 'index.ts' };
        }
        else if (!pkg.bin[binName]) {
            pkg.bin[binName] = 'index.ts';
        }
        pkg.scripts = pkg.scripts ?? {};
        if (!pkg.scripts.clean) {
            pkg.scripts.clean = 'rm -rf dist';
        }
        if (!pkg.scripts.build) {
            pkg.scripts.build = 'tsc';
        }
        if (!pkg.scripts.prepare) {
            pkg.scripts.prepare = 'npm run build';
        }
        if (!pkg.scripts.prettier) {
            pkg.scripts.prettier = 'prettier --write .';
        }
        if (!pkg.scripts.lint) {
            pkg.scripts.lint = 'eslint .';
        }
        if (!pkg.scripts.test) {
            pkg.scripts.test = 'echo "Error: no test specified" && exit 1';
        }
        if (!pkg.scripts.release) {
            pkg.scripts.release = 'node scripts/release.mjs';
        }
        if (!pkg.scripts.version) {
            pkg.scripts.version = 'node --loader ts-node/esm utils/utils.ts';
        }
    });
}
async function editPackageJson(mutator) {
    const pkgPath = path.join(".", "package.json");
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    mutator(pkg);
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
async function ensureFileWritten(filePath, contents, label) {
    if (!options.force && existsSync(filePath)) {
        console.log(`Skipping ${label}: file already exists (use --force to overwrite).`);
        return;
    }
    await writeFile(filePath, contents);
    /**
     * Minimal example of using chalk for human-friendly CLI output.
     * (Avoid overusing colors; keep it to short status messages.)
     */
    console.log(chalk.green(`${options.force ? 'Wrote' : 'Created'} ${label}`));
}
async function main() {
    await showHeader();
    const utilsTemplate = await fs.readFile(new URL('./utils/utils.ts', import.meta.url), 'utf8');
    await ensureUtilsScaffold('utils', 'utils.ts', utilsTemplate);
    await ensurePackageJsonInitialized();
    await spinner(runInteractiveCommand('npm', ['install']), 'Dependencies installed');
    console.log(chalk.green('\nNODEJS PACKAGE STARTER KIT CREATED'));
}
main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});
