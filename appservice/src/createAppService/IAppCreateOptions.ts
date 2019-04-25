/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SkuDescription } from "azure-arm-website/lib/models";
import { IActionContext } from "vscode-azureextensionui";
import { LinuxRuntimes } from "./AppKind";

export interface IAppCreateOptions {
    actionContext?: IActionContext;
    resourceGroup?: string;
    os?: 'linux' | 'windows';
    advancedCreation?: boolean;
    runtime?: string;
    location?: string;
    recommendedSiteRuntime?: LinuxRuntimes[];
    planSku? : SkuDescription;
}
