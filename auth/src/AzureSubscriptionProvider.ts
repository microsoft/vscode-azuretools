/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { AzureSubscription } from './AzureSubscription';

/**
 * An interface for obtaining Azure subscription information
 */
export interface AzureSubscriptionProvider {
    /**
     * Gets a list of Azure subscriptions available to the user.
     *
     * @param filter - Whether to filter the list returned, according to the list returned
     * by `getTenantFilters()` and `getSubscriptionFilters()`. Optional, default true.
     *
     * @returns A list of Azure subscriptions.
     *
     * @throws A {@link NotSignedInError} If the user is not signed in to Azure.
     * Use {@link isSignedIn} and/or {@link signIn} before this method to ensure
     * the user is signed in.
     */
    getSubscriptions(filter: boolean): Promise<AzureSubscription[]>;

    /**
     * Checks to see if a user is signed in.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    isSignedIn(): Promise<boolean>;

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    signIn(): Promise<boolean>;

    /**
     * An event that is fired when the user signs in. Debounced to fire at most once every 5 seconds.
     */
    onDidSignIn: vscode.Event<void>;

    /**
     * Signs the user out
     *
     * @deprecated Not currently supported by VS Code auth providers
     *
     * @throws Throws an {@link Error} every time
     */
    signOut(): Promise<void>;

    /**
     * An event that is fired when the user signs out. Debounced to fire at most once every 5 seconds.
     */
    onDidSignOut: vscode.Event<void>;
}
