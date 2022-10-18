/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { IActionContext, AzExtResourceType, QuickPickWizardContext } from "./index";
import * as vscode from 'vscode';
import type { Environment } from '@azure/ms-rest-azure-env';
import { AzureExtensionApi } from "./api";

export declare interface ApplicationAuthentication {
    getSession(scopes?: string[]): vscode.ProviderResult<vscode.AuthenticationSession>;
}

/**
 * Information specific to the Subscription
 */
export interface ApplicationSubscription {
    readonly authentication: ApplicationAuthentication;
    readonly displayName: string;
    readonly subscriptionId: string;
    readonly subscriptionPath: string;
    readonly tenantId: string;
    readonly environment: Environment;
    readonly isCustomCloud: boolean;
}

export declare interface ResourceBase {
    readonly id: string;
    readonly name: string;
}

export declare interface ApplicationResourceType {
    readonly type: string;
    readonly kinds?: string[];
}

/**
 * Represents an individual resource in Azure.
 * @remarks The `id` property is expected to be the Azure resource ID.
 */
export declare interface ApplicationResource extends ResourceBase {
    readonly subscription: ApplicationSubscription;
    readonly type: ApplicationResourceType;
    readonly azExtResourceType?: AzExtResourceType;
    readonly location?: string;
    readonly resourceGroup?: string;
    /** Resource tags */
    readonly tags?: {
        [propertyName: string]: string;
    };
    /* add more properties from GenericResource if needed */
}

/**
 * Describes command callbacks for tree node context menu commands
 */
export declare type TreeNodeCommandCallback<T> = (context: IActionContext, node?: T, nodes?: T[], ...args: any[]) => any;

export declare interface PickSubscriptionWizardContext extends QuickPickWizardContext {
    subscription?: ApplicationSubscription;
}

export declare interface AzureResourceQuickPickWizardContext extends QuickPickWizardContext, PickSubscriptionWizardContext {
    resource?: ApplicationResource;
    resourceGroup?: string;
}

export interface V2AzureResourcesApi extends AzureExtensionApi {
    readonly applicationResourceTreeDataProvider: vscode.TreeDataProvider<unknown>;
    readonly workspaceResourceTreeDataProvider: vscode.TreeDataProvider<unknown>;
}
