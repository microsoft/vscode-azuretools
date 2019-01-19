/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as process from 'process';
import { gulp_spawn } from "./gulp_spawn";

export function gulp_webpack(mode: string): cp.ChildProcess {
    const env: {
        [key: string]: string | undefined;
    } = process.env;

    // without this, webpack can run out of memory in some environments
    env.NODE_OPTIONS = '--max-old-space-size=8192';

    return gulp_spawn(
        './node_modules/.bin/webpack', [
            '--mode', mode,
            '--display', 'minimal'
        ],
        {
            stdio: 'inherit', env
        });
}
