/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext, ISubscriptionContext, UserCancelledError } from "vscode-azureextensionui";
import { DBTreeItem } from './DBTreeItem';
import { postgresDefaultPort } from '../constants';
import { PostgresServerType } from '../create/PostgresAccountWizard/abstract/models';
import { localize } from '../utils/localize';
import { nonNullProp } from '../utils/nonNull';
import { Client, ClientConfig } from "pg";
import { ConnectionOptions } from 'tls';
import { ext } from '../extensionVariables';
import { createAbstractPostgresClient } from '../create/PostgresAccountWizard/abstract/AbstractPostgresClient';
import { configurePostgresFirewall, getPublicIp } from './configurePostgresFirewall';

export async function enterPostgresCredentials(context: ISubscriptionContext & IActionContext, databaseTreeItem: DBTreeItem): Promise<string[] | undefined> {
    return await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token): Promise<string[] | undefined> => {
        while (true) {
            const hostName = nonNullProp(databaseTreeItem, 'hostName');
            const serverName: string = nonNullProp(nonNullProp(databaseTreeItem, 'azureData'), 'accountName');
            const postgresData = nonNullProp(databaseTreeItem, 'postgresData');
            const serverType = nonNullProp(postgresData, 'serverType');

            if (!(await isFirewallRuleSet(context, databaseTreeItem))) {
                await configurePostgresFirewall(context, databaseTreeItem);
            }

            const setupMessage = localize('settingUpCredentials', 'Setting up Postgres Database Credentials...');
            reportMessage(setupMessage, progress, token);
            let username = await context.ui.showInputBox({
                prompt: localize('enterUsername', 'Enter username for server "{0}"', hostName),
                stepName: 'enterPostgresUsername',
                validateInput: (value: string) => { return (value && value.length) ? undefined : localize('usernameCannotBeEmpty', 'Username cannot be empty.'); }
            });
            // Username doesn't contain servername prefix for Postgres Flexible Servers only
            // As present on the portal for any Flexbile Server instance
            const usernameSuffix: string = `@${serverName}`;
            if (serverType === PostgresServerType.Single && !username.includes(usernameSuffix)) {
                username += usernameSuffix;
            }

            const password = await context.ui.showInputBox({
                prompt: localize('enterPassword', 'Enter password for server "{0}"', hostName),
                stepName: 'enterPostgresPassword',
                password: true,
                validateInput: (value: string) => { return (value && value.length) ? undefined : localize('passwordCannotBeEmpty', 'Password cannot be empty.'); }
            });


            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const client: Client | undefined = await verifyPostgresCreds(databaseTreeItem, username, password);

            if (client) {
                const completedMessage: string = localize('setupCredentialsMessage', 'Successfully added credentials to server "{0}".', serverName);
                void vscode.window.showInformationMessage(completedMessage);
                reportMessage(completedMessage, progress, token);
                return [username, password];
            } else {
                const invalidMessage: string = localize('invalidCredentialsErrorType', 'Your username or password is incorrect. Please try again.');
                void vscode.window.showErrorMessage(invalidMessage);
                reportMessage(invalidMessage, progress, token);
            }
        }
    });
}

export async function verifyPostgresCreds(databaseTreeItem: DBTreeItem, username: string, password: string): Promise<Client | undefined> {

    const postgresData = nonNullProp(databaseTreeItem, 'postgresData');
    const serverType = nonNullProp(postgresData, 'serverType');
    const sslAzure: ConnectionOptions = {
        // Always provide the certificate since it is accepted even when SSL is disabled
        // Single Server Root Cert --> BaltimoreCyberTrustRoot (Current), DigiCertGlobalRootG2 (TBA)
        // Flexible Server Root Cert --> DigiCertGlobalRootCA. More info: https://aka.ms/AAd75x5
        ca: serverType === PostgresServerType.Single ? [BaltimoreCyberTrustRoot, DigiCertGlobalRootG2] : [DigiCertGlobalRootCA]
    };
    const host = databaseTreeItem.hostName;
    const port: number = databaseTreeItem.port ? parseInt(databaseTreeItem.port) : parseInt(postgresDefaultPort);
    const clientConfig: ClientConfig = { user: username, password: password, ssl: sslAzure, host, port, database: databaseTreeItem.databaseName };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client: Client = new Client(clientConfig);
    // Ensure the client config is valid before returning
    try {
        await client.connect();
        return client;
    } catch (e) {
        return undefined;
    } finally {
        await client.end();
    }
}

