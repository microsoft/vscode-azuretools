/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { ContextValueFilterableTreeNode, IActionContext, QuickPickWizardContext } from "./index";
import * as vscode from 'vscode';
import type { Environment } from '@azure/ms-rest-azure-env';
import { AzExtResourceType } from "./src/AzExtResourceType";

export declare interface ApplicationAuthentication {
    getSession(scopes?: string[]): vscode.ProviderResult<vscode.AuthenticationSession>;
}

/**
 * Information specific to the Subscription
 */
export declare interface ApplicationSubscription {
    readonly authentication: ApplicationAuthentication;
    readonly displayName: string;
    readonly subscriptionId: string;
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
 * Interface describing an object that wraps another object.
 *
 * The host extension will wrap all tree nodes provided by the client
 * extensions. When commands are executed, the wrapper objects are
 * sent directly to the client extension, which will need to unwrap
 * them. The `registerCommandWithTreeNodeUnboxing` method below, used
 * in place of `registerCommand`, will intelligently do this
 * unboxing automatically (i.e., will not unbox if the arguments
 * aren't boxes)
 */
export declare interface Box {
    unwrap<T>(): T;
}

/**
 * Describes command callbacks for tree node context menu commands
 */
export declare type TreeNodeCommandCallback<T> = (context: IActionContext, node?: T, nodes?: T[], ...args: any[]) => any;

// temporary type until we have the real type from RGs
export declare type ResourceGroupsItem = ContextValueFilterableTreeNode;

export declare interface AzureResourceQuickPickWizardContext extends QuickPickWizardContext<ResourceGroupsItem> {
    subscription?: ApplicationSubscription;
    resource?: ApplicationResource;
    resourceGroup?: string;
}
