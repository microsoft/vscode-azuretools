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
    const zipFilePath: string = path.join(os.tmpdir(), `${randomFileName()}.zip`);
    await new Promise((resolve: () => void, reject: (err: Error) => void): void => {
        const zipOutput: fse.WriteStream = fse.createWriteStream(zipFilePath);
        const zipper: archiver.Archiver = archiver('zip');
        zipOutput.on('close', resolve);
        zipper.on('error', reject);
        zipper.pipe(zipOutput);
        zipper.file(filePath, { name: path.basename(filePath) });
        zipper.finalize();
    });
    return zipFilePath;
}

async function zipDirectoryInternal(folderPath: string, addFiles: (zipper: archiver.Archiver) => Promise<void>): Promise<string> {
    if (!folderPath.endsWith(path.sep)) {
        folderPath += path.sep;
    }

    const zipFilePath: string = path.join(os.tmpdir(), `${randomFileName()}.zip`);
    await new Promise(async (resolve: () => void, reject: (err: Error) => void): Promise<void> => {
        const zipOutput: fse.WriteStream = fse.createWriteStream(zipFilePath);
        zipOutput.on('close', resolve);

        const zipper: archiver.Archiver = archiver('zip', { zlib: { level: 9 } });
        zipper.on('error', reject);
        await addFiles(zipper);
        zipper.pipe(zipOutput);
        void zipper.finalize();
    });

    return zipFilePath;
}

/**
 * Zips directory using glob filtering
 */
export async function zipDirectoryGlob(folderPath: string, globPattern: string = '**/*', ignorePattern?: string | string[]): Promise<string> {
    return await zipDirectoryInternal(folderPath, async (z) => {
        await addFilesByGlob(z, folderPath, globPattern, ignorePattern);
    });
}

/**
 * Zips directory using gitignore filtering
 */
export async function zipDirectoryGitignore(folderPath: string, gitignoreName: string): Promise<string> {
    return await zipDirectoryInternal(folderPath, async (z) => {
        await addFilesByGitignore(z, folderPath, gitignoreName);
    });
}

async function addFilesByGlob(zipper: archiver.Archiver, folderPath: string, globPattern: string, ignorePattern: string | string[] | undefined): Promise<void> {
    zipper.glob(globPattern, {
        cwd: folderPath,
        dot: true,
        ignore: ignorePattern
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
    const paths: string[] = await globGitignore('**/*', { cwd: folderPath, ignore, absolute: true });
    for (const p of paths) {
        zipper.file(p, { name: path.relative(folderPath, p) });
    }
}

export function randomFileName(): string {
    // tslint:disable-next-line:insecure-random
    return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
}
