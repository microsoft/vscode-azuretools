/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getPackageInfo } from "./getPackageInfo";

function getExtensionUserAgent(): string {
    const { extensionName, extensionVersion } = getPackageInfo();
    return `${extensionName}/${extensionVersion}`;
}

export function appendExtensionUserAgent(existingUserAgent?: string): string {
    const extensionUserAgent: string = getExtensionUserAgent();

    existingUserAgent = existingUserAgent || extensionUserAgent;
    if (existingUserAgent.includes(extensionUserAgent)) {
        return existingUserAgent;
    } else {
        return `${existingUserAgent} ${extensionUserAgent}`;
    }
}
