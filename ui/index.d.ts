/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionModels } from '@azure/arm-resources-subscriptions';
import type { ExtendedLocation, ResourceGroup } from '@azure/arm-resources';
import type * as coreClient from '@azure/core-client';
import type { PagedAsyncIterableIterator } from "@azure/core-paging";
import type { Environment } from '@azure/ms-rest-azure-env';
import type { HttpOperationResponse, RequestPrepareOptions, ServiceClient } from '@azure/ms-rest-js';
import type { StorageAccount } from '@azure/arm-storage';
import { Disposable, Event, ExtensionContext, FileChangeEvent, FileChangeType, FileStat, FileSystemProvider, FileType, InputBoxOptions, MarkdownString, MessageItem, MessageOptions, OpenDialogOptions, OutputChannel, Progress, QuickPickItem, QuickPickOptions, TextDocumentShowOptions, ThemeIcon, TreeDataProvider, TreeItem, Uri } from 'vscode';
import { TargetPopulation } from 'vscode-tas-client';
import { AzureExtensionApi, AzureExtensionApiProvider } from './api';

export type OpenInPortalOptions = {
    /**
     * A query string applied directly to the host URL, e.g. "feature.staticwebsites=true" (turns on a preview feature)
     */
    queryPrefix?: string;
};

/**
 * Tree Data Provider for an *Az*ure *Ext*ension
 */
export declare class AzExtTreeDataProvider implements TreeDataProvider<AzExtTreeItem> {
    public onDidChangeTreeData: Event<AzExtTreeItem | undefined>;
    public onTreeItemCreate: Event<AzExtTreeItem>;

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
 * Implement this class to display resources under a standard subscription tree item
 */
export abstract class SubscriptionTreeItemBase extends AzExtParentTreeItem {
    public static readonly contextValue: string;
    public readonly contextValue: string;
    public readonly label: string;
    constructor(parent: AzExtParentTreeItem, subscription: ISubscriptionContext);
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
 * Base class for all tree items in an *Az*ure *ext*ension, even if those resources aren't actually in Azure.
 * This provides more value than `TreeItem` (provided by `vscode`)
 * NOTE: *Impl methods are not meant to be called directly - just implemented.
 */
export declare abstract class AzExtTreeItem {
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

export class InvalidTreeItem extends AzExtParentTreeItem {
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
export declare abstract class AzExtParentTreeItem extends AzExtTreeItem {
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

/**
 * A tree item for an Azure Account, which will display subscriptions. For Azure-centered extensions, this will be at the root of the tree.
 */
export declare abstract class AzureAccountTreeItemBase extends AzExtParentTreeItem implements Disposable {
    public static readonly contextValue: string;
    public contextValue: string;
    public label: string;
    public disposables: Disposable[];
    public childTypeLabel: string;
    public autoSelectInTreeItemPicker: boolean;

    //#region Methods implemented by base class
    /**
     * Implement this to create a subscription tree item under this Azure Account node
     * @param root Contains basic information about the subscription - should be passed in to the constructor of `SubscriptionTreeItemBase`
     */
    public abstract createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItemBase | Promise<SubscriptionTreeItemBase>;
    //#endregion

    /**
     * Azure Account Tree Item
     * @param parent The parent of this node or undefined if it's the root of the tree.
     * @param testAccount Unofficial api for testing - see `TestAzureAccount` in vscode-azureextensiondev package
     */
    public constructor(parent?: AzExtParentTreeItem, testAccount?: {});

    public dispose(): void;

    /**
     * If user is logged in and only has one subscription selected, adds that to the wizardContext and returns undefined
     * Else, returns a prompt step for a subscription
     */
    public getSubscriptionPromptStep(wizardContext: Partial<ISubscriptionActionContext>): Promise<AzureWizardPromptStep<ISubscriptionActionContext> | undefined>;

