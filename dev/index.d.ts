/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from "child_process";
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import { Event, InputBoxOptions, MessageItem, MessageOptions, OpenDialogOptions, OutputChannel, QuickPickItem, QuickPickOptions, Uri } from "vscode";
import * as webpack from 'webpack';

/**
 * Sets up test suites against an extension package.json file (run this at global level or inside a suite, not inside a test)
 *
 * @param packageJson The extension's package.json contents as an object
 */
export declare function addPackageLintSuites(
    getExtensionContext: () => {},
    getCommands: () => Promise<string[]>,
    packageJsonAsObject: {},
    options: IPackageLintOptions
): void;


export interface IPackageLintOptions {
    /**
     * Commands which are registered by the extension but should not appear in package.json
     */
    commandsRegisteredButNotInPackage?: string[];
}

/**
 * Re-routes output to the console instead of a VS Code output channel (which disappears after a test run has finished)
 */
export class TestOutputChannel implements OutputChannel {
    public name: string;
    public append(value: string): void;
    public appendLine(value: string): void;
    public appendLog(value: string, options?: { resourceName?: string, date?: Date }): void
    public clear(): void;
    public show(): void;
    public hide(): void;
    public dispose(): void;
}

export type Verbosity = 'debug' | 'silent' | 'normal';

export interface DefaultWebpackOptions {
    projectRoot: string;

    /**
     * Additional entrypoints besides the main 'extension' entrypoint
     */
    entries?: { [key: string]: string };

    /**
     * Modules that we can't easily webpack for some reason. These node modules and all their dependencies will be excluded from bundling.
     */
    externalNodeModules?: string[];

    /** Additional external entries (externalNodeModules are added automatically) */
    externals?: webpack.ExternalsObjectElement,

    /**
     * Additional loader module rules
     */
    loaderRules?: webpack.RuleSetRule[],

    /**
     * Additional plug-ins
     */
    plugins?: webpack.Plugin[];

    /**
     * Suppress deleting the dist folder before webpack
     */
    suppressCleanDistFolder?: boolean;

    /**
     * Logging verbosity
     */
    verbosity?: Verbosity;
}

export declare function getDefaultWebpackConfig(options: DefaultWebpackOptions): webpack.Configuration;

/**
 * "Installs" a fake version of the azure account extension before running tests. The extension isn't actually used for tests, but our extension would fail to activate without this
 */
export declare function gulp_installAzureAccount(): Promise<void>;

/**
 * Writes down a fake extension to make VS Code think a dependency is installed, useful before running tests
 * useInsiders defaults to false, only mark true if you want tests to run in vscode-insiders
 */
export declare function gulp_installVSCodeExtension(publisherId: string, extensionName: string, useInsiders?: boolean): Promise<void>;

/**
 * Spawns a webpack process
 */
export declare function gulp_webpack(mode: string): cp.ChildProcess;

/**
 * Information specific to the Subscription
 */
export interface ISubscriptionContext {
    credentials: ServiceClientCredentials;
    subscriptionDisplayName: string;
    subscriptionId: string;
    subscriptionPath: string;
    tenantId: string;
    userId: string;
    environment: AzureEnvironment;
}

/**
 * Implements the AzureAccount interface to log in with a service principal rather than the normal interactive experience.
 * This class should be passed into the AzureTreeDataProvider to replace the dependencies on the Azure Account extension.
 * This class is meant to be used for testing in non-interactive mode in Travis CI.
 */
export declare class TestAzureAccount {
    public constructor(vscode: typeof import('vscode'));

    /**
     * Simulates a sign in to the Azure Account extension and populates the account with a subscription.
     * Requires the following environment variables to be set: SERVICE_PRINCIPAL_CLIENT_ID, SERVICE_PRINCIPAL_SECRET, SERVICE_PRINCIPAL_DOMAIN
     */
    public signIn(): Promise<void>;
    public signOut(): void;
    public getSubscriptionContext(): ISubscriptionContext;
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

export type PromptResult = string | QuickPickItem | QuickPickItem[] | MessageItem | Uri[];

/**
 * Wrapper class of several `vscode.window` methods that handle user input.
 * This class is meant to be used for testing in non-interactive mode.
 */
export declare class TestUserInput {
    public readonly onDidFinishPrompt: Event<PromptResult>;

    public constructor(vscode: typeof import('vscode'));

    /**
     * An ordered array of inputs that will be used instead of interactively prompting in VS Code. RegExp is only applicable for QuickPicks and will pick the first input that matches the RegExp.
     */
    public runWithInputs(inputs: (string | RegExp | TestInput)[], callback: () => Promise<void>): Promise<void>;

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;
    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions & { canPickMany: true }): Promise<T[]>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
}
