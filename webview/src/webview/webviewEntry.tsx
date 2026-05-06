/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './styles/global.scss';

import { createRoot } from 'react-dom/client';
import { type WebviewApi } from 'vscode-webview';
import { DynamicThemeProvider } from './theme/DynamicThemeProvider';
import { type WebviewState, WithWebviewContext } from './WebviewContext';
import { getView } from './WebviewRegistry';

export function render(key: string, vscodeApi: WebviewApi<WebviewState>, rootId = 'root'): void {
    const container = document.getElementById(rootId);
    if (!container) {
        throw new Error(`Element with id of ${rootId} not found.`);
    }

    const Component = getView(key);
    if (!Component) {
        throw new Error(`View "${key}" is not registered. Available views can be checked via getView().`);
    }

    const root = createRoot(container);

    root.render(
        <DynamicThemeProvider useAdaptive={true}>
            <WithWebviewContext vscodeApi={vscodeApi}>
                <Component />
            </WithWebviewContext>
        </DynamicThemeProvider>,
    );
}
