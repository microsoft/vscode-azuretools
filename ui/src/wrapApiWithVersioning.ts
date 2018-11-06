/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import { IActionContext } from '..';
import { AzureExtensionApi, AzureExtensionApiProvider } from '../api';
import { callWithTelemetryAndErrorHandlingSync } from './callWithTelemetryAndErrorHandling';
import { getPackageInfo } from './getPackageInfo';
import { localize } from './localize';

export function wrapApiWithVersioning(azExts: AzureExtensionApi[]): AzureExtensionApiProvider {
    for (const azExt of azExts) {
        if (!semver.valid(azExt.apiVersion)) {
            throw new Error(localize('invalidVersion', 'Invalid semver "{0}".', azExt.apiVersion));
        }
    }

    const extensionId: string = getPackageInfo().extensionId;
    return {
        getApi: <T extends AzureExtensionApi>(apiVersionRange: string): T => getApiInternal<T>(azExts, extensionId, apiVersionRange)
    };
}

type ApiVersionCode = 'NoLongerSupported' | 'NotYetSupported';

class ApiVersionError extends Error {
    constructor(message: string, readonly code: ApiVersionCode) {
        super(message);
    }
}

function getApiInternal<T extends AzureExtensionApi>(azExts: AzureExtensionApi[], extensionId: string, apiVersionRange: string): T {
    return <T>callWithTelemetryAndErrorHandlingSync('getApi', function (this: IActionContext): T {
        this.rethrowError = true;
        this.suppressErrorDisplay = true;
        this.properties.isActivationEvent = 'true';

        this.properties.apiVersionRange = apiVersionRange;

        const apiVersions: string[] = azExts.map((a: AzureExtensionApi) => a.apiVersion);
        this.properties.apiVersions = apiVersions.join(', ');

        const matchedApiVersion: string = semver.maxSatisfying(apiVersions, apiVersionRange);
        if (matchedApiVersion) {
            return <T>(azExts.find((a: AzureExtensionApi) => a.apiVersion === matchedApiVersion));
        } else {
            const minApiVersion: string = semver.minSatisfying(apiVersions, '');
            let message: string;
            let code: ApiVersionCode;
            if (semver.gtr(minApiVersion, apiVersionRange)) {
                // This case will hopefully never happen if we maintain backwards compat
                message = localize('notSupported', 'API version "{0}" for extension id "{1}" is no longer supported. Minimum version is "{2}".', apiVersionRange, extensionId, minApiVersion);
                code = 'NoLongerSupported'
            } else {
                // This case is somewhat likely - so keep the error message simple and just tell user to update their extenion
                message = localize('updateExtension', 'Extension dependency with id "{0}" must be updated.', extensionId);
                code = 'NotYetSupported';
            }

            throw new ApiVersionError(message, code);
        }
    });
}
