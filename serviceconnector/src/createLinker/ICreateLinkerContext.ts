/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AuthInfoBase, KnownClientType, LinkerResource } from "@azure/arm-servicelinker";
import { IStorageAccountWizardContext } from "@microsoft/vscode-azext-azureutils";
import { ExecuteActivityContext, IAzureQuickPickItem, ISubscriptionActionContext } from "@microsoft/vscode-azext-utils";
import { TargetServiceType } from "../../constants";
import { DatabaseAccountJsonResponse } from "./CosmosDBAccountListStep";
import { KeyVaultAccountJsonResponse } from "./KeyVaultListStep";

export interface ICreateLinkerContext extends ISubscriptionActionContext, IStorageAccountWizardContext, ExecuteActivityContext {
    //Source resource
    sourceResourceUri?: string;
    /** This is only assigned when the source resource is a container app to indicate which container is being connected */
    scope?: string;
    /** This is only assigned when the source resource is a web app */
    runtime?: KnownClientType[];
    clientType?: KnownClientType;

    //Target service
    targetServiceType?: TargetServiceType;
    targetService?: IAzureQuickPickItem<TargetServiceType>;
    databaseAccount?: DatabaseAccountJsonResponse;
    keyVaultAccount?: KeyVaultAccountJsonResponse;

    //Service connector
    authType?: AuthInfoBase;
    linkerName?: string;
    linker?: LinkerResource;
}
