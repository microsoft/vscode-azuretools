/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as path from 'path';
import * as process from 'process';

export function gulp_webpack(mode: string): cp.ChildProcess {
    const env: {
        [key: string]: string | undefined;
    } = process.env;

    // without this, webpack can run out of memory in some environments
    env.NODE_OPTIONS = '--max-old-space-size=8192';

    return cp.spawn(
        path.join(
            './node_modules/.bin/',
            // https://github.com/nodejs/node-v0.x-archive/issues/2318#issuecomment-249355505
            process.platform === 'win32' ? 'webpack.cmd' : 'webpack'),
        [
            '--mode', mode,
            '--display', 'minimal'
        ],
        {
            stdio: 'inherit',
            env
        });
}
