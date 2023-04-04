/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse } from '@azure/ms-rest-js';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
import { globby, Options } from 'globby';
import * as path from 'path';
import * as prettybytes from 'pretty-bytes';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import * as yazl from 'yazl';
import { ParsedSite } from '../SiteClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { getFileExtension } from '../utils/pathUtils';

export async function runWithZipStream(context: IActionContext, options: {
    fsPath: string,
    site: ParsedSite,
    pathFileMap?: Map<string, string>
    callback: (zipStream: Readable) => Promise<HttpOperationResponse | void>
}): Promise<HttpOperationResponse | void> {

    function onFileSize(size: number): void {
        context.telemetry.measurements.zipFileSize = size;
        ext.outputChannel.appendLog(localize('zipSize', 'Zip package size: {0}', prettybytes(size)), { resourceName: site.fullName });
    }

    let zipStream: Readable;
    const { site, pathFileMap, callback } = options;
    let { fsPath } = options;

    if (getFileExtension(fsPath) === 'zip') {
        context.telemetry.properties.alreadyZipped = 'true';
        zipStream = fse.createReadStream(fsPath);

        // don't wait
        void fse.lstat(fsPath).then(stats => {
            onFileSize(stats.size);
        });
    } else {
        ext.outputChannel.appendLog(localize('zipCreate', 'Creating zip package...'), { resourceName: site.fullName });
        const zipFile: yazl.ZipFile = new yazl.ZipFile();
        let filesToZip: string[] = [];
        let sizeOfZipFile: number = 0;

        zipFile.outputStream.on('data', (chunk) => {
            if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
                sizeOfZipFile += chunk.length;
            }
        });

        zipFile.outputStream.on('finish', () => onFileSize(sizeOfZipFile));

        if ((await fse.lstat(fsPath)).isDirectory()) {
            if (!fsPath.endsWith(path.sep)) {
                fsPath += path.sep;
            }

            if (site.isFunctionApp) {
                filesToZip = await getFilesFromGitignore(fsPath, '.funcignore');
            } else {
                filesToZip = await getFilesFromGlob(fsPath, site);
            }

            for (const file of filesToZip) {
                zipFile.addFile(path.join(fsPath, file), getPathFromMap(file, pathFileMap));
            }
        } else {
            zipFile.addFile(fsPath, getPathFromMap(path.basename(fsPath), pathFileMap));
        }

        zipFile.end();
        zipStream = zipFile.outputStream as Readable;
    }

    return await callback(zipStream);
}

function getPathFromMap(realPath: string, pathfileMap?: Map<string, string>): string {
    return pathfileMap?.get(realPath) || realPath;
}

const commonGlobSettings: Partial<Options> = {
    dot: true, // Include paths starting with '.'
    followSymbolicLinks: true, // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
};

/**
 * Adds files using glob filtering
 */
async function getFilesFromGlob(folderPath: string, site: ParsedSite): Promise<string[]> {
    const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(folderPath));
    const globOptions = { cwd: folderPath, followSymbolicLinks: true, dot: true };
    const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern') || '**/*';
    const filesToInclude: string[] = await globby(globPattern, globOptions);
    const zipIgnorePatternStr = 'zipIgnorePattern';

    let ignorePatternList: string | string[] = zipDeployConfig.get<string | string[]>(zipIgnorePatternStr) || '';
    const filesToIgnore: string[] = await globby(ignorePatternList, globOptions);

    if (ignorePatternList) {
        if (typeof ignorePatternList === 'string') {
            ignorePatternList = [ignorePatternList];
        }
        if (ignorePatternList.length > 0) {
            ext.outputChannel.appendLog(localize('zipIgnoreFileMsg', `Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr), { resourceName: site.fullName });
            for (const pattern of ignorePatternList) {
                ext.outputChannel.appendLine(`\"${pattern}\"`);
            }
        }
    }

    return filesToInclude.filter(file => {
        return !filesToIgnore.includes(file);
    })
}

/**
 * Adds files using gitignore filtering
 */
async function getFilesFromGitignore(folderPath: string, gitignoreName: string): Promise<string[]> {
    const paths: string[] = await globby('**/*', {
        gitignore: true,
        ignoreFiles: gitignoreName, // Ignore files matching patterns in the specified ignore file
        cwd: folderPath,
        ...commonGlobSettings
    });

    return paths;
}
