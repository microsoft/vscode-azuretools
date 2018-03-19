/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Subscription, Location } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import { Uri, TreeDataProvider, Disposable, TreeItem, Event, OutputChannel, Memento, InputBoxOptions, QuickPickItem, QuickPickOptions, TextDocument, ExtensionContext, MessageItem, OpenDialogOptions } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { StorageAccount, CheckNameAvailabilityResult } from 'azure-arm-storage/lib/models';

export declare class AzureTreeDataProvider implements TreeDataProvider<IAzureNode>, Disposable {
    public static readonly subscriptionContextValue: string;
    public onDidChangeTreeData: Event<IAzureNode>;
    /**
     * Azure Tree Data Provider
     * @param resourceProvider Describes the resources to be displayed under subscription nodes
     * @param loadMoreCommandId The command your extension will register for the 'Load More...' node
     * @param ui Used to get input from the user
     * @param telemetryReporter Optionally used to track telemetry for the tree
     * @param rootTreeItems Any nodes other than the subscriptions that should be shown at the root of the explorer
     */
    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, ui: IAzureUserInput, telemetryReporter: TelemetryReporter | undefined, rootTreeItems?: IAzureParentTreeItem[]);
    public getTreeItem(node: IAzureNode): TreeItem;
    public getChildren(node?: IAzureParentNode): Promise<IAzureNode[]>;
    public refresh(node?: IAzureNode, clearCache?: boolean): Promise<void>;
    public loadMore(node: IAzureNode): Promise<void>;
    public showNodePicker(expectedContextValues: string | string[], startingNode?: IAzureNode): Promise<IAzureNode>;
    public findNode(id: string): Promise<IAzureNode | undefined>;
    public dispose(): void;
}

/**
 * The AzureTreeDataProvider returns instances of IAzureNode, which are wrappers for IAzureTreeItem with relevant context and functions from the tree
 */
export interface IAzureNode<T extends IAzureTreeItem = IAzureTreeItem> {
    /**
     * This id represents the effective/serializable id of the node in the tree. It always starts with the parent's id and ends with either the IAzureTreeItem.id property (if implemented) or IAzureTreeItem.label property
     * This is used for AzureTreeDataProvider.findNode and IAzureNode.openInPortal
     */
    readonly id: string;
    readonly treeItem: T;
    readonly parent?: IAzureParentNode;
    readonly treeDataProvider: AzureTreeDataProvider;
    readonly credentials: ServiceClientCredentials;
    readonly subscription: Subscription;
    readonly tenantId: string;
    readonly userId: string;
    readonly environment: AzureEnvironment;
    readonly ui: IAzureUserInput;

    /**
     * Refresh this node in the tree
     */
    refresh(): Promise<void>;

    /**
     * This class wraps IAzureTreeItem.deleteTreeItem and ensures the tree is updated correctly when an item is deleted
     */
    deleteNode(): Promise<void>;

    /**
     * This method combines the environment.portalLink and IAzureTreeItem.id to open the resource in the portal. Optionally, an id can be passed to manually open nodes that may not be in the explorer.
     */
    openInPortal(id?: string): void;
}

export interface IAzureParentNode<T extends IAzureTreeItem = IAzureTreeItem> extends IAzureNode<T> {
    /**
     * This class wraps IChildProvider.createChild and ensures the tree is updated correctly when an item is created
     */
    createChild(userOptions?: any): Promise<IAzureNode>;

    getCachedChildren(): Promise<IAzureNode[]>
}

/**
 * Implement this interface if your treeItem does not have children, otherwise implement IAzureParentTreeItem
 */
export interface IAzureTreeItem {
    /**
     * This is is used for the openInPortal action. It is also used per the following documentation copied from VS Code:
     * Optional id for the tree item that has to be unique across tree. The id is used to preserve the selection and expansion state of the tree item.
     *
     * If not provided, an id is generated using the tree item's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
     */
    id?: string;
    label: string;
    iconPath?: string | Uri | { light: string | Uri; dark: string | Uri };
    commandId?: string;
    contextValue: string;
    deleteTreeItem?(node: IAzureNode): Promise<void>;
    refreshLabel?(node: IAzureNode): Promise<void>;

    /**
     * Optional function to filter nodes displayed in the node picker
     * If not implemented, it's assumed that 'isAncestorOf' evaluates to true
     */
    isAncestorOf?(contextValue: string): boolean;
}

export interface IChildProvider {
    /**
     * This will be used in the node picker prompt when selecting children
     */
    readonly childTypeLabel?: string;

    loadMoreChildren(node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]>;

    hasMoreChildren(): boolean;

    /**
     * Implement this if you want the 'create' option to show up in the node picker
     * @param options User-defined options that are passed to the IAzureParentTreeItem.createChild call
     */
    createChild?(node: IAzureNode, showCreatingNode: (label: string) => void, userOptions?: any): Promise<IAzureTreeItem>;

