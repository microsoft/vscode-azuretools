/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment, AzureServiceClientOptions } from 'ms-rest-azure';
import { Disposable, Event, ExtensionContext, InputBoxOptions, Memento, MessageItem, MessageOptions, OpenDialogOptions, OutputChannel, QuickPickItem, QuickPickOptions, TextDocument, TreeDataProvider, TreeItem, Uri, QuickPick, InputBox, Progress } from 'vscode';
import { AzureExtensionApi, AzureExtensionApiProvider } from './api';

export type OpenInPortalOptions = {
    /**
     * A query string applied directly to the host URL, e.g. "feature.staticwebsites=true" (turns on a preview feature)
     */
    queryPrefix?: string;
};

export declare class AzExtTreeDataProvider<TRoot = ISubscriptionRoot> implements TreeDataProvider<AzExtTreeItem<TRoot | ISubscriptionRoot>>, Disposable {
    public onDidChangeTreeData: Event<AzExtTreeItem<TRoot | ISubscriptionRoot>>;
    public onTreeItemCreate: Event<AzExtTreeItem<TRoot | ISubscriptionRoot>>;
    /**
     * Azure Tree Data Provider
     * @param subscriptionTreeItemType The type used to create SubscriptionTreeItem's that will display your resources
     * @param loadMoreCommandId The command your extension will register for the 'Load More...' tree item
     * @param rootTreeItems Any tree items other than the subscriptions that should be shown at the root of the explorer
     * @param testAccount A test Azure Account that leverages a service principal instead of interactive login
     */
    public constructor(subscriptionTreeItemType: { new(root: ISubscriptionRoot): SubscriptionTreeItem }, loadMoreCommandId: string, rootTreeItems?: RootTreeItem<TRoot>[], testAccount?: TestAzureAccount);

    /**
     * Should not be called directly
     */
    public getTreeItem(treeItem: AzExtTreeItem<TRoot | ISubscriptionRoot>): TreeItem;

    /**
     * Should not be called directly
     */
    public getChildren(treeItem?: AzExtParentTreeItem<TRoot | ISubscriptionRoot>): Promise<AzExtTreeItem<TRoot | ISubscriptionRoot>[]>;

    /**
     *  Refreshes the tree
     * @param treeItem The treeItem to refresh or 'undefined' to refresh the whole tree
     */
    public refresh(treeItem?: AzExtTreeItem<TRoot | ISubscriptionRoot>): Promise<void>;

    /**
     * Loads more children for a specific tree item
     * @param treeItem the load more tree item
     */
    public loadMore(treeItem: AzExtTreeItem<TRoot | ISubscriptionRoot>): Promise<void>;

    /**
     * Used to traverse the tree with a quick pick at each level. Primarily for command palette support
     * @param expectedContextValues a single context value or multiple matching context values matching the desired tree items
     * @param startingTreeItem
     */
    public showTreeItemPicker(expectedContextValues: string | string[] | RegExp, startingTreeItem?: AzExtTreeItem<TRoot | ISubscriptionRoot>): Promise<AzExtTreeItem<TRoot | ISubscriptionRoot>>;

    /**
     * Traverses a tree to find a node matching the given fullId of a tree item. This will not "Load more..."
     */
    public findTreeItem(fullId: string): Promise<AzExtTreeItem<TRoot | ISubscriptionRoot> | undefined>;

    /**
     * Should not be called directly
     */
    public dispose(): void;

