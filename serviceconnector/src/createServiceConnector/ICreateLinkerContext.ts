/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AuthInfoBase, KnownClientType, LinkerResource } from "@azure/arm-servicelinker";
import { IStorageAccountWizardContext } from "@microsoft/vscode-azext-azureutils";
import { ISubscriptionActionContext } from "@microsoft/vscode-azext-utils";
import { TargetServiceType } from "../../constants";

export interface ICreateLinkerContext extends ISubscriptionActionContext, IStorageAccountWizardContext {
    //Source resource
    sourceResourceUri?: string;
    scope?: string; //this is only assigned when the source resource is a container app to indicate which container is being connected
    clientType?: KnownClientType;

    //Target service
    targetServiceType?: TargetServiceType;

    //Service connector
    authType?: AuthInfoBase;
    linkerName?: string;
    linker?: LinkerResource;
}