    /**
     * Implement this if you want non-default (i.e. non-alphabetical) sorting of child nodes.
     * @param node1 The first node to compare
     * @param node2 The second node to compare
     * @returns A negative number if the node1 occurs before node2; positive if node1 occurs after node2; 0 if they are equivalent
     */
    compareChildren?(node1: IAzureNode, node2: IAzureNode): number
}

/**
 * Implement this interface if your treeItem has children, otherwise implement IAzureTreeItem
 */
export interface IAzureParentTreeItem extends IAzureTreeItem, IChildProvider {
    /**
     * If this treeItem should not show up in the node picker, implement this to provide a child that corresponds to the expectedContextValue
     * Otherwise, all children will be shown in the node picker
     */
    pickTreeItem?(expectedContextValue: string): IAzureTreeItem | undefined;
}

export declare class UserCancelledError extends Error { }

export declare abstract class BaseEditor<ContextT> implements Disposable {
    /**
    * Implement this interface if you need to download and upload remote files
    * @param showSavePromptKey Key used globally by VS Code to determine whether or not to show the savePrompt
    * @param outputChannel OutputChannel where output will be displayed when editor performs actions
    */
    constructor(showSavePromptKey: string, outputChannel?: OutputChannel | undefined);

    /**
     * Implement this to retrieve data from your remote server, returns the file as a string
     */
    abstract getData(context: ContextT): Promise<string>;

    /**
     * Implement this to allow for remote updating
     */
    abstract updateData(context: ContextT, data: string): Promise<string>;

    /**
     * Implement this to return the file name from the remote
     */
    abstract getFilename(context: ContextT): Promise<string>;

    /**
     * Implement this to return the size in MB.
     */
    abstract getSize(context: ContextT): Promise<number>;

    /**
     * Implement this to edit what is displayed to the user when uploading the file to the remote
     */
    abstract getSaveConfirmationText(context: ContextT): Promise<string>;

    onDidSaveTextDocument(actionContext: IActionContext, globalState: Memento, doc: TextDocument): Promise<void>;
    showEditor(context: ContextT, sizeLimit?: number): Promise<void>;
    dispose(): Promise<void>;
}

/**
 * Used to register VSCode commands and events. It wraps your callback with consistent error and telemetry handling
 */
export declare class AzureActionHandler {
    constructor(extensionContext: ExtensionContext, outputChannel: OutputChannel, telemetryReporter?: TelemetryReporter);

    registerCommand(commandId: string, callback: (this: IActionContext, ...args: any[]) => any): void;

    /**
     * NOTE: By default, this sends a telemetry event every single time the event fires. It it recommended to use 'this.suppressTelemetry' to only send events if they apply to your extension
     */
    registerEvent<T>(eventId: string, event: Event<T>, callback: (this: IActionContext, ...args: any[]) => any): void;
}

export declare function callWithTelemetryAndErrorHandling(callbackId: string, telemetryReporter: TelemetryReporter | undefined, outputChannel: OutputChannel | undefined, callback: (this: IActionContext) => any): Promise<any>;

export interface IActionContext {
    properties: TelemetryProperties;
    measurements: TelemetryMeasurements;

    /**
     * Defaults to `false`
     */
    suppressTelemetry: boolean;

    /**
     * Defaults to `false`
     */
    suppressErrorDisplay: boolean;

    /**
     * Defaults to `false`
     */
    rethrowError: boolean;
}

export interface TelemetryProperties {
    /**
     * Defaults to `false`
     * This is used to more accurately track usage, since activation events generally shouldn't 'count' as usage
     */
    isActivationEvent: 'true' | 'false';
    result: 'Succeeded' | 'Failed' | 'Canceled';
    error: string;
    errorMessage: string;
    [key: string]: string;
}

export interface TelemetryMeasurements {
    duration: number;
    [key: string]: number;
}

export declare function parseError(error: any): IParsedError;

export interface IParsedError {
    errorType: string;
    message: string;
    isUserCancelledError: boolean;
}

/**
 * Wrapper interface of several `vscode.window` methods that handle user input. The main reason for this interface
 * is to facilitate unit testing in non-interactive mode with the `TestUserInput` class.
 * However, the `AzureUserInput` class does have a few minor differences from default vscode behavior:
 * 1. Automatically throws a `UserCancelledError` instead of returning undefined when a user cancels
 * 2. Persists 'recently used' items in quick picks and displays them at the top
 */
export interface IAzureUserInput {
    /**
     * Shows a selection list.
     * Automatically persists the 'recently used' item and displays that at the top of the list
     *
     * @param items An array of items, or a promise that resolves to an array of items.
     * @param options Configures the behavior of the selection list.
     * @throws `UserCancelledError` if the user cancels.
     * @return A promise that resolves to the item the user picked.
     */
    showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;

    /**
     * Opens an input box to ask the user for input.
     *
     * @param options Configures the behavior of the input box.
     * @throws `UserCancelledError` if the user cancels.
     * @return A promise that resolves to a string the user provided.
     */
    showInputBox(options: InputBoxOptions): Promise<string>;

