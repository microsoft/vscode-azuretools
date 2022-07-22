/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Environment } from '@azure/ms-rest-azure-env';
import { CancellationToken, CancellationTokenSource, Disposable, Event, ExtensionContext, FileChangeEvent, FileChangeType, FileStat, FileSystemProvider, FileType, InputBoxOptions, MarkdownString, MessageItem, MessageOptions, OpenDialogOptions, OutputChannel, Progress, QuickPickItem, QuickPickOptions, TextDocumentShowOptions, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeView, Uri } from 'vscode';
import { TargetPopulation } from 'vscode-tas-client';
import { AzureExtensionApi, AzureExtensionApiProvider } from './api';
import type { Activity, ActivityTreeItemOptions, AppResource, OnErrorActivityData, OnProgressActivityData, OnStartActivityData, OnSuccessActivityData } from './hostapi'; // This must remain `import type` or else a circular reference will result

export declare interface RunWithTemporaryDescriptionOptions {
    description: string;
    /**
     * If true, runWithTemporaryDescription will not call refresh or refreshUIOnly on the tree item.
     */
    softRefresh?: boolean;
}

/**
 * Tree Data Provider for an *Az*ure *Ext*ension
 */
export declare class AzExtTreeDataProvider implements TreeDataProvider<AzExtTreeItem> {
    public onDidChangeTreeData: Event<AzExtTreeItem | undefined>;
    public onTreeItemCreate: Event<AzExtTreeItem>;

    /**
     * Fired when a tree item is expanded, or the view is refreshed and that tree item is auto-expanded by VSCode. Note, this event cannot be accessed unless `trackTreeItemCollapsibleState` is called first!
     */
    public onDidExpandOrRefreshExpandedTreeItem: Event<AzExtTreeItem>;

    /**
     * Azure Tree Data Provider
     * @param rootTreeItem The root tree item. This item will not actually be displayed - just used to provide children.
     * @param loadMoreCommandId The command your extension will register for the 'Load More...' tree item
     */
    public constructor(rootTreeItem: AzExtParentTreeItem, loadMoreCommandId: string);

    /**
     * Should not be called directly
     */
    public getTreeItem(treeItem: AzExtTreeItem): TreeItem;

    /**
     * Should not be called directly
     */
    public getChildren(treeItem?: AzExtParentTreeItem): Promise<AzExtTreeItem[]>;

    /**
     * Refreshes the tree
     * @param treeItem The treeItem to refresh or 'undefined' to refresh the whole tree
     */
    public refresh(context: IActionContext, treeItem?: AzExtTreeItem): Promise<void>;

    /**
     * Refreshes only the tree UI so `refreshImpl` is not called and setCache is not set to true
     * @param treeItem The treeItem to refresh or 'undefined' to refresh the whole tree
     */
    public refreshUIOnly(treeItem: AzExtTreeItem | undefined): void

    /**
     * Loads more children for a specific tree item
     * @param treeItem the load more tree item
     * @param context The action context
     */
    public loadMore(treeItem: AzExtTreeItem, context: IActionContext): Promise<void>;

    /**
     * Used to traverse the tree with a quick pick at each level. Primarily for command palette support
     * @param expectedContextValues a single context value or multiple matching context values matching the desired tree items
     * @param context The action context, with any additional user-defined properties that need to be passed along to `AzExtParentTreeItem.createChildImpl`
     * @param startingTreeItem An optional parameter to start the picker from somewhere other than the root of the tree
     */
    public showTreeItemPicker<T extends AzExtTreeItem>(expectedContextValues: string | RegExp | (string | RegExp)[], context: ITreeItemPickerContext & { canPickMany: true }, startingTreeItem?: AzExtTreeItem): Promise<T[]>;
    public showTreeItemPicker<T extends AzExtTreeItem>(expectedContextValues: string | RegExp | (string | RegExp)[], context: ITreeItemPickerContext, startingTreeItem?: AzExtTreeItem): Promise<T>;

    /**
     * Traverses a tree to find a node matching the given fullId of a tree item
     * @param fullId The full ID of the tree item
     * @param context The action context
     */
    public findTreeItem<T extends AzExtTreeItem>(fullId: string, context: IFindTreeItemContext): Promise<T | undefined>;

    /**
     * Optional method to return the parent of `element`.
     * Return `null` or `undefined` if `element` is a child of root.
     *
     * **NOTE:** This method should be implemented in order to access [reveal](#TreeView.reveal) API.
     *
     * @param element The element for which the parent has to be returned.
     * @return Parent of `element`.
     */
    public getParent(treeItem: AzExtTreeItem): Promise<AzExtTreeItem | undefined>;

    /**
     * Call to track the collapsible state of tree items in the tree view.
     * @param treeView The tree view to watch the collapsible state for. This must be the tree view created from this `AzExtTreeDataProvider`.
     */
    public trackTreeItemCollapsibleState(treeView: TreeView<AzExtTreeItem>): Disposable;
}

export interface ILoadingTreeContext extends IActionContext {
    /**
     * A custom message to overwrite the default message while loading
     */
    loadingMessage?: string;

    /**
     * Number of seconds to delay before showing the progress message (default is 2)
     * This is meant to avoid flashing a progress message in cases where it takes less than 2 seconds to load everything
     */
    loadingMessageDelay?: number;
}

export interface IFindTreeItemContext extends ILoadingTreeContext {
    /**
     * If true, this will load all children when searching for the tree item
     */
    loadAll?: boolean;
}

export interface ITreeItemPickerContext extends IActionContext {
    /**
     * If set to true, the last (and _only_ the last) stage of the tree item picker will show a multi-select quick pick
     */
    canPickMany?: boolean;

    /**
     * If set to true, the 'Create new...' pick will not be displayed.
     * For example, this could be used when the command deletes a tree item.
     */
    suppressCreatePick?: boolean;

    /**
     * If set to true, the quick pick dialog will not close when focus moves out. Defaults to `true`.
     */
    ignoreFocusOut?: boolean;

    /**
     * When no item is available for user to pick, this message will be displayed in the error notification.
     * This will also suppress the report issue button.
     */
    noItemFoundErrorMessage?: string;
}

/**
 * Loose type to use for T1 and T2 versions of "@azure/ms-rest-js".  The Azure Account extension returns
 * credentials that will satisfy both T1 and T2 requirements
 */
export type AzExtServiceClientCredentials = AzExtServiceClientCredentialsT1 & AzExtServiceClientCredentialsT2;

/**
 * Loose interface to allow for the use of different versions of "@azure/ms-rest-js"
 * There's several cases where we don't control which "credentials" interface gets used, causing build errors even though the functionality itself seems to be compatible
 * For example: https://github.com/Azure/azure-sdk-for-js/issues/10045
 * Used specifically for T1 Azure SDKs
 */
