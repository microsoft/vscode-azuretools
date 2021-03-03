/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { rejects } from 'assert';
import * as path from 'path';
import { Readable } from 'stream';
import * as yazl from 'yazl';

export async function zip(deployPath: string, files: string[]): Promise<Readable> {
    const zipFile = new yazl.ZipFile();
    const buffer: string[] = [];
    zipFile.outputStream.on('data', (data) => {
        buffer.push(data);
    });



    for (const file of files) {
        zipFile.addFile(path.join(deployPath, file), file);
    }

    zipFile.end();

    return await new Promise((resolve, reject): void => {
        zipFile.outputStream.on('finish', (): void => {
            resolve(Readable.from(buffer));
        });

        zipFile.outputStream.once('error', (er) => {
            reject(er)
        });
    })
}
