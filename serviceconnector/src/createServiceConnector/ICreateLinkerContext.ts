/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AuthInfoBase, LinkerResource } from "@azure/arm-servicelinker";
import { IStorageAccountWizardContext } from "@microsoft/vscode-azext-azureutils";
import { ISubscriptionActionContext } from "@microsoft/vscode-azext-utils";
import { ServiceType } from "../../constants";


export interface ICreateLinkerContext extends ISubscriptionActionContext, IStorageAccountWizardContext {
    //Source resource
    resourceUri?: string;
    scope?: string;
    clientType?: string;

    //Target service
    serviceType?: ServiceType;

    //Service connector
    authType?: AuthInfoBase;
    linkerName?: string;
    linker?: LinkerResource;
}