export interface AzExtServiceClientCredentialsT1 {
    /**
     * Signs a request with the Authentication header.
     *
     * @param {WebResourceLike} webResource The WebResourceLike/request to be signed.
     * @returns {Promise<WebResourceLike>} The signed request object;
     */
    signRequest(webResource: any): Promise<any>;
}

/**
 * Loose interface to allow for the use of different versions of "@azure/ms-rest-js"
 * Used specifically for T2 Azure SDKs
 */
export interface AzExtServiceClientCredentialsT2 {
    /**
     * Gets the token provided by this credential.
     *
     * This method is called automatically by Azure SDK client libraries. You may call this method
     * directly, but you must also handle token caching and token refreshing.
     *
     * @param scopes - The list of scopes for which the token will have access.
     * @param options - The options used to configure any requests this
     *                TokenCredential implementation might make.
     */
    getToken(scopes?: string | string[], options?: any): Promise<any | null>;
}

/**
 * Information specific to the Subscription
 */
export interface ISubscriptionContext {
    credentials: AzExtServiceClientCredentials;
    subscriptionDisplayName: string;
    subscriptionId: string;
    subscriptionPath: string;
    tenantId: string;
    userId: string;
    environment: Environment;
    isCustomCloud: boolean;
}

export type TreeItemIconPath = string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;


/**
 * AzExtTreeItem properties that can be called but should not be overridden
 */
export interface SealedAzExtTreeItem {
    /**
     * This id represents the effective/serializable full id of the item in the tree. It always starts with the parent's fullId and ends with either the AzExtTreeItem.id property (if implemented) or AzExtTreeItem.label property
     * This is used for AzureTreeDataProvider.findTreeItem and openInPortal
     */
    readonly fullId: string;
    readonly parent?: AzExtParentTreeItem;
    readonly treeDataProvider: AzExtTreeDataProvider;

    /**
     * The subscription information for this branch of the tree
     * Throws an error if this branch of the tree is not actually for Azure resources
     */
    readonly subscription: ISubscriptionContext;

    /**
     * Values to mask in error messages whenever an action uses this tree item
     * NOTE: Some values are automatically masked without the need to add anything here, like the label and parts of the id if it's an Azure id
     */
    readonly valuesToMask: string[];

    /**
     * If the `AzExtTreeDataProvider.trackTreeItemCollapsibleState` has been called, this should return the true TreeItemCollapsibleState
     * Otherwise, it will return whatever initial value is given
     */
    readonly collapsibleState: TreeItemCollapsibleState | undefined;

    /**
     * Set to true if the label of this tree item does not need to be masked
     */
    suppressMaskLabel?: boolean;

    /**
     * Refresh this node in the tree
     */
    refresh(context: IActionContext): Promise<void>;

    /**
     * This class wraps deleteTreeItemImpl and ensures the tree is updated correctly when an item is deleted
     */
    deleteTreeItem(context: IActionContext): Promise<void>;

    /**
     * Displays a 'Loading...' icon and temporarily changes the item's description while `callback` is being run
     */
    runWithTemporaryDescription(context: IActionContext, description: string, callback: () => Promise<void>): Promise<void>;
    runWithTemporaryDescription(context: IActionContext, options: RunWithTemporaryDescriptionOptions, callback: () => Promise<void>): Promise<void>;
}

// AzExtTreeItem stuff we need them to implement

/**
 * AzExtTreeItem properties that can be overridden
 */
export interface AbstractAzExtTreeItem {

    id?: string;
    label: string;

    /**
     * Additional information about a tree item that is appended to the label with the format `label (description)`
     */
    description?: string;

    iconPath?: TreeItemIconPath;
    commandId?: string;
    tooltip?: string;

    initialCollapsibleState?: TreeItemCollapsibleState;

    /**
     * The arguments to pass in when executing `commandId`. If not specified, this tree item will be used.
     */
    commandArgs?: unknown[];
    contextValue: string;

    /**
      * Implement this to display child resources. Should not be called directly
      * @param clearCache If true, you should start the "Load more..." process over
      * @param context The action context
      */
    loadMoreChildrenImpl?(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;

    /**
    * Implement this as a part of the "Load more..." action. Should not be called directly
    * @returns 'true' if there are more children and a "Load more..." node should be displayed
    */
    hasMoreChildrenImpl?(): boolean;

    /**
     * Implement this if you want the 'create' option to show up in the tree picker. Should not be called directly
     * @param context The action context and any additional user-defined options that are passed to the `AzExtParentTreeItem.createChild` or `AzExtTreeDataProvider.showTreeItemPicker`
     */
    createChildImpl?(context: ICreateChildImplContext): Promise<AzExtTreeItem>;

    /**
     * Override this if you want non-default (i.e. non-alphabetical) sorting of children. Should not be called directly
     * @param item1 The first item to compare
     * @param item2 The second item to compare
     * @returns A negative number if the item1 occurs before item2; positive if item1 occurs after item2; 0 if they are equivalent
     */
    compareChildrenImpl?(item1: AzExtTreeItem, item2: AzExtTreeItem): number;

    /**
    * If this treeItem should not show up in the tree picker or you want custom logic to show quick picks, implement this to provide a child that corresponds to the expectedContextValue. Should not be called directly
    * Otherwise, all children will be shown in the tree picker
    */
    pickTreeItemImpl?(expectedContextValues: (string | RegExp)[], context: IActionContext): AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>;

    /**
     * Implement this to support the 'delete' action in the tree. Should not be called directly
     */
    deleteTreeItemImpl?(context: IActionContext): Promise<void>;

    /**
     * Implement this to execute any async code when this node is refreshed. Should not be called directly
     */
    refreshImpl?(context: IActionContext): Promise<void>;

    /**
     * Optional function to filter items displayed in the tree picker. Should not be called directly
     * If not implemented, it's assumed that 'isAncestorOf' evaluates to true
     */
    isAncestorOfImpl?(contextValue: string | RegExp): boolean;

    /**
     * If implemented, resolves the tooltip at the time of hovering, and the value of the `tooltip` property is ignored. Otherwise, the `tooltip` property is used.
     */
    resolveTooltip?(): Promise<string | MarkdownString>;
}

export type IAzExtTreeItem = AbstractAzExtTreeItem & SealedAzExtTreeItem;

export interface IAzExtParentTreeItem extends IAzExtTreeItem {
    /**
      * Implement this to display child resources. Should not be called directly
      * @param clearCache If true, you should start the "Load more..." process over
      * @param context The action context
      */
    loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;

