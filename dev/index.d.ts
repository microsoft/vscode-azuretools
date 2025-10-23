/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, Event, InputBoxOptions, LogLevel, LogOutputChannel, MessageItem, MessageOptions, OpenDialogOptions, QuickPickItem, QuickPickOptions as VSCodeQuickPickOptions, Uri, WorkspaceFolder, WorkspaceFolderPickOptions } from "vscode";

/**
 * Re-routes output to the console instead of a VS Code output channel (which disappears after a test run has finished)
 */
export declare class TestOutputChannel implements LogOutputChannel {
    public name: string;
    public append(value: string): void;
    public appendLine(value: string): void;
    public appendLog(value: string, options?: { resourceName?: string, date?: Date }): void;
    public replace(value: string): void;
    public clear(): void;
    public show(): void;
    public hide(): void;
    public dispose(): void;
    logLevel: LogLevel;
    onDidChangeLogLevel: Event<LogLevel>;
    trace(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(error: string | Error, ...args: any[]): void;
}


export declare enum TestInput {
    /**
     * Use the first entry in a quick pick or the default value (if it's defined) for an input box. In all other cases, throw an error
     */
    UseDefaultValue,

    /**
     * Simulates the user hitting the back button in an AzureWizard.
     */
    BackButton,

    /**
     * Simulates going back three quickpick steps in an AzureWizard.
     */
    BackThreeSteps
}

export declare type PromptResult = {
    value: string | QuickPickItem | QuickPickItem[] | MessageItem | Uri[] | WorkspaceFolder;

    /**
     * True if the user did not change from the default value, currently only supported for `showInputBox`
     */
    matchesDefault?: boolean;
};

/**
 * Wrapper class of several `vscode.window` methods that handle user input.
 * This class is meant to be used for testing in non-interactive mode.
 */
export declare class TestUserInput {
    public readonly onDidFinishPrompt: Event<PromptResult>;

    public constructor(vscode: typeof import('vscode'));

    /**
     * Boolean set to indicate whether the UI is being used for test inputs. For`TestUserInput`, this will always default to true.
     * See: https://github.com/microsoft/vscode-azuretools/pull/1807
     */
    readonly isTesting: boolean;

    /**
     * An ordered array of inputs that will be used instead of interactively prompting in VS Code. RegExp is only applicable for QuickPicks and will pick the first input that matches the RegExp.
     */
    public runWithInputs<T>(inputs: (string | RegExp | TestInput)[], callback: () => Promise<T>): Promise<T>;

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: VSCodeQuickPickOptions): Promise<T>;
    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: VSCodeQuickPickOptions & { canPickMany: true }): Promise<T[]>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
    public showWorkspaceFolderPick(options: WorkspaceFolderPickOptions): Promise<WorkspaceFolder>;
}

export declare interface TestActionContext {
    telemetry: {
        properties: { [key: string]: string | undefined; };
        measurements: { [key: string]: number | undefined; };
    };
    errorHandling: {
        issueProperties: {};
    };
    valuesToMask: string[];
    ui: TestUserInput;
}

export declare function createTestActionContext(): Promise<TestActionContext>;

/**
 * Similar to `createTestActionContext` but with some extra logging
 */
export declare function runWithTestActionContext(callbackId: string, callback: (context: TestActionContext) => Promise<void>): Promise<void>;

declare type registerOnActionStartHandlerType = (handler: (context: { callbackId: string; ui: Partial<TestUserInput>; }) => void) => Disposable;

/**
 * Alternative to `TestUserInput.runWithInputs` that can be used on the rare occasion when the `IActionContext` must be created inside `callback` instead of before `callback`
 *
 * @param callbackId The expected callbackId for the action to be run
 * @param inputs An ordered array of inputs that will be used instead of interactively prompting in VS Code
 * @param registerOnActionStartHandler The function defined in 'vscode-azureextensionui' for registering onActionStart handlers
 * @param callback The callback to run
 */
export declare function runWithInputs<T>(callbackId: string, inputs: (string | RegExp | TestInput)[], registerOnActionStartHandler: registerOnActionStartHandlerType, callback: () => Promise<T>): Promise<T>;