    /**
     * Show a warning message.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @throws `UserCancelledError` if the user cancels.
     * @return A thenable that resolves to the selected item when being dismissed.
     */
    showWarningMessage(message: string, ...items: MessageItem[]): Promise<MessageItem>;

    /**
     * Shows a file open dialog to the user which allows to select a file
     * for opening-purposes.
     *
     * @param options Options that control the dialog.
     * @throws `UserCancelledError` if the user cancels.
     * @returns A promise that resolves to the selected resources.
     */
    showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
}

/**
 * Wrapper class of several `vscode.window` methods that handle user input.
 */
export declare class AzureUserInput implements IAzureUserInput {
    /**
     * @param persistence Used to persist previous selections in the QuickPick.
     */
    public constructor(persistence: Memento);

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage(message: string, ...items: MessageItem[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
}

/**
 * Wrapper class of several `vscode.window` methods that handle user input.
 * This class is meant to be used for testing in non-interactive mode.
 */
export declare class TestUserInput implements IAzureUserInput {
    /**
     * @param inputs An ordered array of inputs that will be used instead of interactively prompting in VS Code.
     */
    public constructor(inputs: (string | undefined)[]);

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage(message: string, ...items: MessageItem[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
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
}

/**
 * Provides additional options for QuickPicks used in Azure Extensions
 */
export interface IAzureQuickPickOptions extends QuickPickOptions {
    /**
     * An optional id to identify this QuickPick across sessions, used in persisting previous selections
     * If not specified, a hash of the placeHolder will be used
     */
    id?: string;
}

/**
 * A wizard that links several user input steps together
 */
export declare class AzureWizard<T> {
    /**
     * @param steps The steps to perform, in order
     * @param wizardContext A context object that should be used to pass information between steps
     */
    public constructor(steps: AzureWizardStep<T>[], wizardContext: T);

    public prompt(actionContext: IActionContext, ui: IAzureUserInput): Promise<T>;
    public execute(actionContext: IActionContext, outputChannel: OutputChannel): Promise<T>;
}

export declare abstract class AzureWizardStep<T> {
    public abstract prompt(wizardContext: T, ui: IAzureUserInput): Promise<T>;
    public abstract execute(wizardContext: T, outputChannel: OutputChannel): Promise<T>;
}

export interface ISubscriptionWizardContext {
    credentials: ServiceClientCredentials;
    subscription: Subscription;
}

export interface ILocationWizardContext extends ISubscriptionWizardContext {
    /**
     * You may specify the defaultLocationName if you don't want the `LocationStep` to prompt for a location
     * For example, if the user selects an existing resource, you might want to use that location as the default for the wizard's other resources
     */
    defaultLocationName?: string;

    /**
     * The location to use for new resources
     * This value will be defined after `LocationStep.prompt` occurs.
     */
    location?: Location;
}

export declare class LocationStep<T extends ILocationWizardContext> extends AzureWizardStep<T> {
    public prompt(wizardContext: T, ui: IAzureUserInput): Promise<T>;
    public execute(wizardContext: T, outputChannel: OutputChannel): Promise<T>;
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

export interface IRelatedNameWizardContext {
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
export declare abstract class AzureNameStep<T extends IRelatedNameWizardContext> extends AzureWizardStep<T> {
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

export interface IResourceGroupWizardContext extends ILocationWizardContext, IRelatedNameWizardContext {
    /**
     * The resource group to use for new resources.
     * If an existing resource group is picked, this value will be defined after `ResourceGroupStep.prompt` occurs
     * If a new resource group is picked, this value will be defined after `ResourceGroupStep.execute` occurs
     */
    resourceGroup?: ResourceGroup;

    /**
     * The task used to get existing resource groups.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    resourceGroupsTask?: Promise<ResourceGroup[]>;
}

export declare const resourceGroupNamingRules: IAzureNamingRules;
export declare class ResourceGroupStep<T extends IResourceGroupWizardContext> extends AzureWizardStep<T> {
    /**
     * Used to get existing resource groups. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static getResouceGroups<T extends IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]>;

    /**
     * Checks existing resource groups in the wizard's subscription to see if the name is available.
     * @param wizardContext The context of the wizard.
     */
    public static isNameAvailable<T extends IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean>;

    public prompt(wizardContext: T, ui: IAzureUserInput): Promise<T>;
    public execute(wizardContext: T, outputChannel: OutputChannel): Promise<T>;
}

export interface IStorageAccountWizardContext extends IResourceGroupWizardContext {
    /**
     * The storage account to use.
     * If an existing storage account is picked, this value will be defined after `StorageAccountStep.prompt` occurs
     * If a new storage account is picked, this value will be defined after `StorageAccountStep.execute` occurs
     */
    storageAccount?: StorageAccount;
}

export declare const storageAccountNamingRules: IAzureNamingRules;
export declare class StorageAccountStep<T extends IStorageAccountWizardContext> extends AzureWizardStep<T> {
    public static isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean>;

    public prompt(wizardContext: T, ui: IAzureUserInput): Promise<T>;
    public execute(wizardContext: T, outputChannel: OutputChannel): Promise<T>;
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
}