export async function isFirewallRuleSet(context: ISubscriptionContext & IActionContext, databaseTreeItem: DBTreeItem): Promise<boolean> {
    const postgresData = nonNullProp(databaseTreeItem, 'postgresData');
    const azureData = nonNullProp(databaseTreeItem, 'azureData');
    const serverType: PostgresServerType = nonNullProp(postgresData, 'serverType');
    const client = await createAbstractPostgresClient(serverType, context);
    const result = (await client.firewallRules.listByServer(nonNullProp(azureData, 'resourceGroup'), nonNullProp(azureData, 'accountName')))._response.parsedBody;
    const publicIp: string = await getPublicIp();
    return (Object.values(result).some(value => value.startIpAddress === publicIp));
}

export function reportMessage(message: string, progress: vscode.Progress<{}>, token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
        throw new UserCancelledError('remoteDebugReportMessage');
    }

    ext.outputChannel.appendLog(message);
    progress.report({ message: message });
}

// Postgres Single Server Root Cert, https://aka.ms/AA7wnvl
export const BaltimoreCyberTrustRoot: string = `-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ
RTESMBAGA1UEChMJQmFsdGltb3JlMRMwEQYDVQQLEwpDeWJlclRydXN0MSIwIAYD
VQQDExlCYWx0aW1vcmUgQ3liZXJUcnVzdCBSb290MB4XDTAwMDUxMjE4NDYwMFoX
DTI1MDUxMjIzNTkwMFowWjELMAkGA1UEBhMCSUUxEjAQBgNVBAoTCUJhbHRpbW9y
ZTETMBEGA1UECxMKQ3liZXJUcnVzdDEiMCAGA1UEAxMZQmFsdGltb3JlIEN5YmVy
VHJ1c3QgUm9vdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKMEuyKr
mD1X6CZymrV51Cni4eiVgLGw41uOKymaZN+hXe2wCQVt2yguzmKiYv60iNoS6zjr
IZ3AQSsBUnuId9Mcj8e6uYi1agnnc+gRQKfRzMpijS3ljwumUNKoUMMo6vWrJYeK
mpYcqWe4PwzV9/lSEy/CG9VwcPCPwBLKBsua4dnKM3p31vjsufFoREJIE9LAwqSu
XmD+tqYF/LTdB1kC1FkYmGP1pWPgkAx9XbIGevOF6uvUA65ehD5f/xXtabz5OTZy
dc93Uk3zyZAsuT3lySNTPx8kmCFcB5kpvcY67Oduhjprl3RjM71oGDHweI12v/ye
jl0qhqdNkNwnGjkCAwEAAaNFMEMwHQYDVR0OBBYEFOWdWTCCR1jMrPoIVDaGezq1
BE3wMBIGA1UdEwEB/wQIMAYBAf8CAQMwDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3
DQEBBQUAA4IBAQCFDF2O5G9RaEIFoN27TyclhAO992T9Ldcw46QQF+vaKSm2eT92
9hkTI7gQCvlYpNRhcL0EYWoSihfVCr3FvDB81ukMJY2GQE/szKN+OMY3EU/t3Wgx
jkzSswF07r51XgdIGn9w/xZchMB5hbgF/X++ZRGjD8ACtPhSNzkE1akxehi/oCr0
Epn3o0WC4zxe9Z2etciefC7IpJ5OCBRLbf1wbWsaY71k5h+3zvDyny67G7fyUIhz
ksLi4xaNmjICq44Y3ekQEe5+NauQrz4wlHrQMz2nZQ/1/I6eYs9HRCwBXbsdtTLS
R9I4LtD+gdwyah617jzV/OeBHRnDJELqYzmp
-----END CERTIFICATE-----`;

// Postgres Single Server Root Cert will be updated to DigiCertGlobalRootG2, https://aka.ms/AA7wnvl
export const DigiCertGlobalRootG2: string = `-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----`;

// Postgres Flexible Server Root Cert, https://aka.ms/AAd75x5
export const DigiCertGlobalRootCA: string = `-----BEGIN CERTIFICATE-----
MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD
QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB
CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97
nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt
43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P
T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4
gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO
BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR
TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw
DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr
hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg
06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF
PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls
YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk
CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=
-----END CERTIFICATE-----`;

