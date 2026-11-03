/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function isSettingConnectionString(key: string, value: string): boolean {
    if (!value || value === 'UseDevelopmentStorage=true' || key === 'DEPLOYMENT_STORAGE_CONNECTION_STRING') {
        return false;
    }

    if ((/DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=[^;]+/).test(value)) {
        return true;
    }

    const fields = value.split(';');
    return fields.some((field, index) => {
        const isServiceBus = /Endpoint=sb:\/\/[\s\S]/.test(field)
            && /^SharedAccessKeyName=[\s\S]/.test(fields[index + 1] ?? '')
            && /^SharedAccessKey=[\s\S]/.test(fields[index + 2] ?? '');
        const isCosmos = /AccountEndpoint=https:\/\/[\s\S]/.test(field)
            && /^AccountKey=[\s\S]/.test(fields[index + 1] ?? '')
            && index + 2 < fields.length;

        return isServiceBus || isCosmos;
    });
}
