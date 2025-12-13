#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
    console.log('package.json version bumped to', pkg.version);
}
bumpVersion().catch((error) => {
    console.error('Failed to bump version before publish:', error);
    process.exit(1);
});
