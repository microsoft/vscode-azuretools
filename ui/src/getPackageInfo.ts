/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import { ExtensionContext } from "vscode";
import { IActionContext } from "../index";
import { callWithTelemetryAndErrorHandling } from "./callWithTelemetryAndErrorHandling";
import { ext } from "./extensionVariables";
import { parseError } from "./parseError";

export function getPackageInfo(ctx?: ExtensionContext): { extensionName: string, extensionVersion: string, aiKey: string, extensionId: string, bugsUrl: string | undefined } {
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
                packageJson = <IPackageJson>fse.readJsonSync(ctx.asAbsolutePath('package.json'));
            } else {
                throw new Error('No extension context');
            }
        } catch (error) {
            console.error(`getPackageInfo: ${parseError(error).message}`);
            throw error;
        }
    });

    // tslint:disable-next-line:strict-boolean-expressions
    const extensionName: string | undefined = packageJson.name;
    const extensionVersion: string | undefined = packageJson.version;
    const aiKey: string | undefined = packageJson.aiKey;
    const publisher: string | undefined = packageJson.publisher;
    const bugsUrl: string | undefined = packageJson.bugs && packageJson.bugs.url;

    if (!aiKey) {
        throw new Error('Extension\'s package.json is missing aiKey');
    }
    if (!extensionName) {
        throw new Error('Extension\'s package.json is missing name');
    }
    if (!publisher) {
        throw new Error('Extension\'s package.json is missing publisher');
    }
    if (!extensionVersion) {
        throw new Error('Extension\'s package.json is missing version');
    }

    const extensionId: string = `${packageJson.publisher}.${packageJson.name}`;

    return { extensionName, extensionVersion, aiKey, extensionId, bugsUrl };
}

interface IPackageJson {
    version?: string;
    name?: string;
    publisher?: string;
    aiKey?: string;
    bugs?: {
        url?: string;
    }
}
