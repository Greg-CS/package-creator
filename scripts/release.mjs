import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

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

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const raw = (await rl.question('Release type? (patch/minor/major) [patch]: ')).trim().toLowerCase();
    const releaseType = raw === '' ? 'patch' : raw;

    if (!['patch', 'minor', 'major'].includes(releaseType)) {
      throw new Error(`Invalid release type: ${releaseType}`);
    }

    await run('npm', ['run', 'prepare']);
    await run('npm', ['version', releaseType]);
    await run('git', ['push', '--follow-tags']);
    await run('npm', ['publish']);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Release failed:', error);
  process.exit(1);
});
