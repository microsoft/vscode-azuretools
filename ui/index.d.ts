/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import { Uri, TreeDataProvider, Disposable, TreeItem, Event, OutputChannel, Memento, TextDocument, ExtensionContext } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

export declare class AzureTreeDataProvider implements TreeDataProvider<IAzureNode>, Disposable {
    public static readonly subscriptionContextValue: string;
    public onDidChangeTreeData: Event<IAzureNode>;
    /**
     * Azure Tree Data Provider
     * @param resourceProvider Describes the resources to be displayed under subscription nodes
     * @param loadMoreCommandId The command your extension will register for the 'Load More...' node
     * @param rootTreeItems Any nodes other than the subscriptions that should be shown at the root of the explorer
     * @param telemetryReporter Optionally used to track telemetry for the tree
     */
    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, rootTreeItems?: IAzureTreeItem[], telemetryReporter?: TelemetryReporter);
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
