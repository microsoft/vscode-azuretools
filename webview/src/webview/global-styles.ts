/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Side-effect module: importing this file pulls the global webview styles into
// a consumer's bundle. Import it from the entry of an extension-owned webview
// bundle so views inherit the shared theme/baseline CSS.
//
// Example (in a consumer's webview entry):
//   import '@microsoft/vscode-azext-webview/webview/global-styles';

import './styles/global.scss';

