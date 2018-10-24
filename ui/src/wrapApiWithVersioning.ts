/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import { IActionContext } from '..';
import { AzureExtension, AzureExtensionProvider } from '../api';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { getPackageInfo } from './getPackageInfo';
import { localize } from './localize';

export function wrapApiWithVersioning(azExts: AzureExtension[]): AzureExtensionProvider {
    for (const azExt of azExts) {
        if (!semver.valid(azExt.apiVersion)) {
            throw new Error(localize('invalidVersion', 'Invalid semver "{0}".', azExt.apiVersion));
        }
    }

    const extensionId: string = getPackageInfo().extensionId;
    return {
        getExtension: async <T extends AzureExtension>(apiVersion: string): Promise<T> => getExtensionInternal<T>(azExts, extensionId, apiVersion)
    };
}

async function getExtensionInternal<T extends AzureExtension>(azExts: AzureExtension[], extensionId: string, requestedApiVersion: string): Promise<T> {
    return callWithTelemetryAndErrorHandling('getExtension', async function (this: IActionContext): Promise<T> {
        this.rethrowError = true;
        this.suppressErrorDisplay = true;
        this.properties.isActivationEvent = 'true';

        this.properties.requestedApiVersion = requestedApiVersion;

        const apiVersions: string[] = azExts.map((a: AzureExtension) => a.apiVersion);
        this.properties.apiVersions = apiVersions.join(', ');

        const matchedApiVersion: string = semver.maxSatisfying(apiVersions, requestedApiVersion);
        if (matchedApiVersion) {
            return <T>(azExts.find((a: AzureExtension) => a.apiVersion === matchedApiVersion));
        } else {
            const minApiVersion: string = semver.minSatisfying(apiVersions, '');
            const message: string = semver.lt(requestedApiVersion, minApiVersion) ?
                localize('notSupported', 'API version "{0}" for extension id "{1}" is no longer supported. Minimum version is "{2}".', requestedApiVersion, extensionId, minApiVersion) : // This case will hopefully never happen if we maintain backwards compat
                localize('updateExtension', 'Extension dependency with id "{0}" must be updated.', extensionId); // This case is somewhat likely - so keep the error message simple and just tell user to update their extenion

            throw new Error(message);
        }
    });
}
