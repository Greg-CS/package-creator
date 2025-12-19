import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs/promises';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}\n${stderr}`));
    });
  });
}

async function ensureCleanGitWorkingTree(rl) {
  const { stdout } = await runCapture('git', ['status', '--porcelain']);
  const dirty = stdout.trim();
  if (!dirty) return { stashed: false };

  console.log('\nGit working directory is not clean. Pending changes:');
  console.log(dirty);

  const choice = (await rl.question('\nHow do you want to proceed? (c)ommit/(s)tash/(a)bort [a]: '))
    .trim()
    .toLowerCase();

  if (choice === 'c' || choice === 'commit') {
    const message = (await rl.question('Commit message [chore: release prep]: ')).trim();
    await run('git', ['add', '-A']);
    await run('git', ['commit', '-m', message || 'chore: release prep']);
    return { stashed: false };
  }

  if (choice === 's' || choice === 'stash') {
    await run('git', ['stash', 'push', '-u', '-m', 'release: auto-stash']);
    return { stashed: true };
  }

  throw new Error('Aborted release due to dirty git working directory.');
}

function bumpVersionString(version, releaseType) {
  const parts = String(version ?? '0.0.0').split('.').map((v) => Number.parseInt(v, 10));
  let [major = 0, minor = 0, patch = 0] = parts;
  if (!Number.isFinite(major)) major = 0;
  if (!Number.isFinite(minor)) minor = 0;
  if (!Number.isFinite(patch)) patch = 0;

  if (releaseType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (releaseType === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

async function setPackageVersion(releaseType) {
  const raw = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8');
  const pkg = JSON.parse(raw);
  const nextVersion = bumpVersionString(pkg.version, releaseType);
  pkg.version = nextVersion;
  await fs.writeFile(new URL('../package.json', import.meta.url), JSON.stringify(pkg, null, 2) + '\n');
  return nextVersion;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const raw = (await rl.question('Release type? (patch/minor/major) [patch]: ')).trim().toLowerCase();
    const releaseType = raw === '' ? 'patch' : raw;

    if (!['patch', 'minor', 'major'].includes(releaseType)) {
      throw new Error(`Invalid release type: ${releaseType}`);
    }

    const { stashed } = await ensureCleanGitWorkingTree(rl);

    const nextVersion = await setPackageVersion(releaseType);
    await run('npm', ['run', 'prepare']);
    await run('git', ['add', '-A']);
    await run('git', ['commit', '-m', `chore(release): v${nextVersion}`]);
    await run('git', ['tag', `v${nextVersion}`]);
    await run('git', ['push', '--follow-tags']);
    await run('npm', ['publish']);

    if (stashed) {
      const unstash = (await rl.question('\nYou had changes stashed. Pop stash now? (y/N): '))
        .trim()
        .toLowerCase();
      if (unstash === 'y' || unstash === 'yes') {
        await run('git', ['stash', 'pop']);
      } else {
        console.log('Leaving stash in place (git stash list).');
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Release failed:', error);
  process.exit(1);
});
