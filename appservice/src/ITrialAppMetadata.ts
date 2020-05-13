/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ITrialAppMetadata {
    url: string;
    ibizaUrl: string;
    monacoUrl: string;
    contentDownloadUrl: string;
    gitUrl: string;
    bashGitUrl: string;
    timeLeft: number;
    AppService: string;
    IsRbacEnabled: boolean;
    templateName: string;
    isExtended: boolean;
    csmId: string;
    siteName: string;
    publishingUserName: string;
    publishingPassword: string;
    siteGuid: string;
    loginSession: string;
    hostName: string;
    scmHostName: string;
}
