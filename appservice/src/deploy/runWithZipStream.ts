/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { AzExtFsExtra, IActionContext } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as prettybytes from 'pretty-bytes';
import { PassThrough, Readable } from 'stream';
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
        ext.outputChannel.appendLog(zipFileSize, { resourceName: site.fullName });
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

        const zipByteCounter = new PassThrough();
        const outputStream = new PassThrough();
        zipFile.outputStream.pipe(zipByteCounter);
        zipFile.outputStream.pipe(outputStream);
        zipByteCounter.on("data", (chunk) => {
            if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
                sizeOfZipFile += chunk.length;
            }
        });
        zipByteCounter.on("finish", () => {
            onFileSize(sizeOfZipFile);
        });

        if ((await fse.lstat(fsPath)).isDirectory()) {
            if (!fsPath.endsWith(path.sep)) {
                fsPath += path.sep;
            }

            if (site.isFunctionApp) {
                filesToZip = await getFilesFromGitignore(fsPath, '.funcignore');
            } else {
                filesToZip = await getFilesFromGlob(fsPath, site.fullName, options.progress);
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
        zipStream = outputStream;
    }

    return await callback(zipStream);
}

function getPathFromMap(realPath: string, pathfileMap?: Map<string, string>): string {
    return pathfileMap?.get(realPath) || realPath;
}

/**
 * Adds files using glob filtering
 */
export async function getFilesFromGlob(folderPath: string, resourceName: string, progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<string[]> {
    // App Service is the only extension with the zipIgnorePattern setting, so if ext.prefix is undefined, use 'appService'
    const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix ?? 'appService', vscode.Uri.file(folderPath));
    const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern') || '**/*';
    const zipIgnorePatternStr = 'zipIgnorePattern';
    const zipIgnorePattern: string[] | string | undefined = zipDeployConfig.get<string | string[]>(zipIgnorePatternStr);
    const ignorePatternList: string[] | undefined = typeof zipIgnorePattern === 'string' ? [zipIgnorePattern] : zipIgnorePattern;

    // first find all files without any ignorePatterns
    let files: vscode.Uri[] = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, globPattern));
    const ignoringFiles = vscode.l10n.t(`Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr);
    if (ignorePatternList) {
        try {
            // not all ouptut channels _have_ to support appendLog, so catch the error
            ext.outputChannel.appendLog(ignoringFiles, { resourceName });
        } catch (error) {
            ext.outputChannel.appendLine(ignoringFiles);
        }

        progress?.report({ message: ignoringFiles });

        // if there is anything to ignore, accumulate a list of ignored files and take the union of the lists
        for (const pattern of ignorePatternList) {
            const filesIgnored = (await vscode.workspace.findFiles(globPattern, pattern)).map(uri => uri.fsPath);
            // only leave in files that are in both lists
            files = files.filter(uri => filesIgnored.includes(uri.fsPath));
            ext.outputChannel.appendLine(`\"${pattern}\"`);
        }
    }
    return files.map(f => path.relative(folderPath, f.fsPath));
}

/**
 * Adds files using gitignore filtering
 */
export async function getFilesFromGitignore(folderPath: string, gitignoreName: string): Promise<string[]> {
    let ignore: string[] = [];
    const gitignorePath: string = path.join(folderPath, gitignoreName);
    if (await AzExtFsExtra.pathExists(gitignorePath)) {
        const funcIgnoreContents: string = await AzExtFsExtra.readFile(gitignorePath);
        ignore = funcIgnoreContents
            .split('\n')
            .map(l => l.trim())
            .filter(s => s !== '');
    }

    const exclude: vscode.GlobPattern | null = ignore.length > 0 ? `{${ignore.join(',')}}` : null;
    return (await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, '**/*'), exclude))
        .map(f => path.relative(folderPath, f.fsPath));
}
