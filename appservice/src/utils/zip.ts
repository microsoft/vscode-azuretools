/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yazl from 'yazl';

export async function zip(deployPath: string): Promise<{ zipFile: yazl.ZipFile, buffer: string[] }> {
    const zipFile = new yazl.ZipFile();
    zipFile.outputStream.on('error', err => {
        throw err;
    });
    const buffer: string[] = [];
    zipFile.outputStream.on('data', (data) => {
        buffer.push(data);
    });

    zipFile.outputStream.pipe(fse.createWriteStream(path.join(os.homedir(), 'Desktop', 'test.zip')));
    await addFilesToZip(deployPath);
    zipFile.end();

    return { zipFile, buffer };

    async function addFilesToZip(fsPath: string): Promise<void> {
        for (let file of await fse.readdir(fsPath)) {
            const filePath: string = path.join(fsPath, file);
            if (fse.lstatSync(filePath).isDirectory()) {
                await addFilesToZip(filePath)
            } else if (fse.lstatSync(filePath).isFile()) {
                zipFile.addFile(filePath, path.relative(deployPath, filePath));
            }
        }
    }
}
