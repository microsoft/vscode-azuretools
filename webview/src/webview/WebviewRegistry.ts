/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfirmationView } from "./ConfirmationView";
import { LoadingView } from "./LoadingView";

export const WebviewRegistry = {
    confirmationView: ConfirmationView,
    loadingView: LoadingView
} as const;
