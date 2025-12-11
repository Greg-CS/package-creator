

import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';
import { existsSync } from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {exec} from 'node:child_process';
import {promisify} from 'node:util';

const execPromise = promisify(exec);

const spinFrames = [...'⣾⣽⣻⢿⡿⣟⣯⣷'] as const;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function showHeader(): Promise<void> {
  const banner = [
    '┌────────────────────────────────────────┐',
    '│        NODE.JS PACKAGE STARTER         │',
    '└────────────────────────────────────────┘'
  ].join('\n');

  const animation = chalkAnimation.neon(banner);
  await sleep(1500);
  animation.stop();
}

async function spinner(task: Promise<unknown>, message: string): Promise<void> {
  process.stdout.write(chalk.blue(`${message} `));
  let idx = 0;

  const interval = setInterval(() => {
    const frame = spinFrames[idx % spinFrames.length];
    process.stdout.write(`\r${chalk.blue(`Installing dependacies ${frame}`)}`);
    idx++;
  }, 100);

  try {
    await task;
    process.stdout.write(`\r${chalk.green(`${message} ✓`)}\n`);
  } catch (error) {
    process.stdout.write(`\r${chalk.red(`Installing dependencies failed ✗`)}\n`);
    throw error;
  } finally {
    clearInterval(interval);
  }
}

async function packageCreator(durationMs: number): Promise<void> {
  await sleep(durationMs);
  const targetTsConfig = path.join(".", "tsconfig.json")
  if (existsSync(targetTsConfig)) {
    // console.log("\n\nFile already exists - Happy coding!\n");
    const animation = chalkAnimation.rainbow(`File ${targetTsConfig} already exists - Happy coding!\n`);
    await sleep(2500);
    animation.stop();
    return;
  }

//   **    CREATE FILE FOR tsconfig.JSON    **

  await writeFile(targetTsConfig, `
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
  `)

  await execPromise('npx prettier .')
  await execPromise('npx eslint . --init')
  const message = chalk.cyanBright("Installed dependencies successfully")
  await sleep(2500);
  console.log(message)
}

(async () => {
  await execPromise('npm init -y')
  await execPromise('npm install chalk chalk-animation @types/node')
  await showHeader();
  await spinner(packageCreator(3000), 'Installed dependencies \n \n');
})();