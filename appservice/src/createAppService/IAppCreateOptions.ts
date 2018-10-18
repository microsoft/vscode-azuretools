/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NameValuePair } from "azure-arm-website/lib/models";

export interface IAppCreateOptions {
    resourceGroup?: string;
    os?: 'linux' | 'windows';
    advancedCreation?: boolean;
    runtime?: string;
    createFunctionAppSettings?(context: IAppSettingsContext): Promise<NameValuePair[]>;
}

export interface IAppSettingsContext {
    storageConnectionString: string;
    fileShareName: string;
    os: string;
    runtime: string;
}