    /**
    * Implement this as a part of the "Load more..." action. Should not be called directly
    * @returns 'true' if there are more children and a "Load more..." node should be displayed
    */
    hasMoreChildrenImpl(): boolean;
}

/**
 * Base class for all tree items in an *Az*ure *ext*ension, even if those resources aren't actually in Azure.
 * This provides more value than `TreeItem` (provided by `vscode`)
 * NOTE: *Impl methods are not meant to be called directly - just implemented.
 */
export declare abstract class AzExtTreeItem implements IAzExtTreeItem {
    //#region Properties implemented by base class
    /**
     * This is is used for the openInPortal action. It is also used per the following documentation copied from VS Code:
     * Optional id for the treeItem that has to be unique across tree. The id is used to preserve the selection and expansion state of the treeItem.
     *
     * If not provided, an id is generated using the treeItem's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
    */
    public set id(id: string | undefined)
    public get id(): string | undefined;
    public abstract label: string;

    /**
     * Additional information about a tree item that is appended to the label with the format `label (description)`
     */
    public set description(desc: string | undefined)
    public get description(): string | undefined;

    public set iconPath(ip: TreeItemIconPath | undefined);
    public get iconPath(): TreeItemIconPath | undefined;

    public set commandId(id: string | undefined);
    public get commandId(): string | undefined;

    public set tooltip(tt: string | undefined);
    public get tooltip(): string | undefined;

    public get collapsibleState(): TreeItemCollapsibleState | undefined;

    /**
     * The arguments to pass in when executing `commandId`. If not specified, this tree item will be used.
     */
    public commandArgs?: unknown[];
    public abstract contextValue: string;
    //#endregion

    /**
     * This id represents the effective/serializable full id of the item in the tree. It always starts with the parent's fullId and ends with either the AzExtTreeItem.id property (if implemented) or AzExtTreeItem.label property
     * This is used for AzureTreeDataProvider.findTreeItem and openInPortal
     */
    public readonly fullId: string;
    public readonly parent?: AzExtParentTreeItem;
    public readonly treeDataProvider: AzExtTreeDataProvider;

    /**
     * The subscription information for this branch of the tree
     * Throws an error if this branch of the tree is not actually for Azure resources
     */
    public get subscription(): ISubscriptionContext;

    /**
     * Values to mask in error messages whenever an action uses this tree item
     * NOTE: Some values are automatically masked without the need to add anything here, like the label and parts of the id if it's an Azure id
     */
    public readonly valuesToMask: string[];

    /**
     * Set to true if the label of this tree item does not need to be masked
     */
    public suppressMaskLabel?: boolean;

    /**
     * @param parent The parent of the new tree item or 'undefined' if it is a root item
     */
    public constructor(parent: AzExtParentTreeItem | undefined);

    //#region Methods implemented by base class
    /**
     * Implement this to support the 'delete' action in the tree. Should not be called directly
     */
    public deleteTreeItemImpl?(context: IActionContext): Promise<void>;

    /**
     * Implement this to execute any async code when this node is refreshed. Should not be called directly
     */
    public refreshImpl?(context: IActionContext): Promise<void>;

    /**
     * Optional function to filter items displayed in the tree picker. Should not be called directly
     * If not implemented, it's assumed that 'isAncestorOf' evaluates to true
     */
    public isAncestorOfImpl?(contextValue: string | RegExp): boolean;
    //#endregion

    /**
     * Refresh this node in the tree
     */
    public refresh(context: IActionContext): Promise<void>;

    /**
     * This class wraps deleteTreeItemImpl and ensures the tree is updated correctly when an item is deleted
     */
    public deleteTreeItem(context: IActionContext): Promise<void>;

    /**
     * Displays a 'Loading...' icon and temporarily changes the item's description while `callback` is being run
     */
    public runWithTemporaryDescription(context: IActionContext, description: string, callback: () => Promise<void>): Promise<void>;
    public runWithTemporaryDescription(context: IActionContext, options: RunWithTemporaryDescriptionOptions, callback: () => Promise<void>): Promise<void>;

    /**
     * If implemented, resolves the tooltip at the time of hovering, and the value of the `tooltip` property is ignored. Otherwise, the `tooltip` property is used.
     */
    public resolveTooltip?(): Promise<string | MarkdownString>;
}

export interface IGenericTreeItemOptions {
    id?: string;
    label: string;
    description?: string;
    iconPath?: TreeItemIconPath;
    commandId?: string;
    contextValue: string;

    /**
     * If true, the tree item picker will execute `commandId`, refresh the tree, and re-prompt at the same level of the tree.
     * For example, if the command is "Sign in to Azure...", this will execute a sign-in, refresh the tree, and prompt again for subscriptions.
     * If `commandId` is not defined, it will throw an error.
     */
    includeInTreeItemPicker?: boolean;
}

/**
 * A convenience class used for very basic tree items
 */
export declare class GenericTreeItem extends AzExtTreeItem {
    public label: string;
    public contextValue: string;
    constructor(parent: AzExtParentTreeItem | undefined, options: IGenericTreeItemOptions);
}

export interface IInvalidTreeItemOptions {
    label: string;
    contextValue: string;

    /**
     * Defaults to "Invalid" if undefined
     */
    description?: string;

    /**
     * Any arbitrary data to include with this tree item
     */
    data?: unknown;
}

export declare class InvalidTreeItem extends AzExtParentTreeItem {
    public contextValue: string;
    public label: string;
    public get iconPath(): TreeItemIconPath;
    public readonly data?: unknown;

    constructor(parent: AzExtParentTreeItem, error: unknown, options: IInvalidTreeItemOptions);

    public loadMoreChildrenImpl(): Promise<AzExtTreeItem[]>;
    public hasMoreChildrenImpl(): boolean;
}

/**
 * Base class for all parent tree items in an *Az*ure *ext*ension, even if those resources aren't actually in Azure.
 * This provides more value than `TreeItem` (provided by `vscode`)
 * NOTE: *Impl methods are not meant to be called directly - just implemented.
 */
export declare abstract class AzExtParentTreeItem extends AzExtTreeItem implements IAzExtParentTreeItem {
    //#region Properties implemented by base class
    /**
     * This will be used in the tree picker prompt when selecting children
     */
    childTypeLabel?: string;


    /**
     * If true and there is only one child node, that child will automatically be used in the tree item picker.
     * Otherwise, it will prompt for a child like normal.
     */
    autoSelectInTreeItemPicker?: boolean;

    /**
     * If true, an advanced creation pick will be shown in the tree item picker
     */
    supportsAdvancedCreation?: boolean;

    /**
     * If specified, this will be shown instead of the default message `Create new ${this.childTypeLabel}...` in the tree item picker
     */
    createNewLabel?: string;
    //#endregion

    /**
     * Sets the initial collapsible state.
     */
    public readonly initialCollapsibleState: TreeItemCollapsibleState | undefined;

    //#region Methods implemented by base class
    /**
     * Implement this to display child resources. Should not be called directly
     * @param clearCache If true, you should start the "Load more..." process over
     * @param context The action context
     */
    public abstract loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;

