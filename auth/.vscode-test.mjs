/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azExtTestConfig } from '@microsoft/vscode-azext-eng/vscode-test'; // Other configurations exist

// @ts-check
export default {
    ...azExtTestConfig,
    // Use the VS Code already installed on this machine so that auth
    // sessions, profiles, and extensions are available to the tests.
    useInstallation: { fromMachine: true },
    launchArgs: [
        ...(azExtTestConfig.launchArgs ?? []),
        '--profile=Default',  // Reuse your normal VS Code profile (Azure sign-in sessions live here)
    ],
};
