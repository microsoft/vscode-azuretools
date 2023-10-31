/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { AzExtFsExtra, IActionContext } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
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
    callback: (zipStream: Readable) => Promise<AzExtPipelineResponse | void>
}): Promise<AzExtPipelineResponse | void> {

    function onFileSize(size: number): void {
        context.telemetry.measurements.zipFileSize = size;
        ext.outputChannel.appendLog(vscode.l10n.t('Zip package size: {0}', prettybytes(size)), { resourceName: site.fullName });
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
        ext.outputChannel.appendLog(vscode.l10n.t('Creating zip package...'), { resourceName: site.fullName });
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
                filesToZip = await getFilesFromGlob(fsPath, site.fullName);
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

/**
 * Adds files using glob filtering
 */
export async function getFilesFromGlob(folderPath: string, resourceName: string): Promise<string[]> {
    // App Service is the only extension with the zipIgnorePattern setting, so if ext.prefix is undefined, use 'appService'
    const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ext.prefix ?? 'appService', vscode.Uri.file(folderPath));
    const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern') || '**/*';
    const zipIgnorePatternStr = 'zipIgnorePattern';
    const zipIgnorePattern: string[] | string | undefined = zipDeployConfig.get<string | string[]>(zipIgnorePatternStr);
    const ignorePatternList: string[] | undefined = typeof zipIgnorePattern === 'string' ? [zipIgnorePattern] : zipIgnorePattern;

    // first find all files without any ignorePatterns
    let files: vscode.Uri[] = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, globPattern));
    if (ignorePatternList) {
        try {
            // not all ouptut channels _have_ to support appendLog, so catch the error
            ext.outputChannel.appendLog(vscode.l10n.t(`Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr), { resourceName });
        } catch (error) {
            ext.outputChannel.appendLine(vscode.l10n.t(`Ignoring files from \"{0}.{1}\"`, ext.prefix, zipIgnorePatternStr));
        }

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

    return (await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, '**/*'), `{${ignore.join(',')}}`))
        .map(f => path.relative(folderPath, f.fsPath));
}
