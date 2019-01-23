/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { File } from 'decompress';
import * as glob from 'glob';
import * as gulp from 'gulp';
// tslint:disable-next-line: no-require-imports
import decompress = require('gulp-decompress');
// tslint:disable-next-line: no-require-imports
import download = require('gulp-download');
import * as os from 'os';
import * as path from 'path';
import { Stream } from 'stream';

export function gulp_installAzureAccount(): Promise<void> | Stream {
    const version: string = '0.4.3';
    const extensionPath: string = path.join(os.homedir(), `.vscode/extensions/ms-vscode.azure-account-${version}`);
    const existingExtensions: string[] = glob.sync(extensionPath.replace(version, '*'));
    if (existingExtensions.length === 0) {
        // tslint:disable-next-line:no-http-string
        return download(`http://ms-vscode.gallery.vsassets.io/_apis/public/gallery/publisher/ms-vscode/extension/azure-account/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`)
            .pipe(decompress({
                filter: (file: File): boolean => file.path.startsWith('extension/'),
                map: (file: File): File => {
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
