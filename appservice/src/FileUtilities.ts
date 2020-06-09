/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as archiver from 'archiver';
import * as fse from 'fs-extra';
import { glob as globGitignore } from 'glob-gitignore';
import * as os from 'os';
import * as path from 'path';

export function getFileExtension(fsPath: string): string | undefined {
    return fsPath.split('.').pop();
}

export async function zipFile(filePath: string): Promise<string> {
    return await zipInternal(async (z) => {
        z.file(filePath, { name: path.basename(filePath) });
    });
}

async function zipInternal(addFiles: (zipper: archiver.Archiver) => Promise<void>): Promise<string> {
    const zipFilePath: string = path.join(os.tmpdir(), `${randomFileName()}.zip`);
    const zipFileStream: fse.WriteStream = fse.createWriteStream(zipFilePath);
    // level 9 indicates best compression at the cost of slower zipping. Since sending the zip over the internet is usually the bottleneck, we want best compression.
    const zipper: archiver.Archiver = archiver('zip', { zlib: { level: 9 } });
    await addFiles(zipper);

    const zipTask: Promise<void> = new Promise((resolve, reject): void => {
        zipFileStream.on('close', resolve);
        zipper.on('error', reject);
    });
    zipper.pipe(zipFileStream);

    await zipper.finalize();
    await zipTask;

    return zipFilePath;
}

/**
 * Zips directory using glob filtering
 */
export async function zipDirectoryGlob(folderPath: string, globPattern: string = '**/*', ignorePattern?: string | string[]): Promise<string> {
    return await zipInternal(async (z) => {
        await addFilesByGlob(z, folderPath, globPattern, ignorePattern);
    });
}

/**
 * Zips directory using gitignore filtering
 */
export async function zipDirectoryGitignore(folderPath: string, gitignoreName: string): Promise<string> {
    return await zipInternal(async (z) => {
        await addFilesByGitignore(z, folderPath, gitignoreName);
    });
}

const commonGlobSettings: {} = {
    dot: true, // Include paths starting with '.'
    nodir: true, // required for symlinks https://github.com/archiverjs/node-archiver/issues/311#issuecomment-445924055
    follow: true // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
};

async function addFilesByGlob(zipper: archiver.Archiver, folderPath: string, globPattern: string, ignorePattern: string | string[] | undefined): Promise<void> {
    zipper.glob(globPattern, {
        cwd: folderPath,
        ignore: ignorePattern,
        ...commonGlobSettings
    });
}

async function addFilesByGitignore(zipper: archiver.Archiver, folderPath: string, gitignoreName: string): Promise<void> {
    let ignore: string[] = [];
    const gitignorePath: string = path.join(folderPath, gitignoreName);
    if (await fse.pathExists(gitignorePath)) {
        const funcIgnoreContents: string = (await fse.readFile(gitignorePath)).toString();
        ignore = funcIgnoreContents.split('\n').map(l => l.trim());
    }

    // tslint:disable-next-line:no-unsafe-any
    const paths: string[] = await globGitignore('**/*', {
        cwd: folderPath,
        ignore,
        ...commonGlobSettings
    });
    for (const p of paths) {
        zipper.file(path.join(folderPath, p), { name: p });
    }
}

export function randomFileName(): string {
    // tslint:disable-next-line:insecure-random
    return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
}
