/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import { AzureExtensionApi, AzureExtensionApiProvider, GetApiOptions } from '../api';
import { AzureExtensionApiFactory, IActionContext } from '../index';
import { callWithTelemetryAndErrorHandlingSync } from './callWithTelemetryAndErrorHandling';
import { getPackageInfo } from './getPackageInfo';
import { localize } from './localize';

function isAzureExtensionApiFactory(maybeAzureExtensionApiFactory: AzureExtensionApiFactory | AzureExtensionApi): maybeAzureExtensionApiFactory is AzureExtensionApiFactory {
    return (<AzureExtensionApiFactory>maybeAzureExtensionApiFactory).createApi !== undefined;
}

export async function createApiProvider(azExts: (AzureExtensionApiFactory | AzureExtensionApi)[]): Promise<AzureExtensionApiProvider> {
    for (const azExt of azExts) {
        if (!semver.valid(azExt.apiVersion)) {
            throw new Error(localize('invalidVersion', 'Invalid semver "{0}".', azExt.apiVersion));
        }
    }
    const extensionId: string = (await getPackageInfo()).extensionId;

    const apiFactories: AzureExtensionApiFactory[] = azExts.map((azExt): AzureExtensionApiFactory => {
        if (isAzureExtensionApiFactory(azExt)) {
            return azExt;
        } else {
            return <AzureExtensionApiFactory>{
                apiVersion: azExt.apiVersion,
                createApi: () => azExt,
            }
        }
    });

    return {
        getApi: <T extends AzureExtensionApi>(apiVersionRange: string, options: GetApiOptions): T => getApiInternal<T>(apiFactories, extensionId, apiVersionRange, options)
    };
}

type ApiVersionCode = 'NoLongerSupported' | 'NotYetSupported';

class ApiVersionError extends Error {
    constructor(message: string, readonly code: ApiVersionCode) {
        super(message);
    }
}

function getApiInternal<T extends AzureExtensionApi>(azExts: AzureExtensionApiFactory[], extensionId: string, apiVersionRange: string, options: GetApiOptions): T {
    return <T>callWithTelemetryAndErrorHandlingSync('getApi', (context: IActionContext) => {
        context.errorHandling.rethrow = true;
        context.errorHandling.suppressDisplay = true;
        context.telemetry.properties.isActivationEvent = 'true';

        context.telemetry.properties.apiVersionRange = apiVersionRange;
        context.telemetry.properties.callingExtensionId = options?.extensionId;

        const apiVersions: string[] = azExts.map((a: AzureExtensionApi) => a.apiVersion);
        context.telemetry.properties.apiVersions = apiVersions.join(', ');

        const matchedApiVersion: string | null = semver.maxSatisfying(apiVersions, apiVersionRange);
        if (matchedApiVersion) {
            const apiFactory = azExts.find(a => a.apiVersion === matchedApiVersion);
            return apiFactory ? apiFactory.createApi(options) : undefined;
        } else {
            const minApiVersion: string | null = semver.minSatisfying(apiVersions, '');
            let message: string;
            let code: ApiVersionCode;
            if (minApiVersion && semver.gtr(minApiVersion, apiVersionRange)) {
                // This case will hopefully never happen if we maintain backwards compat
                message = localize('notSupported', 'API version "{0}" for extension id "{1}" is no longer supported. Minimum version is "{2}".', apiVersionRange, extensionId, minApiVersion);
                code = 'NoLongerSupported';
            } else {
                // This case is somewhat likely - so keep the error message simple and just tell user to update their extenion
                message = localize('updateExtension', 'Extension dependency with id "{0}" must be updated.', extensionId);
                code = 'NotYetSupported';
            }

            throw new ApiVersionError(message, code);
        }
    });
}
