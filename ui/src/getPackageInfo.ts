/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ExtensionContext } from "vscode";
import { IActionContext } from "../index";
import { callWithTelemetryAndErrorHandling } from "./callWithTelemetryAndErrorHandling";
import { ext, extInitialized } from "./extensionVariables";
import { parseError } from "./parseError";

export function getPackageInfo(ctx?: ExtensionContext): { extensionName: string, extensionVersion: string, aiKey?: string, extensionId: string } {
    assert(extInitialized, 'registerUIExtensionVariables must be called first');

    if (!ctx) {
        ctx = ext.context;
    }

    let packageJson: IPackageJson = {};
    // tslint:disable-next-line:no-floating-promises
    callWithTelemetryAndErrorHandling('azureTools.getPackageInfo', function (this: IActionContext): void {
        this.suppressErrorDisplay = true;
        this.suppressTelemetry = true; // only report errors

        try {
            if (ctx) {
                // tslint:disable-next-line:non-literal-require
                packageJson = <IPackageJson>require(ctx.asAbsolutePath('package.json'));
            } else {
                throw new Error('No extension context');
            }
        } catch (error) {
            console.error(`getPackageInfo: ${parseError(error).message}`);
            throw error;
        }
    });

    // tslint:disable-next-line:strict-boolean-expressions
    const extensionName: string = packageJson.name || 'vscode-azuretools';
    // tslint:disable-next-line:strict-boolean-expressions
    const extensionVersion: string = packageJson.version || 'Unknown';
    const aiKey: string | undefined = packageJson.aiKey;
    const extensionId: string = `${packageJson.publisher}.${packageJson.name}`;
    return { extensionName, extensionVersion, aiKey, extensionId };
}

interface IPackageJson {
    version?: string;
    name?: string;
    publisher?: string;
    aiKey?: string;
}