    /**
     * Implement this as a part of the "Load more..." action. Should not be called directly
     * @returns 'true' if there are more children and a "Load more..." node should be displayed
     */
    public abstract hasMoreChildrenImpl(): boolean;

    /**
     * Implement this if you want the 'create' option to show up in the tree picker. Should not be called directly
     * @param context The action context and any additional user-defined options that are passed to the `AzExtParentTreeItem.createChild` or `AzExtTreeDataProvider.showTreeItemPicker`
     */
    createChildImpl?(context: ICreateChildImplContext): Promise<AzExtTreeItem>;

    /**
     * Override this if you want non-default (i.e. non-alphabetical) sorting of children. Should not be called directly
     * @param item1 The first item to compare
     * @param item2 The second item to compare
     * @returns A negative number if the item1 occurs before item2; positive if item1 occurs after item2; 0 if they are equivalent
     */
    compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number;

    /**
     * If this treeItem should not show up in the tree picker or you want custom logic to show quick picks, implement this to provide a child that corresponds to the expectedContextValue. Should not be called directly
     * Otherwise, all children will be shown in the tree picker
     */
    pickTreeItemImpl?(expectedContextValues: (string | RegExp)[], context: IActionContext): AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>;
    //#endregion

    /**
     * Used to ensure a single invalid object does not prevent display of other valid objects
     * Invalid objects will be shown with the error and the object's name. If the name cannot be determined for any invalid objects, a TreeItem will be added to the end with a generic label like "Some items cannot be displayed"
     * @param sourceArray The collection of source objects before converting to TreeItems
     * @param invalidContextValue The context value to use for invalid source objects
     * @param createTreeItem A function that converts a source object to a TreeItem. Return undefined if you want this object to be skipped.
     * @param getLabelOnError A minimal function that gets the label to display for an invalid source object
     */
    createTreeItemsWithErrorHandling<TSource>(
        sourceArray: TSource[] | undefined | null,
        invalidContextValue: string,
        createTreeItem: (source: TSource) => AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>,
        getLabelOnError: (source: TSource) => string | undefined | Promise<string | undefined>): Promise<AzExtTreeItem[]>;

    /**
     * This class wraps createChildImpl and ensures the tree is updated correctly when an item is created
     * @param context The action context, with any additional user-defined properties that need to be passed along to `AzExtParentTreeItem.createChildImpl`
     */
    createChild<T extends AzExtTreeItem>(context: IActionContext): Promise<T>;

    /**
     * Get the currently cached children for this tree item. This will load the first batch if they have not been loaded yet.
     * @param context The action context
     */
    getCachedChildren(context: IActionContext): Promise<AzExtTreeItem[]>;

    /**
     * Loads all children and displays a progress notification allowing the user to cancel.
     * @throws `UserCancelledError` if the user cancels.
     */
    loadAllChildren(context: ILoadingTreeContext): Promise<AzExtTreeItem[]>;
}

export interface ICreateChildImplContext extends IActionContext {
    /**
     * Call this function to show a "Creating..." item in the tree while the create is in progress
     */
    showCreatingTreeItem(label: string): void;

    /**
     * Indicates advanced creation should be used
     */
    advancedCreation?: boolean;
}

export declare class UserCancelledError extends Error {
    constructor(stepName?: string);
}

export declare class NoResourceFoundError extends Error { }

export type CommandCallback = (context: IActionContext, ...args: any[]) => any;

/**
 * Used to register VSCode commands. It wraps your callback with consistent error and telemetry handling
 * Use debounce property if you need a delay between clicks for this particular command
 * A telemetry event is automatically sent whenever a command is executed. The telemetry event ID will default to the same as the
 *   commandId passed in, but can be overridden per command with telemetryId
 * The telemetry event for this command will be named telemetryId if specified, otherwise it defaults to the commandId
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export declare function registerCommand(commandId: string, callback: CommandCallback, debounce?: number, telemetryId?: string): void;

/**
 * Used to register VSCode events. It wraps your callback with consistent error and telemetry handling
 * NOTE #1: By default, this sends a telemetry event every single time the event fires. It it recommended to use 'context.telemetry.suppressIfSuccessful' to only send events if they apply to your extension
 * NOTE #2: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export declare function registerEvent<T>(eventId: string, event: Event<T>, callback: (context: IActionContext, ...args: any[]) => any): void;

/**
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export declare function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (context: IActionContext) => T | PromiseLike<T>): Promise<T | undefined>;

/**
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export declare function callWithTelemetryAndErrorHandlingSync<T>(callbackId: string, callback: (context: IActionContext) => T): T | undefined;

/**
 * Used to mask values in error messages to protect user's confidential information from displaying in output and telemetry
 */
export declare function callWithMaskHandling<T>(callback: () => Promise<T>, valueToMask: string): Promise<T>;

/**
 * Add an extension-wide value to mask for all commands
 * This will apply to telemetry and "Report Issue", but _not_ VS Code UI (i.e. the error notification or output channel)
 * IMPORTANT: For the most sensitive information, `callWithMaskHandling` should be used instead
 */
export declare function addExtensionValueToMask(...values: (string | undefined)[]): void;

/**
 * A generic context object that describes the behavior of an action and allows for specifying custom telemetry properties and measurements
 * You may also extend this object if you need to pass along custom properties through things like a wizard or tree item picker
 */
export interface IActionContext {
    /**
     * Describes the behavior of telemetry for this action
     */
    telemetry: ITelemetryContext;

    /**
     * Describes the behavior of error handling for this action
     */
    errorHandling: IErrorHandlingContext;

    /**
     * Custom implementation of common methods that handle user input (as opposed to using `vscode.window`)
     * Provides additional functionality to support wizards, grouping, 'recently used', telemetry, etc.
     * For more information, see the docs on each method and on each `options` object
     */
    ui: IAzureUserInput;

    /**
     * Add a value to mask for this action
     * This will apply to telemetry and "Report Issue", but _not_ VS Code UI (i.e. the error notification or output channel)
     * IMPORTANT: For the most sensitive information, `callWithMaskHandling` should be used instead
     */
    valuesToMask: string[];
}

export interface ITelemetryContext {
    /**
     * Custom properties that will be included in telemetry
     */
    properties: TelemetryProperties;

    /**
     * Custom measurements that will be included in telemetry
     */
    measurements: TelemetryMeasurements;

    /**
     * Defaults to `false`. If true, successful events are suppressed from telemetry, but cancel and error events are still sent.
     */
    suppressIfSuccessful?: boolean;

    /**
     * Defaults to `false`. If true, all events are suppressed from telemetry.
     */
    suppressAll?: boolean;

