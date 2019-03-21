/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IAppCreateOptions {
    resourceGroup?: string;
    os?: 'linux' | 'windows';
    advancedCreation?: boolean;
    runtime?: string;
}
