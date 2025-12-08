/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createAzExtOutputChannel } from '../src/AzExtOutputChannel';
import { DebugReporter } from '../src/DebugReporter';
import { registerUIExtensionVariables } from '../src/extensionVariables';

// Runs before all tests
suiteSetup(async () => {
    const extVars = {
        context: {
            extension: {
                packageJSON: {
                    name: 'azureextensionui',
                    publisher: 'ms-azuretools',
                    version: '0.0.1',
                    aiKey: '00000000-0000-0000-0000-000000000000'
                },
            },
            subscriptions: [],
        } as any,
        reporter: new DebugReporter('ms-azuretools.azureextensionui', '0.0.1', true),
        outputChannel: createAzExtOutputChannel('Extension Test Output', 'azureextensionui')
    };
    registerUIExtensionVariables(extVars);
});
