/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as archiver from 'archiver';
import * as fse from 'fs-extra';
import { glob as globGitignore } from 'glob-gitignore';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';

export async function getZipFileToDeploy(fsPath: string, isFunctionApp: boolean): Promise<string> {
    if ((await fse.lstat(fsPath)).isDirectory()) {
        if (!fsPath.endsWith(path.sep)) {
            fsPath += path.sep;
        }

        if (isFunctionApp) {
            return zipDirectoryGitignore(fsPath, '.funcignore');
        } else {
            const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(fsPath));
            const globPattern: string | undefined = zipDeployConfig.get<string>('zipGlobPattern');
            const ignorePattern: string | string[] | undefined = zipDeployConfig.get<string | string[]>('zipIgnorePattern');
            return zipDirectoryGlob(fsPath, globPattern, ignorePattern);
        }
    } else {
        return zipFile(fsPath);
    }
}

/**
 * Zips a single file
 */
async function zipFile(filePath: string): Promise<string> {
    return await zip(async (zipper) => {
        zipper.file(filePath, { name: path.basename(filePath) });
    });
}

const commonGlobSettings: {} = {
    dot: true, // Include paths starting with '.'
    nodir: true, // required for symlinks https://github.com/archiverjs/node-archiver/issues/311#issuecomment-445924055
    follow: true // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
};

/**
 * Zips directory using glob filtering
 */
async function zipDirectoryGlob(folderPath: string, globPattern: string = '**/*', ignorePattern?: string | string[]): Promise<string> {
    return await zip(async (zipper) => {
        zipper.glob(globPattern, {
            cwd: folderPath,
            ignore: ignorePattern,
            ...commonGlobSettings
        });
    });
}

/**
 * Zips directory using gitignore filtering
 */
async function zipDirectoryGitignore(folderPath: string, gitignoreName: string): Promise<string> {
    return await zip(async (zipper) => {
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
    });
}

function randomFileName(): string {
    // tslint:disable-next-line:insecure-random
    return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
}

/**
 * Common code for all zip methods above
 */
async function zip(addFiles: (zipper: archiver.Archiver) => Promise<void>): Promise<string> {
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
