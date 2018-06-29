/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from "ms-rest";
import { getPackageInfo } from "./getPackageInfo";

/**
 * Adds a user agent specific to the VS Code extension, of the form `${extensionName}/${extensionVersion}`
 */
export function addExtensionUserAgentInfo(client: ServiceClient): void {
    const [extensionName, extensionVersion]: [string, string] = getPackageInfo();
    client.addUserAgentInfo(`${extensionName}/${extensionVersion}`);
}
