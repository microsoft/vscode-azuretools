/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as process from 'process';

export function webpack(mode: string): cp.ChildProcess {
    const env: { [key: string]: string | undefined } = process.env;

    // without this, webpack can run out of memory in some environments
    env.NODE_OPTIONS = '--max-old-space-size=8192';
    return spawn(
        path.join(__dirname, './node_modules/.bin/webpack'),
        [
            '--mode', mode,
            '--display', 'minimal'],
        {
            stdio: 'inherit', env
        });
}

export function spawn(
    command: string,
    args: string[],
    options: cp.SpawnOptions
): cp.ChildProcess {
    let actualCommand: string = command;
    if (process.platform === 'win32') {
        const exePath: string = `${command}.exe`;
        const cmdPath: string = `${command}.cmd`;

        if (fse.pathExistsSync(exePath)) {
            actualCommand = exePath;
        } else if (fse.pathExistsSync(cmdPath)) {
            actualCommand = cmdPath;
        }
    }

    return cp.spawn(actualCommand, args, options);
}

/**
 * Installs the azure account extension before running tests (otherwise our extension would fail to activate)
 * NOTE: The version isn't super important since we don't actually use the account extension in tests
 */
function installAzureAccount(): Promise<void> {
    const version: string = '0.4.3';
    const extensionPath: string = path.join(os.homedir(), `.vscode/extensions/ms-vscode.azure-account-${version}`);
    const existingExtensions: string = glob.sync(extensionPath.replace(version, '*'));
    if (existingExtensions.length === 0) {
        // tslint:disable-next-line:no-http-string
        return download(`http://ms-vscode.gallery.vsassets.io/_apis/public/gallery/publisher/ms-vscode/extension/azure-account/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`)
            .pipe(decompress({
                filter: file => file.path.startsWith('extension/'),
                map: file => {
                    file.path = file.path.slice(10);
                    return file;
                }
            }))
            .pipe(gulp.dest(extensionPath));
    } else {
        console.log("Azure Account extension already installed.");
        // We need to signal to gulp that we've completed this async task
        return Promise.resolve();
    }
}
