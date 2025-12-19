#!/usr/bin/env node
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function runInteractiveCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('error', (error) => {
            reject(error);
        });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
            }
        });
    });
}
async function animate(message, variant = 'glitch') {
    const animation = chalkAnimation[variant](message);
    await sleep(2000);
    animation.stop();
}
export async function ensureUtilsScaffold(folderPath, fileName, fileContents = '') {
    if (!existsSync(folderPath)) {
        await mkdir(folderPath, { recursive: true });
        await animate(`Folder ${folderPath} created successfully!`, 'rainbow');
    }
    else {
        await animate(`Folder ${folderPath} already exists!`);
    }
    if (!fileName) {
        return;
    }
    const targetFile = path.join(folderPath, fileName);
    if (existsSync(targetFile)) {
        await animate(`File ${fileName} already exists!`);
        return;
    }
    await writeFile(targetFile, fileContents);
    await animate(`File ${fileName} created successfully!`, 'rainbow');
}
async function bumpVersion() {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const raw = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    const [major = 0, minor = 0, patch = 0] = (pkg.version ?? '0.0.0')
        .split('.')
        .map((value) => Number.parseInt(value, 10));
    const nextPatch = Number.isFinite(patch) ? patch + 1 : 0;
    pkg.version = [major, minor, nextPatch].join('.');
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(chalk.green('package.json version bumped to'), chalk.cyan(pkg.version));
}
const isEntrypoint = process.argv[1]
    ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
    : false;
if (isEntrypoint) {
    bumpVersion().catch((error) => {
        console.error('Failed to bump version before publish:', error);
        process.exit(1);
    });
}