    /**
     * If user is logged in and only has one subscription selected, add that to the wizardContext and return undefined
     * Else, return a prompt step for a subscription
     */
    public getSubscriptionPromptStep(wizardContext: Partial<ISubscriptionWizardContext>): Promise<AzureWizardPromptStep<ISubscriptionWizardContext> | undefined>;

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

/**
 * Implement this class to display resources under a standard Subscription tree item
 */
export abstract class SubscriptionTreeItem extends AzExtParentTreeItem {
    public static readonly contextValue: string;
    public readonly contextValue: string;
    public readonly label: string;
    constructor(root: ISubscriptionRoot);
}

/**
 * Information specific to the Subscription for this branch of the tree
 */
export interface ISubscriptionRoot {
    credentials: ServiceClientCredentials;
    subscriptionDisplayName: string;
    subscriptionId: string;
    subscriptionPath: string;
    tenantId: string;
    userId: string;
    environment: AzureEnvironment;
}

/**
 * Implement this class if your tree item does not have children. Otherwise use AzExtParentTreeItem
 * NOTE: *Impl methods are not meant to be called directly - just implemented.
 */
export declare abstract class AzExtTreeItem<TRoot = ISubscriptionRoot> {
    //#region Properties implemented by base class
    /**
     * This is is used for the openInPortal action. It is also used per the following documentation copied from VS Code:
     * Optional id for the treeItem that has to be unique across tree. The id is used to preserve the selection and expansion state of the treeItem.
     *
     * If not provided, an id is generated using the treeItem's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
     */
    public id?: string;
    public abstract label: string;

    /**
     * Additional information about a tree item that is appended to the label with the format `label (description)`
     */
    public description?: string;
    public iconPath?: string | Uri | { light: string | Uri; dark: string | Uri };
    public commandId?: string;
    public abstract contextValue: string;
    //#endregion

    /**
     * This id represents the effective/serializable full id of the item in the tree. It always starts with the parent's fullId and ends with either the AzExtTreeItem.id property (if implemented) or AzExtTreeItem.label property
     * This is used for AzureTreeDataProvider.findTreeItem and AzExtTreeItem.openInPortal
     */
    public readonly fullId: string;
    public readonly parent?: AzExtParentTreeItem<TRoot>;
    public readonly treeDataProvider: AzExtTreeDataProvider<TRoot>;

    /**
     * Contains information specific to the root of this branch of the tree. Usually, this will be subscription information
     */
    public readonly root: TRoot;

    /**
     * @param parent The parent of the new tree item or 'undefined' if it is a root item
     */
    public constructor(parent: AzExtParentTreeItem | undefined);

    //#region Methods implemented by base class
    /**
     * Implement this to support the 'delete' action in the tree. Should not be called directly
     */
    public deleteTreeItemImpl?(): Promise<void>;

    /**
     * Implement this to execute any async code when this node is refreshed. Should not be called directly
     */
    public refreshImpl?(): Promise<void>;

    /**
     * Optional function to filter items displayed in the tree picker. Should not be called directly
     * If not implemented, it's assumed that 'isAncestorOf' evaluates to true
     */
    public isAncestorOfImpl?(contextValue: string | RegExp): boolean;
    //#endregion

    /**
     * Refresh this node in the tree
     */
    public refresh(): Promise<void>;

    /**
     * This class wraps deleteTreeItemImpl and ensures the tree is updated correctly when an item is deleted
     */
    public deleteTreeItem(): Promise<void>;

    /**
     * This method combines the environment.portalLink and AzExtTreeItem.id to open the resource in the portal. Optionally, an id can be passed to manually open items that may not be in the explorer.
     */
    public openInPortal(id?: string, options?: OpenInPortalOptions): Promise<void>;

    /**
     * Displays a 'Loading...' icon and temporarily changes the item's description while `callback` is being run
     */
    public runWithTemporaryDescription(description: string, callback: () => Promise<void>): Promise<void>;
}

export interface IGenericTreeItemOptions {
    id?: string;
    label: string;
    description?: string;
    iconPath?: string | Uri | { light: string | Uri; dark: string | Uri };
    commandId?: string;
    contextValue: string;
}

/**
 * A convenience class used for very basic tree items that are never displayed in the treeItemPicker
 */
export declare class GenericTreeItem<TRoot = ISubscriptionRoot> extends AzExtTreeItem<TRoot> {
    public label: string;
    public contextValue: string;
    constructor(parent: AzExtParentTreeItem<TRoot> | undefined, options: IGenericTreeItemOptions);
}

/**
 * Implement this if you are displaying custom root nodes in the tree other than SubscriptionTreeItems
 */
export declare abstract class RootTreeItem<T> extends AzExtParentTreeItem<T> {
    public constructor(root: T);
}

/**
 * Implement this class if your tree item does have children. Otherwise use AzExtTreeItem
 * NOTE: *Impl methods are not meant to be called directly - just implemented.
 */
export declare abstract class AzExtParentTreeItem<TRoot = ISubscriptionRoot> extends AzExtTreeItem<TRoot> {
    //#region Properties implemented by base class
    /**
     * This will be used in the tree picker prompt when selecting children
     */
    readonly childTypeLabel?: string;
    //#endregion

