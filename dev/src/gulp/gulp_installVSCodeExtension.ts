/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

// tslint:disable-next-line: export-name
export async function gulp_installVSCodeExtension(publisherId: string, extensionName: string): Promise<void> {
    const extensionId: string = `${publisherId}.${extensionName}`;
    const extensionsPath: string = path.join(os.homedir(), '.vscode', 'extensions');
    let existingExtensions: string[] = [];
    if (await fse.pathExists(extensionsPath)) {
        existingExtensions = await fse.readdir(extensionsPath);
    }

    if (!existingExtensions.some((e: string) => e.includes(extensionId))) {
        console.log(`"Installing" test extension with id "${extensionId}".`);

        const version: string = '0.0.1';
        const extensionPath: string = path.join(extensionsPath, `${extensionId}-${version}`);
        const packageJsonPath: string = path.join(extensionPath, 'package.json');
        const packageJson: {} = {
            name: extensionName,
            displayName: "",
            publisher: publisherId,
            description: "",
            version: version,
            engines: {
                vscode: "^1.31.0"
            },
            activationEvents: [],
            main: "./extension",
            contributes: {}
        };
        await fse.ensureFile(packageJsonPath);
        await fse.writeJSON(packageJsonPath, packageJson);

        const extensionJsPath: string = path.join(extensionPath, 'extension.js');
        const extensionJs: string = `exports.activate = function activate() { };exports.deactivate = function deactivate() { };`;
        await fse.ensureFile(extensionJsPath);
        await fse.writeFile(extensionJsPath, extensionJs);
    } else {
        console.log(`Extension with id "${extensionId}" already installed.`);
        // We need to signal to gulp that we've completed this async task
        return Promise.resolve();
    }
}
