/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Environment } from "@azure/ms-rest-azure-env";
import * as cp from "child_process";
import { Disposable, Event, InputBoxOptions, MessageItem, MessageOptions, OpenDialogOptions, OutputChannel, QuickPickItem, QuickPickOptions, Uri } from "vscode";
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
    public replace(value: string): void;
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
    externals?: { [key: string]: string },

    /**
     * Additional loader module rules
     */
    loaderRules?: webpack.RuleSetRule[],

    /**
     * Additional plug-ins
     */
    plugins?: webpack.Configuration['plugins'];

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
 * "Installs" a fake version of the resource groups extension before running tests. The extension isn't actually used for tests, but our extension would fail to activate without this
 */
export declare function gulp_installResourceGroups(): Promise<void>;

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

export type PromptResult = {
    value: string | QuickPickItem | QuickPickItem[] | MessageItem | Uri[];

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
     * An ordered array of inputs that will be used instead of interactively prompting in VS Code. RegExp is only applicable for QuickPicks and will pick the first input that matches the RegExp.
     */
    public runWithInputs<T>(inputs: (string | RegExp | TestInput)[], callback: () => Promise<T>): Promise<T>;

    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T>;
    public showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions & { canPickMany: true }): Promise<T[]>;
    public showInputBox(options: InputBoxOptions): Promise<string>;
    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    public showOpenDialog(options: OpenDialogOptions): Promise<Uri[]>;
}

export interface TestActionContext {
    telemetry: {
        properties: { [key: string]: string | undefined; }
        measurements: { [key: string]: number | undefined; }
    };
    errorHandling: {
        issueProperties: {}
    };
    valuesToMask: string[];
    ui: TestUserInput;
}

export declare function createTestActionContext(): Promise<TestActionContext>;

/**
 * Similar to `createTestActionContext` but with some extra logging
 */
export declare function runWithTestActionContext(callbackId: string, callback: (context: TestActionContext) => Promise<void>): Promise<void>;

type registerOnActionStartHandlerType = (handler: (context: { callbackId: string; ui: Partial<TestUserInput>; }) => void) => Disposable;

/**
 * Alternative to `TestUserInput.runWithInputs` that can be used on the rare occasion when the `IActionContext` must be created inside `callback` instead of before `callback`
 *
 * @param callbackId The expected callbackId for the action to be run
 * @param inputs An ordered array of inputs that will be used instead of interactively prompting in VS Code
 * @param registerOnActionStartHandler The function defined in 'vscode-azureextensionui' for registering onActionStart handlers
 * @param callback The callback to run
 */
export declare function runWithInputs<T>(callbackId: string, inputs: (string | RegExp | TestInput)[], registerOnActionStartHandler: registerOnActionStartHandlerType, callback: () => Promise<T>): Promise<T>;