    //#region Methods implemented by base class
    /**
     * Implement this to display child resources. Should not be called directly
     * @param clearCache If true, you should start the "Load more..." process over
     */
    public abstract loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem<TRoot>[]>;

    /**
     * Implement this as a part of the "Load more..." action. Should not be called directly
     * @returns 'true' if there are more children and a "Load more..." node should be displayed
     */
    public abstract hasMoreChildrenImpl(): boolean;

    /**
     * Implement this if you want the 'create' option to show up in the tree picker. Should not be called directly
     * @param options User-defined options that are passed to the AzExtParentTreeItem.createChild call
     */
    createChildImpl?(showCreatingTreeItem: (label: string) => void, userOptions?: any): Promise<AzExtTreeItem<TRoot>>;

    /**
     * Implement this if you want non-default (i.e. non-alphabetical) sorting of children. Should not be called directly
     * @param item1 The first item to compare
     * @param item2 The second item to compare
     * @returns A negative number if the item1 occurs before item2; positive if item1 occurs after item2; 0 if they are equivalent
     */
    compareChildrenImpl?(item1: AzExtTreeItem<TRoot>, item2: AzExtTreeItem<TRoot>): number;

    /**
     * If this treeItem should not show up in the tree picker, implement this to provide a child that corresponds to the expectedContextValue. Should not be called directly
     * Otherwise, all children will be shown in the tree picker
     */
    pickTreeItemImpl?(expectedContextValue: string | RegExp): AzExtTreeItem<TRoot> | undefined;
    //#endregion

    /**
     * This class wraps createChildImpl and ensures the tree is updated correctly when an item is created
     */
    createChild(userOptions?: any): Promise<AzExtTreeItem<TRoot>>;

    getCachedChildren(): Promise<AzExtTreeItem<TRoot>[]>;
}

/**
 * Used to ensure a single invalid object does not prevent display of other valid objects
 * Invalid objects will be shown with the error and the object's name. If the name cannot be determined for any invalid objects, a TreeItem will be added to the end with a generic label like "Some items cannot be displayed"
 * @param treeItem The parent tree item
 * @param sourceArray The collection of source objects before converting to TreeItems
 * @param invalidContextValue The context value to use for invalid source objects
 * @param createTreeItem A function that converts a source object to a TreeItem. Return undefined if you want this object to be skipped.
 * @param getLabelOnError A minimal function that gets the label to display for an invalid source object
 */
export declare function createTreeItemsWithErrorHandling<TSource, TTreeItem>(
    treeItem: AzExtParentTreeItem<TTreeItem>,
    sourceArray: TSource[],
    invalidContextValue: string,
    createTreeItem: (source: TSource) => AzExtTreeItem<TTreeItem> | undefined | Promise<AzExtTreeItem<TTreeItem> | undefined>,
    getLabelOnError: (source: TSource) => string | undefined | Promise<string | undefined>): Promise<AzExtTreeItem<TTreeItem>[]>;

export declare class UserCancelledError extends Error { }

export declare abstract class BaseEditor<ContextT> implements Disposable {
    /**
    * Implement this interface if you need to download and upload remote files
    * @param showSavePromptKey Key used globally by VS Code to determine whether or not to show the savePrompt
    */
    constructor(showSavePromptKey: string);

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
 * Used to register VSCode commands. It wraps your callback with consistent error and telemetry handling
 * Use debounce property if you need a delay between clicks for this particular command
 */
export declare function registerCommand(commandId: string, callback: (this: IActionContext, ...args: any[]) => any, debounce?: number): void;

/**
 * Used to register VSCode events. It wraps your callback with consistent error and telemetry handling
 * NOTE: By default, this sends a telemetry event every single time the event fires. It it recommended to use 'this.suppressTelemetry' to only send events if they apply to your extension
 */
export declare function registerEvent<T>(eventId: string, event: Event<T>, callback: (this: IActionContext, ...args: any[]) => any): void;

export declare function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (this: IActionContext) => T | PromiseLike<T>): Promise<T | undefined>;
export declare function callWithTelemetryAndErrorHandlingSync<T>(callbackId: string, callback: (this: IActionContext) => T): T | undefined;

export interface IActionContext {
    properties: TelemetryProperties;
    measurements: TelemetryMeasurements;

