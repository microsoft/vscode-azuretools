/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azExtTestConfig } from '@microsoft/vscode-azext-eng/vscode-test'; // Other configurations exist

export default { // TODO: Remove this when using 1.0.0-alpha.5 of the eng pkg
    ...azExtTestConfig,
    env: {
        ...azExtTestConfig.env,
        DEBUGTELEMETRY: '1',
    },
};
