/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: when available, use `testGlobalSetup` from @microsoft/vscode-azext-utils

import { createAzExtOutputChannel, registerUIExtensionVariables } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { registerAppServiceExtensionVariables } from '../src';

export const testWorkspaceRoot: string = path.resolve(__dirname, '..', 'testWorkspace');

// Runs before all tests
suiteSetup(() => {
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
        outputChannel: createAzExtOutputChannel('Extension Test Output', 'azureextensionui')
    };
    registerUIExtensionVariables(extVars);
    registerAppServiceExtensionVariables(extVars as any);
});
