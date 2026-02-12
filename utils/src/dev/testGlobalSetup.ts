/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UIExtensionVariables } from '../types/extension';
import { createAzExtOutputChannel } from '../AzExtOutputChannel';
import { registerUIExtensionVariables } from '../extensionVariables';

/**
 * Performs setup necessary for running tests that use extension variables
 * @returns The registered extension variables
 */
export function testGlobalSetup(): UIExtensionVariables {
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
        } as never,
        outputChannel: createAzExtOutputChannel('Extension Test Output', 'azureextensionui')
    };
    registerUIExtensionVariables(extVars);
    return extVars;
}
