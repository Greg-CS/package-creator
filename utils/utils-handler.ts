import chalkAnimation from 'chalk-animation';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function animate(message: string, variant: 'glitch' | 'rainbow' = 'glitch'): Promise<void> {
  const animation = chalkAnimation[variant](message);
  await sleep(2000);
  animation.stop();
}

export async function ensureUtilsScaffold(folderPath: string, fileName?: string): Promise<void> {
  if (!existsSync(folderPath)) {
    await mkdir(folderPath, { recursive: true });
    await animate(`Folder ${folderPath} created successfully!`, 'rainbow');
  } else {
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

  await writeFile(targetFile, '');
  await animate(`File ${fileName} created successfully!`, 'rainbow');
}
