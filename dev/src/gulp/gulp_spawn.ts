/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as process from 'process';

export function gulp_spawn(command: string, args: string[], options: cp.SpawnOptions): cp.ChildProcess {
    let actualCommand: string = command;

    if (process.platform === 'win32') {
        const exePath: string = `${actualCommand}.exe`;
        const cmdPath: string = `${actualCommand}.cmd`;

        if (fse.pathExistsSync(exePath)) {
            actualCommand = exePath;
        } else if (fse.pathExistsSync(cmdPath)) {
            actualCommand = cmdPath;
        }
    }

    return cp.spawn(actualCommand, args, options);
}