    /**
     * If true, any error message for this event will not be tracked in telemetry
     */
    maskEntireErrorMessage?: boolean;

    /**
     * Will be appended to the end of the telemetry event name if specified. This is typically used when the original event has been suppressed/retired for some reason
     */
    eventVersion?: number;
}

export interface AzExtErrorButton extends MessageItem {
    /**
     * To be called if the button is clicked
     */
    callback: () => Promise<void>;
}

export interface IErrorHandlingContext {
    /**
     * Defaults to `false`. If true, does not display this error to the user and does not include it in the "Report Issue" command.
     */
    suppressDisplay?: boolean;

    /**
     * Defaults to `false`. If true, re-throws error outside the context of this action.
     */
    rethrow?: boolean;

    /**
     * Defaults to `false`. If true, does not show the "Report Issue" button in the error notification.
     */
    suppressReportIssue?: boolean;

    /**
     * Defaults to `false`. If true, this error will be included in the "Report Issue" command regardless of `suppressDisplay`
     */
    forceIncludeInReportIssueCommand?: boolean;

    /**
     * Additional buttons to include in error notification besides "Report an Issue"
     */
    buttons?: AzExtErrorButton[];

    /**
     * Custom properties that will be included in any error reports generated during this action
     */
    issueProperties: { [key: string]: string | undefined };
}

export interface TelemetryProperties {
    /**
     * Defaults to `false`
     * This is used to more accurately track usage, since activation events generally shouldn't 'count' as usage
     */
    isActivationEvent?: 'true' | 'false';
    result?: 'Succeeded' | 'Failed' | 'Canceled';
    error?: string;
    errorMessage?: string;

    /**
     * @deprecated Specify a stepName in the constructor of `UserCancelledError` or on `AzExtUserInputOptions` instead
     */
    cancelStep?: string;

    /**
     * The last step attempted regardless of the result of the action. Will be automatically set in most cases
     */
    lastStep?: string;

    [key: string]: string | undefined;
}

export interface TelemetryMeasurements {
    duration?: number;
    [key: string]: number | undefined;
}

export interface IHandlerContext extends IActionContext {
    /**
     * The id for the callback, used as the id for the telemetry event. This may be modified by any handler
     */
    callbackId: string;
}

export interface IErrorHandlerContext extends IHandlerContext {
    /**
     * The error to be handled. This may be modified by any handler
     */
    error: unknown;
}

export type ErrorHandler = (context: IErrorHandlerContext) => void;

export type TelemetryHandler = (context: IHandlerContext) => void;

export type OnActionStartHandler = (context: IHandlerContext) => void;

/**
 * Register a handler to run right after an `IActionContext` is created and before the action starts
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export declare function registerOnActionStartHandler(handler: OnActionStartHandler): Disposable;

/**
 * Register a handler to run after a callback errors out, but before the default error handling.
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export declare function registerErrorHandler(handler: ErrorHandler): Disposable;

/**
 * Register a handler to run after a callback finishes, but before the default telemetry handling.
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export declare function registerTelemetryHandler(handler: TelemetryHandler): Disposable;

export declare function parseError(error: any): IParsedError;

export interface IParsedError {
    errorType: string;
    message: string;
    stack?: string;
    stepName?: string;
    isUserCancelledError: boolean;
}

export type PromptResult = {
    value: string | QuickPickItem | QuickPickItem[] | MessageItem | Uri[];

    /**
     * True if the user did not change from the default value, currently only supported for `showInputBox`
     */
    matchesDefault?: boolean;
};

/**
 * Wrapper interface of several methods that handle user input
 * The implementations of this interface are accessed through `IActionContext.ui` or `TestActionContext.ui` (in the "@microsoft/vscode-azext-dev" package)
 */
export interface IAzureUserInput {
    readonly onDidFinishPrompt: Event<PromptResult>;

    /**
    * Shows a multi-selection list.
    *
    * @param items An array of items, or a promise that resolves to an array of items.
    * @param options Configures the behavior of the selection list.
    * @throws `UserCancelledError` if the user cancels.
    * @return A promise that resolves to an array of items the user picked.
    */
    showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions & { canPickMany: true }): Promise<T[]>;

    /**
      * Shows a selection list.
      * Automatically persists the 'recently used' item and displays that at the top of the list
      *
      * @param items An array of items, or a promise that resolves to an array of items.
      * @param options Configures the behavior of the selection list.
      * @throws `UserCancelledError` if the user cancels.
      * @return A promise that resolves to the item the user picked.
      */
    showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions): Promise<T>;

    /**
     * Opens an input box to ask the user for input.
     *
     * @param options Configures the behavior of the input box.
     * @throws `UserCancelledError` if the user cancels.
     * @return A promise that resolves to a string the user provided.
     */
    showInputBox(options: AzExtInputBoxOptions): Promise<string>;

    /**
     * Show a warning message.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @throws `UserCancelledError` if the user cancels.
     * @return A thenable that resolves to the selected item when being dismissed.
     */
    showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;

    /**
     * Show a warning message.
     *
     * @param message The message to show.
     * @param options Configures the behavior of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @throws `UserCancelledError` if the user cancels.
     * @return A thenable that resolves to the selected item when being dismissed.
     */
    showWarningMessage<T extends MessageItem>(message: string, options: IAzureMessageOptions, ...items: T[]): Promise<T>;

    /**
     * Shows a file open dialog to the user which allows to select a file
     * for opening-purposes.
     *
     * @param options Options that control the dialog.
     * @throws `UserCancelledError` if the user cancels.
     * @returns A promise that resolves to the selected resources.
     */
    showOpenDialog(options: AzExtOpenDialogOptions): Promise<Uri[]>;
}

/**
 * Common options used for all user input in Azure Extensions
 */
export interface AzExtUserInputOptions {
    /**
     * Optional step name to be used in telemetry
     */
    stepName?: string;
}

/**
 * Specifies the sort priority of a quick pick item
 */
export type AzureQuickPickItemPriority = 'highest' | 'normal'; // 'highest' items come before the recently used item

/**
 * Provides additional options for QuickPickItems used in Azure Extensions
 */
export interface IAzureQuickPickItem<T = undefined> extends QuickPickItem {
    /**
     * An optional id to uniquely identify this item across sessions, used in persisting previous selections
     * If not specified, a hash of the label will be used
     */
    id?: string;

    data: T;

    /**
     * Callback to use when this item is picked, instead of returning the pick
     * This is not compatible with `canPickMany`
     */
    onPicked?: () => void | Promise<void>;

    /**
     * The group that this pick belongs to. Set `IAzureQuickPickOptions.enableGrouping` for this property to take effect
     */
    group?: string;

    /**
     * Optionally used to suppress persistence for this item, defaults to `false`
     */
    suppressPersistence?: boolean;

