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
     */
    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, rootTreeItems?: IAzureTreeItem[]);
    public getTreeItem(node: IAzureNode): TreeItem;
    public getChildren(node?: IAzureParentNode): Promise<IAzureNode[]>;
    public refresh(node?: IAzureNode, clearCache?: boolean): void;
    public loadMore(node: IAzureNode): Promise<void>;
    public showNodePicker(expectedContextValue: string): Promise<IAzureNode>;
    public dispose(): void;
}

/**
 * The AzureTreeDataProvider returns instances of IAzureNode, which are wrappers for IAzureTreeItem with relevant context and functions from the tree
 */
export interface IAzureNode<T extends IAzureTreeItem = IAzureTreeItem> {
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
    refresh(): void;

    /**
     * This class wraps IAzureTreeItem.deleteTreeItem and ensures the tree is updated correctly when an item is deleted
     */
    deleteNode(): Promise<void>;

    /**
     * This method combines the environment.portalLink and IAzureTreeItem.id to open the resource in the portal
     */
    openInPortal(): void;
}

export interface IAzureParentNode<T extends IAzureTreeItem = IAzureTreeItem> extends IAzureNode<T> {
    /**
     * This class wraps IChildProvider.createChild and ensures the tree is updated correctly when an item is created
     */
    createChild(): Promise<IAzureNode>;

    getCachedChildren(): Promise<IAzureNode[]>
}

/**
 * Implement this interface if your treeItem does not have children, otherwise implement IAzureParentTreeItem
 */
export interface IAzureTreeItem {
    /**
     * A unique id to identify this tree item. This id is also used for openInPortal
     */
    id: string;
    label: string;
    iconPath?: string | Uri | { light: string | Uri; dark: string | Uri };
    commandId?: string;
    contextValue: string;
    deleteTreeItem?(node: IAzureNode): Promise<void>;
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
     */
    createChild?(node: IAzureNode, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem>;
}

/**
 * Implement this interface if your treeItem has children, otherwise implement IAzureTreeItem
 */
export interface IAzureParentTreeItem extends IAzureTreeItem, IChildProvider {
    /**
     * If this treeItem should not show up in the node picker, implement this to provide a child that corresponds to the expectedContextValue
     * Otherwise, all children will be shown in the node picker
     */
    pickTreeItem?(expectedContextValue: string): IAzureParentTreeItem | undefined;
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

    onDidSaveTextDocument(trackTelemetry: () => void, globalState: Memento, doc: TextDocument): Promise<void>;
    showEditor(context: ContextT, sizeLimit?: number): Promise<void>;
    dispose(): Promise<void>;
}

/**
 * Used to register VSCode commands and events. It wraps your callback with consistent error and telemetry handling
 */
export declare class AzureActionHandler {
    constructor(extensionContext: ExtensionContext, outputChannel: OutputChannel, telemetryReporter?: TelemetryReporter);

    registerCommand(commandId: string, callback: (...args: any[]) => any): void
    registerCommandWithCustomTelemetry(commandId: string, callback: (properties: TelemetryProperties, measurements: TelemetryMeasurements, ...args: any[]) => any): void;

    /**
     * NOTE: An event callback must call trackTelemetry() in order for it to be "opted-in" for telemetry. This is meant to be called _after_ the event has determined that it apples to that extension
     * For example, we might not want to track _every_ onDidSaveEvent, just the save events for our files
     */
    registerEvent<T>(eventId: string, event: Event<T>, callback: (trackTelemetry: () => void, ...args: any[]) => any): void;
    registerEventWithCustomTelemetry<T>(eventId: string, event: Event<T>, callback: (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements, ...args: any[]) => any): void;
}

export type TelemetryProperties = { [key: string]: string; };
export type TelemetryMeasurements = { [key: string]: number };