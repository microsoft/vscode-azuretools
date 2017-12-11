/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

// tslint:disable-next-line:no-stateless-class export-name
export class TemporaryFile {
    private static randomFolderNameLength: number = 12;

    // tslint:disable-next-line:function-name
    public static async create(fileName: string): Promise<string> {
        const buffer: Buffer = crypto.randomBytes(Math.ceil(TemporaryFile.randomFolderNameLength / 2));
        const folderName: string = buffer.toString('hex').slice(0, TemporaryFile.randomFolderNameLength);
        const filePath: string = path.join(os.tmpdir(), folderName, fileName);
        // tslint:disable-next-line:no-unsafe-any
        await fse.ensureFile(filePath);
        return filePath;
    }
}