    /**
     * Optionally allows some items to be automatically sorted at the top of the list
     */
    priority?: AzureQuickPickItemPriority;
}

/**
 * Provides additional options for QuickPicks used in Azure Extensions
 */
export interface IAzureQuickPickOptions extends QuickPickOptions, AzExtUserInputOptions {
    /**
     * An optional id to identify this QuickPick across sessions, used in persisting previous selections
     * If not specified, a hash of the placeHolder will be used
     */
    id?: string;

    /**
     * Optionally used to suppress persistence for this quick pick, defaults to `false`
     */
    suppressPersistence?: boolean;

    /**
     * Optionally used to select default picks in a multi-select quick pick
     */
    isPickSelected?: (p: QuickPickItem) => boolean;

    /**
     * If true, you must specify a `group` property on each `IAzureQuickPickItem` and the picks will be grouped into collapsible sections
     * This is not compatible with `canPickMany`
     */
    enableGrouping?: boolean;

    /**
     * Optional message to display while the quick pick is loading instead of the normal placeHolder.
     */
    loadingPlaceHolder?: string;

    /**
     * Optional message to display when no picks are found
     */
    noPicksMessage?: string;

    /**
     * Optional property that will display a ? button in the quickpick window that opens a url when clicked
     */
    learnMoreLink?: string;
}

/**
 * Provides additional options for dialogs used in Azure Extensions
 */
export interface IAzureMessageOptions extends MessageOptions, AzExtUserInputOptions {
    /**
     * If specified, a "Learn more" button will be added to the dialog and it will re-prompt every time the user clicks "Learn more"
     */
    learnMoreLink?: string;
}

/**
 * Provides additional options for input boxes used in Azure Extensions
 */
export interface AzExtInputBoxOptions extends InputBoxOptions, AzExtUserInputOptions {
    /**
     * Optional property that will display a ? button in the input window that opens a url when clicked
     */
    learnMoreLink?: string;
}

/**
* Provides additional options for open dialogs used in Azure Extensions
*/
export interface AzExtOpenDialogOptions extends OpenDialogOptions, AzExtUserInputOptions { }

export interface IWizardOptions<T extends IActionContext> {
    /**
     * The steps to prompt for user input, in order
     */
    promptSteps?: AzureWizardPromptStep<T>[];

    /**
     * The steps to execute, in order
     */
    executeSteps?: AzureWizardExecuteStep<T>[];

    /**
     * A title used when prompting
     */
    title?: string;

    /**
     * If true, step count will not be displayed for the entire wizard. Defaults to false.
     */
    hideStepCount?: boolean;

    /**
    * If true, a loading prompt will be displayed if there are long delays between wizard steps.
    */
    showLoadingPrompt?: boolean;
}

export type ActivityTask<R> = (progress: Progress<{ message?: string, increment?: number }>, cancellationToken: CancellationToken) => Promise<R>;

export declare abstract class ActivityBase<R> implements Activity {
    public readonly onStart: Event<OnStartActivityData>;
    public readonly onProgress: Event<OnProgressActivityData>;
    public readonly onSuccess: Event<OnSuccessActivityData>;
    public readonly onError: Event<OnErrorActivityData>;

    public readonly task: ActivityTask<R>;
    public readonly id: string;
    public readonly cancellationTokenSource: CancellationTokenSource;

    abstract initialState(): ActivityTreeItemOptions;
    abstract successState(): ActivityTreeItemOptions;
    abstract errorState(error: IParsedError): ActivityTreeItemOptions;

    public constructor(task: ActivityTask<R>);
    public report(progress: { message?: string; increment?: number }): void;
    public run(): Promise<void>;
}

/**
 * A wizard that links several user input steps together
 */
export declare class AzureWizard<T extends IActionContext & Partial<ExecuteActivityContext>> {
    /**
     * @param wizardContext  A context object that should be used to pass information between steps
     * @param options Options describing this wizard
     */
    public constructor(wizardContext: T, options: IWizardOptions<T>);

    public prompt(): Promise<void>;
    public execute(): Promise<void>;
}

export declare interface ExecuteActivityContext {
    registerActivity: (activity: Activity) => Promise<void>;
    /**
     * Becomes label of activity tree item, defaults to wizard title or "Azure Activity"
     */
    activityTitle?: string;
    /**
     * Set to show a "Click to view resource" child on success.
     */
    activityResult?: AppResource;
    /**
     * Hide activity notifications
     */
    suppressNotification?: boolean;
}

export declare abstract class AzureWizardExecuteStep<T extends IActionContext> {
    /**
     * The priority of this step. A smaller value will be executed first.
     */
    public abstract priority: number;

    /**
     * Optional id used to determine if this step is unique, for things like caching values and telemetry
     * If not specified, the class name will be used instead
     */
    public id?: string;

    /**
     * Execute the step
     */
    public abstract execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;

    /**
     * Return true if this step should execute based on the current state of the wizardContext
     * Used to prevent duplicate executions from sub wizards and unnecessary executions for values that had a default
     */
    public abstract shouldExecute(wizardContext: T): boolean;
}

export declare abstract class AzureWizardPromptStep<T extends IActionContext> {
    /**
     * If true, step count will not be displayed when prompting. Defaults to false.
     */
    public hideStepCount: boolean;

    /**
     * If true, multiple steps of the same type can be shown in a wizard. By default, duplicate steps are filtered out
     * NOTE: You can also use the `id` property to prevent a step from registering as a duplicate in the first place
     */
    public supportsDuplicateSteps: boolean;

    /**
     * Optional id used to determine if this step is unique, for things like caching values and telemetry
     * If not specified, the class name will be used instead
     */
    public id?: string;

    /**
     * Prompt the user for input
     */
    public abstract prompt(wizardContext: T): Promise<void>;

    /**
     * Optionally return a subwizard. This will be called after `prompt`
     */
    public getSubWizard?(wizardContext: T): Promise<IWizardOptions<T> | undefined>;

    /**
     * Return true if this step should prompt based on the current state of the wizardContext
     * Used to prevent duplicate prompts from sub wizards, unnecessary prompts for values that had a default, and to accurately describe the number of steps
     */
    public abstract shouldPrompt(wizardContext: T): boolean;
}

export type ISubscriptionActionContext = ISubscriptionContext & IActionContext;

export interface IAzureNamingRules {
    minLength: number;
    maxLength: number;

    /**
     * A RegExp specifying the invalid characters.
     * For example, /[^a-z0-9]/ would specify that only lowercase, alphanumeric characters are allowed.
     */
    invalidCharsRegExp: RegExp;

    /**
     * Specify this if only lowercase letters are allowed
     * This is a separate property than `invalidCharsRegExp` because the behavior can be different.
     * For example, when generating a relatedName, we can convert uppercase letters to lowercase instead of just removing them.
     */
    lowercaseOnly?: boolean;
}