    public hasMoreChildrenImpl(): boolean;
    public loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;
    public pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined>;
    public getIsLoggedIn(): Promise<boolean>;
}

/**
* Combines the root.environment.portalLink and id to open the resource in the portal.
*
* NOTE: If root is a tree item, it will find the subscription ancestor and get environment.portalLink from there
*/
export declare function openInPortal(root: ISubscriptionContext | AzExtTreeItem, id: string, options?: OpenInPortalOptions): Promise<void>;

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
export function addExtensionValueToMask(...values: string[]): void;

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

interface IHandlerContext extends IActionContext {
    /**
     * The id for the callback, used as the id for the telemetry event. This may be modified by any handler
     */
    callbackId: string;
}

interface IErrorHandlerContext extends IHandlerContext {
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
export function registerOnActionStartHandler(handler: OnActionStartHandler): Disposable;

/**
 * Register a handler to run after a callback errors out, but before the default error handling.
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export function registerErrorHandler(handler: ErrorHandler): Disposable;

/**
 * Register a handler to run after a callback finishes, but before the default telemetry handling.
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export function registerTelemetryHandler(handler: TelemetryHandler): Disposable;

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
 * The implementations of this interface are accessed through `IActionContext.ui` or `TestActionContext.ui` (in the "vscode-azureextensiondev" package)
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

/**
 * A wizard that links several user input steps together
 */
export declare class AzureWizard<T extends IActionContext> {
    /**
     * @param wizardContext  A context object that should be used to pass information between steps
     * @param options Options describing this wizard
     */
    public constructor(wizardContext: T, options: IWizardOptions<T>);

    public prompt(): Promise<void>;
    public execute(): Promise<void>;
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

export type AzExtLocation = SubscriptionModels.Location & {
    id: string;
    name: string;
    displayName: string;
}

/**
 * Currently no location-specific properties on the wizard context, but keeping this interface for backwards compatibility and ease of use
 * Instead, use static methods on `LocationListStep` like `getLocation` and `setLocationSubset`
 */
export interface ILocationWizardContext extends ISubscriptionActionContext {
    includeExtendedLocations?: boolean;
}

export declare class LocationListStep<T extends ILocationWizardContext> extends AzureWizardPromptStep<T> {
    protected constructor();

    /**
     * Adds a LocationListStep to the wizard.  This function will ensure there is only one LocationListStep per wizard context.
     * @param wizardContext The context of the wizard
     * @param promptSteps The array of steps to include the LocationListStep to
     * @param options Options to pass to ui.showQuickPick. Options are spread onto the defaults.
     */
    public static addStep<T extends ILocationWizardContext>(wizardContext: IActionContext & Partial<ILocationWizardContext>, promptSteps: AzureWizardPromptStep<T>[], options?: IAzureQuickPickOptions): void;

    /**
     * This will set the wizard context's location (in which case the user will _not_ be prompted for location)
     * For example, if the user selects an existing resource, you might want to use that location as the default for the wizard's other resources
     * This _will_ set the location even if not all providers support it - in the hopes that a related location can be found during `getLocation`
     * @param wizardContext The context of the wizard
     * @param name The name or display name of the location
     */
    public static setLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void>;

    /**
     * Specify a task that will be used to filter locations
     * @param wizardContext The context of the wizard
     * @param task A task evaluating to the locations supported by this provider
     * @param provider The relevant provider (i.e. 'Microsoft.Web')
     */
    public static setLocationSubset<T extends ILocationWizardContext>(wizardContext: T, task: Promise<string[]>, provider: string): void;

    /**
     * Adds default location filtering for a provider
     * If more granular filtering is needed, use `setLocationSubset` instead (i.e. if the provider further filters locations based on features)
     * @param wizardContext The context of the wizard
     * @param provider The provider (i.e. 'Microsoft.Storage')
     * @param resourceType The resource type (i.e. 'storageAccounts')
     */
    public static addProviderForFiltering<T extends ILocationWizardContext>(wizardContext: T, provider: string, resourceType: string): void;

    /**
     * Used to convert a location into a home location and an extended location if the location passed in is an extended location.
     * If the location passed in is not extended, then extendedLocation will be `undefined`.
     * @param location location or extended location
     */
    public static getExtendedLocation(location: AzExtLocation): { location: string, extendedLocation?: ExtendedLocation };

    /**
     * Gets the selected location for this wizard.
     * @param wizardContext The context of the wizard
     * @param provider If specified, this will check against that provider's supported locations and attempt to find a "related" location if the selected location is not supported.
     * @param supportsExtendedLocations If set to true, the location returned may be an extended location, in which case the `extendedLocation` property should be added when creating a resource
     */
    public static getLocation<T extends ILocationWizardContext>(wizardContext: T, provider?: string, supportsExtendedLocations?: boolean): Promise<AzExtLocation>;

    /**
     * Returns true if a location has been set on the context
     */
    public static hasLocation<T extends ILocationWizardContext>(wizardContext: T): boolean;