    /**
     * Defaults to `false`. If true, successful events are suppressed from telemetry, but cancel and error events are still sent.
     */
    suppressTelemetry?: boolean;

    /**
     * Defaults to `false`
     */
    suppressErrorDisplay?: boolean;

    /**
     * Defaults to `false`
     */
    rethrowError?: boolean;
}

export interface ITelemetryReporter {
    sendTelemetryEvent(eventName: string, properties?: { [key: string]: string | undefined }, measures?: { [key: string]: number | undefined }): void;
}

/**
 * Creates a telemetry reporter.
 *
 * If the environment variable DEBUGTELEMETRY is set to non-empty and non-zero, then the telemetry reporter returned will display
 * to the console window only, and will not send any data.
 *
 * The returned reporter does not need to be disposed by the caller, it will be disposed automatically.
 * @param ctx The extension context
 * @returns An object implementing ITelemetryReporter
 */
export declare function createTelemetryReporter(ctx: ExtensionContext): ITelemetryReporter;

export interface TelemetryProperties {
    /**
     * Defaults to `false`
     * This is used to more accurately track usage, since activation events generally shouldn't 'count' as usage
     */
    isActivationEvent?: 'true' | 'false';
    result?: 'Succeeded' | 'Failed' | 'Canceled';
    error?: string;
    errorMessage?: string;
    cancelStep?: string;
    [key: string]: string | undefined;
}

export interface TelemetryMeasurements {
    duration?: number;
    [key: string]: number | undefined;
}

export declare function parseError(error: any): IParsedError;

export interface IParsedError {
    errorType: string;
    message: string;
    stack?: string;
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
    showInputBox(options: InputBoxOptions): Promise<string>;

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
     * @param options Configures the behaviour of the message.
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

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions & { canPickMany: true }): Promise<T[]>;
    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
}

export declare enum TestInput {
    /**
     * Use the first entry in a quick pick or the default value (if it's defined) for an input box. In all other cases, throw an error
     */
    UseDefaultValue,

    /**
     * Simulates the user hitting the back button in an AzureWizard.
     */
    BackButton
}

/**
 * Wrapper class of several `vscode.window` methods that handle user input.
 * This class is meant to be used for testing in non-interactive mode.
 */
export declare class TestUserInput implements IAzureUserInput {
    /**
     * @param inputs An ordered array of inputs that will be used instead of interactively prompting in VS Code. RegExp is only applicable for QuickPicks and will pick the first input that matches the RegExp.
     */
    public constructor(inputs: (string | RegExp | TestInput)[]);

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
}

/**
 * Implements the AzureAccount interface to log in with a service principal rather than the normal interactive experience.
 * This class should be passed into the AzureTreeDataProvider to replace the dependencies on the Azure Account extension.
 * This class is meant to be used for testing in non-interactive mode in Travis CI.
 */
export declare class TestAzureAccount {
    public constructor();

    /**
     * Simulates a sign in to the Azure Account extension and populates the account with a subscription.
     * Requires the following environment variables to be set: SERVICE_PRINCIPAL_CLIENT_ID, SERVICE_PRINCIPAL_SECRET, SERVICE_PRINCIPAL_DOMAIN
     */
    public signIn(): Promise<void>;
    public signOut(): void;
    public getSubscriptionId(): string;
    public getSubscriptionCredentials(): ServiceClientCredentials;
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
     * Optionally used to suppress persistence for this item, defaults to `false`
     */
    suppressPersistence?: boolean;
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

