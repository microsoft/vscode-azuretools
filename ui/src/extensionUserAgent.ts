/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from "ms-rest";
import { getPackageInfo } from "./getPackageInfo";

/**
 * Adds a user agent specific to the VS Code extension, of the form `${extensionName}/${extensionVersion}`
 */
export function addExtensionUserAgent(client: ServiceClient): void {
    client.addUserAgentInfo(getExtensionUserAgent());
}

function getExtensionUserAgent(): string {
    const [extensionName, extensionVersion]: [string, string] = getPackageInfo();
    return `${extensionName}/${extensionVersion}`;
}

export function appendExtensionUserAgent(userAgent: string | undefined): string {
    const extensionUserAgent: string = getExtensionUserAgent();

    userAgent = userAgent || extensionUserAgent;
    if (userAgent.includes(userAgent)) {
        return userAgent;
    } else {
        return `${userAgent} ${extensionUserAgent}`;
    }
}