export interface IRelatedNameWizardContext extends IActionContext {
    /**
     * A task that evaluates to the related name that should be used as the default for other new resources or undefined if a unique name could not be found
     * The task will be defined after `AzureNameStep.prompt` occurs.
     */
    relatedNameTask?: Promise<string | undefined>;
}

/**
 * A generic class for a step that specifies the name of a new resource, used to generate a related name for other new resources.
 * You must implement `isRelatedNameAvailable` and assign `wizardContext.relatedNameTask` to the result of `generateRelatedName`
 */
export declare abstract class AzureNameStep<T extends IRelatedNameWizardContext> extends AzureWizardPromptStep<T> {
    /**
     * This method will by called by `generateRelatedName` when trying to find a unique suffix for the related name
     * @param wizardContext The context of the wizard.
     * @param name The name that will be checked.
     */
    protected abstract isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean>;

    /**
     * Generates a related name for new resources
     * @param wizardContext The context of the wizard.
     * @param name The original name to base the related name on.
     * @param namingRules The rules that the name must adhere to. You may specify an array of rules if the related name will be used for multiple resource types.
     * @returns A name that conforms to the namingRules and has a numeric suffix attached to make the name unique, or undefined if a unique name could not be found
     */
    protected generateRelatedName(wizardContext: T, name: string, namingRules: IAzureNamingRules | IAzureNamingRules[]): Promise<string | undefined>;
}

/**
 * Common dialog responses used in Azure extensions
 */
export declare namespace DialogResponses {
    export const yes: MessageItem;
    export const no: MessageItem;
    export const cancel: MessageItem;
    export const deleteResponse: MessageItem;
    export const learnMore: MessageItem;
    export const dontWarnAgain: MessageItem;
    export const skipForNow: MessageItem;
    export const upload: MessageItem;
    export const alwaysUpload: MessageItem;
    export const dontUpload: MessageItem;
    export const reportAnIssue: MessageItem;
}

/**
 * Call this to register common variables used throughout the UI package.
 */
export declare function registerUIExtensionVariables(extVars: UIExtensionVariables): void;

/**
 * Call this to create the experimentation service adapter
 * @param ctx The extension context
 * @param targetPopulation Can be Team, Internal, Insiders, or Public. The definitions are somewhat subjective but generally:
 * Team is the devs and test team.
 * Internal is Microsoft
 * Insiders is anyone installing alpha builds
 * Public is everyone
 * NOTE: if unspecified, this will be "Team" if the extension is running in the Development Host, "Insiders" if the extension version contains "alpha", otherwise "Public"
 */
export declare function createExperimentationService(ctx: ExtensionContext, targetPopulation?: TargetPopulation): Promise<IExperimentationServiceAdapter>;

/**
 * Interface for common extension variables used throughout the UI package.
 */
export interface UIExtensionVariables {
    context: ExtensionContext;
    outputChannel: IAzExtOutputChannel;

    /**
     * Set to true if not running under a webpacked 'dist' folder as defined in '@microsoft/vscode-azext-dev'
     */
    ignoreBundle?: boolean;
}

/**
 * Interface for experimentation service adapter
 */
export interface IExperimentationServiceAdapter {
    /**
     * Gets whether or not the flight is enabled from the cache (which will be ~1 session delayed)
     * @param flight The flight variable name
     */
    isCachedFlightEnabled(flight: string): Promise<boolean>;

    /**
     * Gets whether or not the flight is enabled directly from the web. This is slower than cache and can result in behavior changing mid-session.
     * @param flight The flight variable name
     */
    isLiveFlightEnabled(flight: string): Promise<boolean>;

    /**
     * Gets a treatment variable from the cache (which will be ~1 session delayed)
     * @param name The variable name
     */
    getCachedTreatmentVariable<T extends string | number | boolean>(name: string): Promise<T | undefined>;

    /**
     * Gets a treatment variable directly from the web. This is slower than cache and can result in behavior changing mid-session.
     * @param name The variable name
     */
    getLiveTreatmentVariable<T extends string | number | boolean>(name: string): Promise<T | undefined>;
}

export interface IAddUserAgent {
    addUserAgentInfo(additionalUserAgentInfo: any): void;
}

/**
 * Retrieves a user agent string specific to the VS Code extension, of the form `${extensionName}/${extensionVersion}`,
 * and appends it to the given user agent string, if it isn't already in the string. Passing in no existingUserAgent
 * will return just the extension portion to use in a user agent.
 */
export declare function appendExtensionUserAgent(existingUserAgent?: string): string;

/**
 * Wraps an Azure Extension's API in a very basic provider that adds versioning.
 * Multiple APIs with different versions can be supplied, but ideally a single backwards-compatible API is all that's necessary.
 */
export declare function createApiProvider(azExts: AzureExtensionApi[]): AzureExtensionApiProvider;

/**
 * Wrapper for vscode.OutputChannel that handles AzureExtension behavior for outputting messages
 */
export interface IAzExtOutputChannel extends OutputChannel {

    /**
     * appendLog adds the current timestamps to all messages
     * @param value The message to be printed
     * @param options.resourceName The name of the resource. If provided, the resource name will be prefixed to the message
     * @param options.date The date to prepend before the message, otherwise it defaults to Date.now()
     */
    appendLog(value: string, options?: { resourceName?: string, date?: Date }): void;
}

/**
 * Create a new AzExtOutputChannel with the given name and the extensionPrefix.
 *
 * @param name Human-readable string which will be used to represent the channel in the UI.
 * @param extensionPrefix The configuration prefix for the extension, used to access the enableOutputTimestamps setting
 */
export declare function createAzExtOutputChannel(name: string, extensionPrefix: string): IAzExtOutputChannel;

/**
 * Opens a read-only editor to display json content
 * @param node Typically (but not strictly) an `AzExtTreeItem`. `label` is used for the file name displayed in VS Code and `fullId` is used to uniquely identify this file
 * @param data The data to stringify and display
 */
export declare function openReadOnlyJson(node: { label: string, fullId: string }, data: {}): Promise<void>;

export declare class ReadOnlyContent {
    public append(content: string): Promise<void>;
    public clear(): void;
}

/**
 * Opens a read-only editor to display content
 * @param node Typically (but not strictly) an `AzExtTreeItem`. `label` is used for the file name displayed in VS Code and `fullId` is used to uniquely identify this file
 * @param content The content to display
 * @param fileExtension The file extension
 * @param options Options for showing the text document
 */
export declare function openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, options?: TextDocumentShowOptions): Promise<ReadOnlyContent>;

/**
 * The event used to signal an item change for `AzExtTreeFileSystem`
 */
export type AzExtItemChangeEvent<TItem> = { type: FileChangeType; item: TItem };