    /**
     * Optionally used to suppress persistence for this quick pick, defaults to `false`
     */
    suppressPersistence?: boolean;
}

/**
 * Provides additional options for dialogs used in Azure Extensions
 */
export interface IAzureMessageOptions extends MessageOptions {
    /**
     * If specified, a "Learn more" button will be added to the dialog and it will re-prompt every time the user clicks "Learn more"
     */
    learnMoreLink?: string;
}

export interface IWizardOptions<T> {
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
}

/**
 * A wizard that links several user input steps together
 */
export declare class AzureWizard<T extends {}> {
    /**
     * @param wizardContext  A context object that should be used to pass information between steps
     * @param options Options describing this wizard
     */
    public constructor(wizardContext: T, options: IWizardOptions<T>);

    public prompt(actionContext: IActionContext): Promise<void>;
    public execute(actionContext: IActionContext): Promise<void>;
}

export declare abstract class AzureWizardExecuteStep<T extends {}> {
    /**
     * The priority of this step. A smaller value will be executed first.
     */
    public abstract priority: number;

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

export declare abstract class AzureWizardPromptStep<T extends {}> {
    /**
     * If true, step count will not be displayed when prompting. Defaults to false.
     */
    public hideStepCount: boolean;

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

export interface ISubscriptionWizardContext {
    credentials: ServiceClientCredentials;
    subscriptionId: string;
    environment: AzureEnvironment;
    subscriptionDisplayName: string;
}

export interface ILocationWizardContext extends ISubscriptionWizardContext {
    /**
     * The location to use for new resources
     * This value will be defined after `LocationListStep.prompt` occurs or after you call `LocationListStep.setLocation`
     */
    location?: Location;

    /**
     * The task used to get locations.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    locationsTask?: Promise<Location[]>;
}

export declare class LocationListStep<T extends ILocationWizardContext> extends AzureWizardPromptStep<T> {
    /**
     * This will set the wizard context's location (in which case the user will _not_ be prompted for location)
     * For example, if the user selects an existing resource, you might want to use that location as the default for the wizard's other resources
     * @param wizardContext The context of the wizard
     * @param name The name or display name of the location
     */
    public static setLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void>;

    /**
     * Used to get locations. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static getLocations<T extends ILocationWizardContext>(wizardContext: T): Promise<Location[]>;

    public prompt(wizardContext: T): Promise<void>;
    public shouldPrompt(wizardContext: T): boolean;
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

    /**
     * If true, this step will not add a LocationListStep for the "Create new resource group" sub wizard.
     * This is meant for situations when the location can be inferred from other resources later in the wizard.
     */
    resourceGroupDeferLocationStep?: boolean;

    newResourceGroupName?: string;
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
 * Interface for common extension variables used throughout the UI package.
 */
export interface UIExtensionVariables {
    context: ExtensionContext;
    outputChannel: OutputChannel;
    ui: IAzureUserInput;
    reporter: ITelemetryReporter;
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

/**
 * Creates an Azure client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export function createAzureClient<T extends IAddUserAgent>(
    clientInfo: { credentials: ServiceClientCredentials; subscriptionId: string; environment: AzureEnvironment; },
    clientType: { new(credentials: ServiceClientCredentials, subscriptionId: string, baseUri?: string, options?: AzureServiceClientOptions): T }): T;

/**
 * Creates an Azure subscription client, ensuring best practices are followed. For example:
 * 1. Adds extension-specific user agent
 * 2. Uses resourceManagerEndpointUrl to support sovereigns
 */
export function createAzureSubscriptionClient<T extends IAddUserAgent>(
    clientInfo: { credentials: ServiceClientCredentials; environment: AzureEnvironment; },
    clientType: { new(credentials: ServiceClientCredentials, baseUri?: string, options?: AzureServiceClientOptions): T }): T;

/**
 * Wraps an Azure Extension's API in a very basic provider that adds versioning.
 * Multiple APIs with different versions can be supplied, but ideally a single backwards-compatible API is all that's necessary.
 */
export function createApiProvider(azExts: AzureExtensionApi[]): AzureExtensionApiProvider;
