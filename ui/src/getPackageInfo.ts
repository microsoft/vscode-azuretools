/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from "vscode";
import { AzExtFsExtra } from "./utils/AzExtFsExtra";
import { ext } from "./extensionVariables";

interface IPackageInfo {
    extensionName: string;
    extensionVersion: string;
    aiKey: string;
    extensionId: string;
    bugsUrl: string | undefined;
}

let packageInfo: IPackageInfo | undefined;

export function getPackageInfo(ctx?: ExtensionContext): IPackageInfo {
    if (!packageInfo) {
        if (!ctx) {
            ctx = ext.context;
        }

        const packageJson: IPackageJson = <IPackageJson>JSON.parse(AzExtFsExtra.readFileSync(ctx.asAbsolutePath('package.json')));

        const extensionName: string | undefined = packageJson.name;
        const extensionVersion: string | undefined = packageJson.version;
        const aiKey: string | undefined = packageJson.aiKey;
        const publisher: string | undefined = packageJson.publisher;
        const bugsUrl: string | undefined = !packageJson.bugs ? undefined :
            typeof packageJson.bugs === 'string' ? packageJson.bugs :
                packageJson.bugs.url;

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

        packageInfo = { extensionName, extensionVersion, aiKey, extensionId, bugsUrl };
    }

    return packageInfo;
}

interface IPackageJson {
    version?: string;
    name?: string;
    publisher?: string;
    aiKey?: string;
    bugs?: string | {
        url?: string;
    };
}
