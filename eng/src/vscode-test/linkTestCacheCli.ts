#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseArgs } from 'util';
import { linkVscodeTestCache } from './linkTestCache.js';

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            'extension-dir': { type: 'string' },
            'cache-dir': { type: 'string' },
            replace: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
    });

    if (values.help) {
        console.log('Usage: azext-link-test-cache [--extension-dir PATH] [--cache-dir PATH] [--replace]');
        return;
    }

    const result = await linkVscodeTestCache({
        extensionDir: values['extension-dir'],
        cacheDir: values['cache-dir'],
        replaceExistingLink: values.replace,
    });
    console.log(`Test cache ${result.action}: ${result.linkPath} -> ${result.cacheDir}`);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
