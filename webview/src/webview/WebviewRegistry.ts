/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfirmationView } from "./ConfirmationView";
import { LoadingView } from "./LoadingView";
import { TemplateGalleryView } from "./TemplateGallery/TemplateGalleryView";

export const WebviewRegistry = {
    confirmationView: ConfirmationView,
    loadingView: LoadingView,
    templateGalleryView: TemplateGalleryView,
} as const;
