/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
import * as globby from 'globby';
import * as path from 'path';
import * as prettybytes from 'pretty-bytes';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import * as yazl from 'yazl';
import { ParsedSite } from '../SiteClient';
import { ext } from '../extensionVariables';
import { getFileExtension } from '../utils/pathUtils';

export async function runWithZipStream(context: IActionContext, options: {
    fsPath: string,
    site: ParsedSite,
    pathFileMap?: Map<string, string>
    progress?: vscode.Progress<{ message?: string; increment?: number }>
    callback: (zipStream: Readable) => Promise<AzExtPipelineResponse | void>
}): Promise<AzExtPipelineResponse | void> {

    function onFileSize(size: number): void {
        context.telemetry.measurements.zipFileSize = size;
        const zipFileSize = vscode.l10n.t('Zip package size: {0}', prettybytes(size));
        ext.outputChannel.appendLog(vscode.l10n.t('Zip package size: {0}', prettybytes(size)), { resourceName: site.fullName });
        options.progress?.report({ message: zipFileSize });
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
        const creatingZip = vscode.l10n.t('Creating zip package...')
        ext.outputChannel.appendLog(creatingZip, { resourceName: site.fullName });
        options.progress?.report({ message: creatingZip });

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
                filesToZip = await getFilesFromGlob(fsPath, site, options.progress);
            }

            ext.outputChannel.appendLog(vscode.l10n.t('Adding {0} files to zip package...', filesToZip.length), { resourceName: site.fullName });
            for (const file of filesToZip) {
                ext.outputChannel.appendLog(path.join(fsPath, file), { resourceName: site.fullName });
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

const commonGlobSettings: Partial<globby.GlobbyOptions> = {
    dot: true, // Include paths starting with '.'
    followSymbolicLinks: true, // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
};

/**
 * Adds files using glob filtering
 */
async function getFilesFromGlob(folderPath: string, site: ParsedSite, progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<string[]> {
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
            const ignoringFiles = vscode.l10n.t(`Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr);
            ext.outputChannel.appendLog(ignoringFiles, { resourceName: site.fullName });
            progress?.report({ message: ignoringFiles });
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
    let ignore: string[] = [];
    const gitignorePath: string = path.join(folderPath, gitignoreName);
    if (await fse.pathExists(gitignorePath)) {
        const funcIgnoreContents: string = (await fse.readFile(gitignorePath)).toString();
        ignore = funcIgnoreContents
            .split('\n')
            .map(l => l.trim())
            .filter(s => s !== '');
    }

    return await globby('**/*', {
        gitignore: true,
        // We can replace this option and the above logic with `ignoreFiles` if we upgrade to globby^13 (ESM)
        // see https://github.com/sindresorhus/globby#ignorefiles
        ignore,
        cwd: folderPath,
        ...commonGlobSettings
    });
}
