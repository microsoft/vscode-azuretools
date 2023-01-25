/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAddUserAgent } from "../index";
import { getPackageInfo } from "./getPackageInfo";

/**
 * Adds a user agent specific to the VS Code extension, of the form `${extensionName}/${extensionVersion}`
 */
export function addExtensionUserAgent(client: IAddUserAgent): void {
    client.addUserAgentInfo(getExtensionUserAgent());
}

async function getExtensionUserAgent(): Promise<string> {
    const { extensionName, extensionVersion } = await getPackageInfo();
    return `${extensionName}/${extensionVersion}`;
}

export async function appendExtensionUserAgent(existingUserAgent?: string): Promise<string> {
    const extensionUserAgent: string = await getExtensionUserAgent();

    existingUserAgent ||= extensionUserAgent;
    if (existingUserAgent.includes(extensionUserAgent)) {
        return existingUserAgent;
    } else {
        return `${existingUserAgent} ${extensionUserAgent}`;
    }
}
