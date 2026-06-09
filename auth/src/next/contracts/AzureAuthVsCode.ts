/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

/**
 * The subset of the VS Code `authentication` namespace used by this package.
 *
 * @remarks The full `typeof import('vscode').authentication` is assignable to this type, so callers
 * may simply pass `vscode.authentication`.
 */
export type VsCodeAuthentication = Pick<typeof vscode.authentication, 'getSession' | 'getAccounts' | 'onDidChangeSessions'>;

/**
 * The subset of the VS Code `workspace` namespace used by this package, for configuration lookup.
 *
 * @remarks The full `typeof import('vscode').workspace` is assignable to this type, so callers may
 * simply pass `vscode.workspace`.
 */
export type VsCodeWorkspace = Pick<typeof vscode.workspace, 'getConfiguration' | 'onDidChangeConfiguration'>;

/**
 * A narrowed view of the VS Code namespace (`typeof import('vscode')`) exposing only the members used by
 * the new auth setup. Pass the whole `vscode` namespace import to satisfy this type; it is used both for
 * the authentication namespace and for the configuration lookup.
 */
export interface AzureAuthVsCode {
    /**
     * The VS Code authentication namespace, used to acquire sessions and enumerate accounts.
     */
    readonly authentication: VsCodeAuthentication;

    /**
     * The VS Code workspace namespace, used to read the configured Azure cloud environment.
     */
    readonly workspace: VsCodeWorkspace;

    /**
     * The VS Code localization namespace, used for localizing log/error messages.
     */
    readonly l10n: Pick<typeof vscode.l10n, 't'>;

    /**
     * The `EventEmitter` class, used to raise refresh-suggested events.
     */
    readonly EventEmitter: typeof vscode.EventEmitter;

    /**
     * The `Disposable` class, used to compose disposables.
     */
    readonly Disposable: typeof vscode.Disposable;

    /**
     * The `CancellationError` class, thrown when an operation is cancelled.
     */
    readonly CancellationError: typeof vscode.CancellationError;

    /**
     * The `ConfigurationTarget` enum, used when updating configuration.
     */
    readonly ConfigurationTarget: typeof vscode.ConfigurationTarget;
}
