/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

export async function createTemporaryFile(fileName: string): Promise<string> {
    const randomFolderNameLength: number = 12; 
    const buffer: Buffer = crypto.randomBytes(Math.ceil(randomFolderNameLength / 2));
    const folderName: string = buffer.toString('hex').slice(0, randomFolderNameLength);
    const filePath: string = path.join(os.tmpdir(), folderName, fileName);
    await fse.ensureFile(filePath);
    return filePath;
}
