/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerUIExtensionVariables, UIExtensionVariables } from '@microsoft/vscode-azext-utils';

/**
 * Call this to register common variables used throughout the github package.
 * @deprecated This method is no longer necessary and will be removed in a future release. You can safely remove any calls to this method.
 */
export function registerGitHubExtensionVariables(extVars: UIExtensionVariables): void {
    registerUIExtensionVariables(extVars);
}