/**
 * The query of a URI used in `AzExtTreeFileSystem`
 */
export type AzExtItemQuery = {
    /**
     * The identifier of the item. Will not be displayed to the user
     */
    id: string;

    [key: string]: string | string[] | undefined;
};

/**
 * The basic parts of a URI used in `AzExtTreeFileSystem`
 */
export type AzExtItemUriParts = {
    /**
     * For display-purposes only. Will affect the tab-title and "Open Editors" panel
     */
    filePath: string;

    query: AzExtItemQuery;
};

/**
 * A virtual file system based around AzExTreeItems that only supports viewing/editing single files.
 */
export declare abstract class AzExtTreeFileSystem<TItem extends AzExtTreeItem> implements FileSystemProvider {
    public abstract scheme: string;

    public constructor(tree: AzExtTreeDataProvider);

    public get onDidChangeFile(): Event<FileChangeEvent[]>;

    /**
     * Retrieve the file path for an item, for display-purposes only. Will affect the tab-title and "Open Editors" panel
     *
     * @param item The item represented by the uri.
     */
    public abstract getFilePath(item: TItem): string;

    /**
     * Retrieve metadata about a file.
     *
     * Note that the metadata for symbolic links should be the metadata of the file they refer to.
     * Still, the [SymbolicLink](#FileType.SymbolicLink)-type must be used in addition to the actual type, e.g.
     * `FileType.SymbolicLink | FileType.Directory`.
     *
     * @param context The action context
     * @param item The item represented by the uri.
     * @param originalUri The original uri for the item.
     * @return The file metadata about the file.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `item` is not found.
     */
    public abstract statImpl(context: IActionContext, item: TItem, originalUri: Uri): Promise<FileStat>;

    /**
     * Read the entire contents of a file.
     *
     * @param context The action context
     * @param item The item represented by the uri.
     * @param originalUri The original uri for the item.
     * @return An array of bytes or a thenable that resolves to such.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `item` is not found.
     */
    public abstract readFileImpl(context: IActionContext, item: TItem, originalUri: Uri): Promise<Uint8Array>;

    /**
     * Write data to a file, replacing its entire contents.
     *
     * @param context The action context
     * @param item The item represented by the uri.
     * @param content The new content of the file.
     * @param originalUri The original uri for the item.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `item` is not found.
     */
    public abstract writeFileImpl(context: IActionContext, item: TItem, content: Uint8Array, originalUri: Uri): Promise<void>;

    public showTextDocument(item: TItem, options?: TextDocumentShowOptions): Promise<void>;

    /**
     * Uses a simple buffer to group events that occur within a few milliseconds of each other
     */
    public fireSoon(...events: AzExtItemChangeEvent<TItem>[]): void;

    //#region vscode.FileSystemProvider methods
    public watch(): Disposable;
    public stat(uri: Uri): Promise<FileStat>;
    public readFile(uri: Uri): Promise<Uint8Array>;
    public writeFile(uri: Uri, content: Uint8Array): Promise<void>;

    /**
     * Not supported for this file system
     */
    public readDirectory(uri: Uri): Promise<[string, FileType][]>;

    /**
     * Not supported for this file system
     */
    public createDirectory(uri: Uri): Promise<void>;

    /**
     * Not supported for this file system
     */
    public delete(uri: Uri): Promise<void>;

    /**
     * Not supported for this file system
     */
    public rename(uri: Uri): Promise<void>;
    //#endregion

    /**
     * May be overridden, for example if you want to add additional query parameters to the uri
     */
    protected getUriParts(item: TItem): AzExtItemUriParts;

    /**
     * May be overridden if the default `findTreeItem` logic is not sufficient
     */
    protected findItem(context: IActionContext, query: AzExtItemQuery): Promise<TItem | undefined>;
}

/**
 * Registers a command that will prompt users with a list of issues they can report from that session of VS Code
 */
export declare function registerReportIssueCommand(commandId: string): void;

/**
 * Registers a namespace that leverages vscode.workspace.fs API to access the file system
 */
export declare namespace AzExtFsExtra {
    export function isDirectory(): Promise<boolean>;
    export function isFile(): Promise<boolean>;
    export function ensureDir(resource: Uri | string): Promise<void>;
    export function ensureFile(resource: Uri | string): Promise<void>;
    export function readFile(resource: Uri | string): Promise<string>;
    export function writeFile(resource: Uri | string, contents: string): Promise<void>;
    export function pathExists(resource: Uri | string): Promise<boolean>;
    export function readJSON(resource: Uri | string): Promise<unknown>
    export function writeJSON(resource: Uri | string, json: unknown): Promise<void>
}

export declare function maskValue(data: string, valueToMask: string | undefined): string;

export declare function openUrl(url: string): Promise<void>;

/**
 * Retrieves a property by name from an object and checks that it's not null and not undefined.  It is strongly typed
 * for the property and will give a compile error if the given name is not a property of the source.
 */
export declare function nonNullProp<TSource, TKey extends keyof TSource>(source: TSource, name: TKey): NonNullable<TSource[TKey]>;

/**
 * Validates that a given value is not null and not undefined.
 */
export declare function nonNullValue<T>(value: T | undefined, propertyNameOrMessage?: string): T;

/**
 * Validates that a given string is not null, undefined, nor empty
 */
export declare function nonNullOrEmptyValue(value: string | undefined, propertyNameOrMessage?: string): string;

/**
 * Validates that a given object is not null and not undefined.
 * Then retrieves a property by name from that object and checks that it's not null and not undefined.  It is strongly typed
 * for the property and will give a compile error if the given name is not a property of the source.
 */
export declare function nonNullValueAndProp<TSource, TKey extends keyof TSource>(source: TSource | undefined, name: TKey): NonNullable<TSource[TKey]>;

/**
 * Finds an available port.
 * NOTE: If another listener is on '0.0.0.0', this will take the '127.0.0.1' allocation from them!
 * @param startPort (Optional) The first port to try. By default, a random port from 10000 (inclusive) to 64000 (exclusive)
 * @param maxAttempts (Optional) The maximum number of attempts. 25, by default.
 * @param timeout (Optional) The maximum time to spend. 500 ms, by default.
 */
export declare function findFreePort(startPort?: number, maxAttempts?: number, timeout?: number): Promise<number>;

/**
 * @param message Message to display in the confirmation modal
 * ex: `Are you sure you want to delete function app "{0}"?`
 */
export declare class DeleteConfirmationStep extends AzureWizardPromptStep<IActionContext> {
    public constructor(message: string);
    public prompt(wizardContext: IActionContext): Promise<void>;
    public shouldPrompt(wizardContext: IActionContext): boolean;
}

/**
 * @param values
 * @returns a sorted, unique string of values separated by `;`
 */
export function createContextValue(values: string[]): string;
