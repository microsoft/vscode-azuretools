/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";
import * as fse from 'fs-extra';
import * as path from 'path';
import * as os from 'os'

export class TemporaryFile {
    private static randomFolderNameLength = 12;
    
    static async create(fileName: string): Promise<string> {
        const buffer: Buffer = crypto.randomBytes(Math.ceil(TemporaryFile.randomFolderNameLength / 2));
        var folderName = buffer.toString('hex').slice(0, TemporaryFile.randomFolderNameLength);
        var filePath = path.join(os.tmpdir(), folderName, fileName);
        await fse.ensureFile(filePath);
        return filePath;
    }
}