    /**
     * Used to get locations. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static getLocations<T extends ILocationWizardContext>(wizardContext: T): Promise<AzExtLocation[]>;

    /**
     * Returns true if the given location matches the name
     */
    public static locationMatchesName(location: AzExtLocation, name: string): boolean;

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;

    protected getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<AzExtLocation>[]>;

    /**
     * Implement this to set descriptions on location quick pick items.
     */
    public static getQuickPickDescription?: (location: AzExtLocation) => string | undefined;
}

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
 * Checks to see if providers (i.e. 'Microsoft.Web') are registered and registers them if they're not
 */
export declare class VerifyProvidersStep<T extends ISubscriptionActionContext> extends AzureWizardExecuteStep<T> {
    /**
     * 90
     */
    public priority: number;

    /**
     * @param providers List of providers to verify
     */
    public constructor(providers: string[]);

    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export interface IResourceGroupWizardContext extends ILocationWizardContext, IRelatedNameWizardContext {
    /**
     * The resource group to use for new resources.
     * If an existing resource group is picked, this value will be defined after `ResourceGroupListStep.prompt` occurs
     * If a new resource group is picked, this value will be defined after the `execute` phase of the 'create' subwizard
     */
    resourceGroup?: ResourceGroup;

    /**
     * The task used to get existing resource groups.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    resourceGroupsTask?: Promise<ResourceGroup[]>;

    newResourceGroupName?: string;

    /**
     * By default, users will be prompted to select an existing resource group if creating one fails with a 403 error. Set this to `true` to prevent that behavior
     */
    suppress403Handling?: boolean;
}

export declare const resourceGroupNamingRules: IAzureNamingRules;

export declare class ResourceGroupListStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    /**
     * Used to get existing resource groups. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static getResourceGroups<T extends IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]>;

    /**
     * Checks existing resource groups in the wizard's subscription to see if the name is available.
     * @param wizardContext The context of the wizard.
     */
    public static isNameAvailable<T extends IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean>;

    public prompt(wizardContext: T): Promise<void>;
    public getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined>;
    public shouldPrompt(wizardContext: T): boolean;
}

export class ResourceGroupNameStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class ResourceGroupCreateStep<T extends IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    /**
     * 100
     */
    public priority: number;
    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
}

export interface IStorageAccountWizardContext extends IResourceGroupWizardContext {
    /**
     * The storage account to use.
     * If an existing storage account is picked, this value will be defined after `StorageAccountListStep.prompt` occurs
     * If a new storage account is picked, this value will be defined after the `execute` phase of the 'create' subwizard
     */
    storageAccount?: StorageAccount;

    newStorageAccountName?: string;
}

export declare enum StorageAccountKind {
    Storage = "Storage",
    StorageV2 = "StorageV2",
    BlobStorage = "BlobStorage",
    BlockBlobStorage = "BlockBlobStorage",
}

export declare enum StorageAccountPerformance {
    Standard = "Standard",
    Premium = "Premium",
}

export declare enum StorageAccountReplication {
    /**
     * Locally redundant storage
     */
    LRS = "LRS",
    /**
     * Zone-redundant storage
     */
    ZRS = "ZRS",
    /**
     * Geo-redundant storage
     */
    GRS = "GRS",
    /**
     * Read-access geo-redundant storage
     */
    RAGRS = "RAGRS",
}

export interface INewStorageAccountDefaults {
    kind: StorageAccountKind;
    performance: StorageAccountPerformance;
    replication: StorageAccountReplication;
}

export interface IStorageAccountFilters {
    kind?: StorageAccountKind[];
    performance?: StorageAccountPerformance[];
    replication?: StorageAccountReplication[];

    /**
     * If specified, a 'learn more' option will be displayed to explain why some storage accounts were filtered
     */
    learnMoreLink?: string;
}

export declare const storageAccountNamingRules: IAzureNamingRules;
export declare class StorageAccountListStep<T extends IStorageAccountWizardContext> extends AzureWizardPromptStep<T> {
    /**
     * @param createOptions Default options to use when creating a Storage Account
     * @param filterOptions Optional filters used when listing Storage Accounts
     */
    public constructor(createOptions: INewStorageAccountDefaults, filterOptions?: IStorageAccountFilters);

    public static isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean>;

    public prompt(wizardContext: T): Promise<void>;
    public getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined>;
    public shouldPrompt(wizardContext: T): boolean;
}

export declare class StorageAccountNameStep<T extends IStorageAccountWizardContext> extends AzureNameStep<T> {
    public constructor();

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;

