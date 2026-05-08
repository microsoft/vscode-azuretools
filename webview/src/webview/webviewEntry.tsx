/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './styles/global.scss';

import { createWebviewRender } from './createWebviewRender';
import { WebviewRegistry } from './WebviewRegistry';

export type ViewKey = keyof typeof WebviewRegistry;

export const render = createWebviewRender(WebviewRegistry);
