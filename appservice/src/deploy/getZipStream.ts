/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as archiver from 'archiver';
import * as fse from 'fs-extra';
import { glob as globGitignore } from 'glob-gitignore';
import * as path from 'path';
import * as prettybytes from 'pretty-bytes';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { getFileExtension } from '../utils/pathUtils';

export async function getZipStream(context: IActionContext, fsPath: string, client: SiteClient): Promise<Readable> {
    let zipStream: Readable;
    if (getFileExtension(fsPath) === 'zip') {
        context.telemetry.properties.alreadyZipped = 'true';
        zipStream = fse.createReadStream(fsPath);
    } else {
        ext.outputChannel.appendLog(localize('zipCreate', 'Creating zip package...'), { resourceName: client.fullName });

        // level 9 indicates best compression at the cost of slower zipping. Since sending the zip over the internet is usually the bottleneck, we want best compression.
        const zipper: archiver.Archiver = archiver('zip', { zlib: { level: 9 } });
        if ((await fse.lstat(fsPath)).isDirectory()) {
            if (!fsPath.endsWith(path.sep)) {
                fsPath += path.sep;
            }

            if (client.isFunctionApp) {
                await addFilesGitignore(zipper, fsPath, '.funcignore');
            } else {
                addFilesGlob(zipper, fsPath);
            }
        } else {
            zipper.file(fsPath, { name: path.basename(fsPath) });
        }
        await zipper.finalize();
        zipStream = zipper;
    }

    context.telemetry.measurements.zipFileSize = zipStream.readableLength;
    ext.outputChannel.appendLog(localize('zipSize', 'Zip package size: {0}', prettybytes(zipStream.readableLength)), { resourceName: client.fullName });
    return zipStream;
}

const commonGlobSettings: {} = {
    dot: true, // Include paths starting with '.'
    nodir: true, // required for symlinks https://github.com/archiverjs/node-archiver/issues/311#issuecomment-445924055
    follow: true // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
};

/**
 * Adds files using glob filtering
 */
function addFilesGlob(zipper: archiver.Archiver, folderPath: string): void {
    const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(folderPath));
    // tslint:disable-next-line: strict-boolean-expressions
    const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern') || '**/*';
    const ignorePattern: string | string[] | undefined = zipDeployConfig.get<string | string[]>('zipIgnorePattern');
    zipper.glob(globPattern, { cwd: folderPath, ignore: ignorePattern, ...commonGlobSettings });
}

/**
 * Adds files using gitignore filtering
 */
async function addFilesGitignore(zipper: archiver.Archiver, folderPath: string, gitignoreName: string): Promise<void> {
    let ignore: string[] = [];
    const gitignorePath: string = path.join(folderPath, gitignoreName);
    if (await fse.pathExists(gitignorePath)) {
        const funcIgnoreContents: string = (await fse.readFile(gitignorePath)).toString();
        ignore = funcIgnoreContents.split('\n').map(l => l.trim());
    }

    // tslint:disable-next-line:no-unsafe-any
    const paths: string[] = await globGitignore('**/*', { cwd: folderPath, ignore, ...commonGlobSettings });
    for (const p of paths) {
        zipper.file(path.join(folderPath, p), { name: p });
    }
}
