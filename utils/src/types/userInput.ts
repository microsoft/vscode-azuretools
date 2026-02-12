/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Event, InputBoxOptions, MessageItem, MessageOptions, OpenDialogOptions, QuickPickItem, Uri, WorkspaceFolder, WorkspaceFolderPickOptions, QuickPickOptions as VSCodeQuickPickOptions } from 'vscode';

export type PromptResult = {
    value: string | QuickPickItem | QuickPickItem[] | MessageItem | Uri[] | WorkspaceFolder;

    /**
     * True if the user did not change from the default value, currently only supported for `showInputBox`
     */
    matchesDefault?: boolean;
};

/**
 * Wrapper interface of several methods that handle user input
 * The implementations of this interface are accessed through `IActionContext.ui` or `TestActionContext.ui`
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

    /**
     * Shows a selection list of existing workspace folders to choose from.
     *
     * @param options Configures the behavior of the workspace folder list.
     * @throws `UserCancelledError` if the user cancels.
     * @returns A promise that resolves to the selected `WorkspaceFolder`.
     */
    showWorkspaceFolderPick(options: AzExtWorkspaceFolderPickOptions): Promise<WorkspaceFolder>;
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
export type AzureQuickPickItemPriority = 'highest' | 'normal';

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

    /**
     * @deprecated Use {@link IAzureQuickPickOptions.isPickSelected} instead
     */
    picked?: boolean;
}

/**
 * Provides additional options for QuickPicks used in Azure Extensions
 */
export interface IAzureQuickPickOptions extends VSCodeQuickPickOptions, AzExtUserInputOptions {
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
    /**
     * Optional async input validation task to run upon triggering 'onDidAccept'
     */
    asyncValidationTask?: (value: string) => Promise<string | undefined | null>;
}

/**
* Provides additional options for open dialogs used in Azure Extensions
*/
export interface AzExtOpenDialogOptions extends OpenDialogOptions, AzExtUserInputOptions { }

/**
* Provides additional options for workspace folder picks used in Azure Extensions
*/
export type AzExtWorkspaceFolderPickOptions = WorkspaceFolderPickOptions & AzExtUserInputOptions;

/**
 * A queue of inputs that should be used by an {@link IAzureUserInput} implementation to answer prompts instead of showing prompts to the user.
 * If the head of the queue is undefined or null, then the {@link IAzureUserInput} implementation should show a prompt to the user.
 */
export type AzureUserInputQueue = (QuickPickItem | string | MessageItem | Uri[] | undefined | null)[];