    protected isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean>;
}

export declare class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> {
    /**
     * 130
     */
    public priority: number;
    public constructor(defaults: INewStorageAccountDefaults);

    public execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public shouldExecute(wizardContext: T): boolean;
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
     * Set to true if not running under a webpacked 'dist' folder as defined in 'vscode-azureextensiondev'
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
 * Adds the extension user agent to the given ServiceClient or other object support AddUserAgentInfo
 */
export declare function addExtensionUserAgent(client: IAddUserAgent): void;

export interface IMinimumServiceClientOptions {
    acceptLanguage?: string,
    baseUri?: string;
    userAgent?: string | ((defaultUserAgent: string) => string);

    /**
     * NOTE: Using "any" to allow for the use of different versions of "@azure/ms-rest-js", which are largely compatible for our purposes
     */
    requestPolicyFactories?: any[] | ((defaultRequestPolicyFactories: any[]) => (void | any[]));
}

/**
 * Credential type to be used for creating generic http rest clients
 */
export type AzExtGenericCredentials =  AzExtServiceClientCredentialsT1 | AzExtServiceClientCredentialsT2 | AzExtServiceClientCredentials;
export type AzExtGenericClientInfo = AzExtGenericCredentials | { credentials: AzExtGenericCredentials; environment: Environment; } | undefined;

/**
 * Creates a generic http rest client (i.e. for non-Azure calls or for Azure calls that the available sdks don't support), ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns (if clientInfo corresponds to an Azure environment)
 * @param clientInfo The client/credentials info or `undefined` if no credentials are needed
 */
export function createGenericClient(context: IActionContext, clientInfo: AzExtGenericClientInfo): Promise<ServiceClient>;

export type AzExtRequestPrepareOptions = RequestPrepareOptions & { rejectUnauthorized?: boolean }

/**
 * Send request with a timeout specified and turn off retry policy (because retrying could take a lot longer)
 * @param timeout The timeout in milliseconds
 * @param clientInfo The client/credentials info or `undefined` if no credentials are needed
 */
export function sendRequestWithTimeout(context: IActionContext, options: AzExtRequestPrepareOptions, timeout: number, clientInfo: AzExtGenericClientInfo): Promise<HttpOperationResponse>;

export type AzExtClientType<T> = new (credentials: AzExtServiceClientCredentials, subscriptionId: string, options?: IMinimumServiceClientOptions) => T;

/**
 * Convenience type to give us multiple ways to specify subscription info and action context depending on the scenario
 */
export type AzExtClientContext = ISubscriptionActionContext | [IActionContext, ISubscriptionContext | AzExtTreeItem];

/**
 * Converts `AzExtClientContext` into a single object: `ISubscriptionActionContext`
 */
export function parseClientContext(clientContext: AzExtClientContext): ISubscriptionActionContext;

/**
 * Creates an Azure client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export function createAzureClient<T>(context: AzExtClientContext, clientType: AzExtClientType<T>): T;

export type AzExtSubscriptionClientType<T> = new (credentials: AzExtServiceClientCredentials, options?: IMinimumServiceClientOptions) => T;

/**
 * Creates an Azure subscription client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export function createAzureSubscriptionClient<T>(context: AzExtClientContext, clientType: AzExtSubscriptionClientType<T>): T;

/**
 * Wraps an Azure Extension's API in a very basic provider that adds versioning.
 * Multiple APIs with different versions can be supplied, but ideally a single backwards-compatible API is all that's necessary.
 */
export function createApiProvider(azExts: AzureExtensionApi[]): AzureExtensionApiProvider;

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
export function createAzExtOutputChannel(name: string, extensionPrefix: string): IAzExtOutputChannel;

/**
 * Opens a read-only editor to display json content
 * @param node Typically (but not strictly) an `AzExtTreeItem`. `label` is used for the file name displayed in VS Code and `fullId` is used to uniquely identify this file
 * @param data The data to stringify and display
 */
export function openReadOnlyJson(node: { label: string, fullId: string }, data: {}): Promise<void>;

export class ReadOnlyContent {
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
export function openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, options?: TextDocumentShowOptions): Promise<ReadOnlyContent>;

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
export function registerReportIssueCommand(commandId: string): void;

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
}

export declare namespace uiUtils {
    export function listAllIterator<T>(list: (options?: coreClient.OperationOptions) => PagedAsyncIterableIterator<T>, options?: coreClient.OperationOptions)
}
