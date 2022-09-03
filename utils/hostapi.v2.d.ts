import type { Environment } from '@azure/ms-rest-azure-env';
import * as vscode from 'vscode';
import { AzExtResourceType, AzExtTreeItem, IActionContext } from './index';

export interface ApplicationAuthentication {
    getSession(scopes?: string[]): vscode.ProviderResult<vscode.AuthenticationSession>;
}

/**
 * Information specific to the Subscription
 */
export interface ApplicationSubscription {
    readonly authentication: ApplicationAuthentication;
    readonly displayName: string;
    readonly subscriptionId: string;
    readonly environment: Environment;
    readonly isCustomCloud: boolean;
}

export interface ResourceBase {
    readonly id: string;
    readonly name: string;
}

export interface ApplicationResourceType {
    readonly type: string;
    readonly kinds?: string[];
}

/**
 * Represents an individual resource in Azure.
 * @remarks The `id` property is expected to be the Azure resource ID.
 */
export interface ApplicationResource extends ResourceBase {
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

export interface ResourceQuickPickOptions {
    readonly contextValues?: string[];
    readonly isLeaf?: boolean;
}

export interface ResourceModelBase {
    readonly quickPickOptions?: ResourceQuickPickOptions;
    readonly azureResourceId?: string;
}

//#region tree item picker types

type ContextValueFilterableTreeNodeV2 = {
    quickPickOptions: Required<ResourceQuickPickOptions>
}

export type ContextValueFilterableTreeNode = ContextValueFilterableTreeNodeV2 | AzExtTreeItem;

export type ResourceGroupsItem = ContextValueFilterableTreeNode;

export interface ContextValueFilter {
    /**
     * This filter will include items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    include: string | RegExp | (string | RegExp)[];

    /**
     * This filter will exclude items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    exclude?: string | RegExp | (string | RegExp)[];
}

//#endregion

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
export interface Box {
    unwrap<T>(): Promise<T>;
}

/**
 * Tests to see if something is a box, by ensuring it is an object
 * and has an "unwrap" function
 * @param maybeBox An object to test if it is a box
 * @returns True if a box, false otherwise
 */
export declare function isBox(maybeBox: unknown): maybeBox is Box;

/**
 * Describes command callbacks for tree node context menu commands
 */
export type TreeNodeCommandCallback<T> = (context: IActionContext, node?: T, nodes?: T[], ...args: any[]) => any;

/**
 * Used to register VSCode tree node context menu commands that are in the host extension's tree. It wraps your callback with consistent error and telemetry handling
 * Use debounce property if you need a delay between clicks for this particular command
 * A telemetry event is automatically sent whenever a command is executed. The telemetry event ID will default to the same as the
 *   commandId passed in, but can be overridden per command with telemetryId
 * The telemetry event for this command will be named telemetryId if specified, otherwise it defaults to the commandId
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export declare function registerCommandWithTreeNodeUnboxing<T>(commandId: string, callback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void;
