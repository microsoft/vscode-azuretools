/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { StringDictionary } from "azure-arm-website/lib/models";
import * as fse from 'fs-extra';
import * as path from 'path';
import { UserCancelledError } from "vscode-azureextensionui";
import { ext } from '../extensionVariables';
import { SiteClient } from "../SiteClient";

export namespace javaUtils {
    const DEFAULT_PORT: string = '8080';
    const PORT_KEY: string = 'PORT';

    export function isJavaTomcatRuntime(runtime: string | undefined): boolean {
        return !!runtime && runtime.toLowerCase().startsWith('tomcat');
    }

    export function isJavaSERuntime(runtime: string | undefined): boolean {
        return !!runtime && runtime.toLowerCase() === 'java|8-jre8';
    }

    export function isJavaSERequiredPortConfigured(appSettings: StringDictionary | undefined): boolean {
        if (appSettings && appSettings.properties) {
            for (const key of Object.keys(appSettings.properties)) {
                if (key.toUpperCase() === PORT_KEY) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Return if the given workspace folder contains a Java project at the root path.
     * For now we will only take Maven and Gradle into consideration.
     *
     * @param workspaceFolderPath The file system path of the workspace folder
     */
    export async function isJavaProject(workspaceFolderPath: string): Promise<boolean> {
        if (await fse.pathExists(path.join(workspaceFolderPath, 'pom.xml'))) {
            return true;
        }

        if (await fse.pathExists(path.join(workspaceFolderPath, 'build.gradle'))) {
            return true;
        }

        return false;
    }

    export async function configureJavaSEAppSettings(siteClient: SiteClient): Promise<StringDictionary | undefined> {
        const appSettings: StringDictionary = await siteClient.listApplicationSettings();
        if (isJavaSERequiredPortConfigured(appSettings)) {
            return undefined;
        }

        // tslint:disable-next-line:strict-boolean-expressions
        appSettings.properties = appSettings.properties || {};
        const port: string = await ext.ui.showInputBox({
            value: DEFAULT_PORT,
            prompt: 'Configure the PORT (Application Settings) which your Java SE Web App exposes',
            placeHolder: 'PORT',
            validateInput: (input: string): string | undefined => {
                return /^[0-9]+$/.test(input) ? undefined : 'please specify a valid port number';
            }
        });
        if (!port) {
            throw new UserCancelledError();
        }
        appSettings.properties[PORT_KEY] = port;
        return siteClient.updateApplicationSettings(appSettings);
    }
}
