/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A structural description of an Azure cloud environment and its well-known endpoints.
 *
 * This mirrors the shape of the `Environment`/`EnvironmentParameters` types from the deprecated
 * `@azure/ms-rest-azure-env` package, so consumers can migrate without depending on that package.
 * For well-known clouds, use the built-in {@link AzurePublicCloud}, {@link AzureChinaCloud}, and
 * {@link AzureUSGovernmentCloud} constants. For a custom cloud, the full `EnvironmentLike` is exposed so
 * consumers can read whichever endpoint they need.
 */
export interface EnvironmentLike {
    /**
     * The environment name.
     */
    readonly name: string;

    /**
     * The management portal URL.
     */
    readonly portalUrl: string;

    /**
     * The management service endpoint.
     */
    readonly managementEndpointUrl: string;

    /**
     * The resource management endpoint.
     */
    readonly resourceManagerEndpointUrl: string;

    /**
     * The Active Directory login endpoint.
     */
    readonly activeDirectoryEndpointUrl: string;

    /**
     * The resource ID to obtain AD tokens for (token audience).
     */
    readonly activeDirectoryResourceId: string;

    /**
     * The publish settings file URL.
     */
    readonly publishingProfileUrl?: string;

    /**
     * The SQL server management endpoint for mobile commands.
     */
    readonly sqlManagementEndpointUrl?: string;

    /**
     * The DNS suffix for SQL servers.
     */
    readonly sqlServerHostnameSuffix?: string;

    /**
     * The template gallery endpoint.
     */
    readonly galleryEndpointUrl?: string;

    /**
     * The Active Directory resource ID.
     */
    readonly activeDirectoryGraphResourceId?: string;

    /**
     * The batch resource ID.
     */
    readonly batchResourceId?: string;

    /**
     * The Active Directory API version.
     */
    readonly activeDirectoryGraphApiVersion?: string;

    /**
     * The endpoint suffix for storage accounts.
     */
    readonly storageEndpointSuffix?: string;

    /**
     * The KeyVault service DNS suffix.
     */
    readonly keyVaultDnsSuffix?: string;

    /**
     * The Data Lake Store filesystem service DNS suffix.
     */
    readonly azureDataLakeStoreFileSystemEndpointSuffix?: string;

    /**
     * The Data Lake Analytics job and catalog service DNS suffix.
     */
    readonly azureDataLakeAnalyticsCatalogAndJobEndpointSuffix?: string;

    /**
     * Determines whether the authentication endpoint should be validated with Azure AD. Default is true.
     */
    readonly validateAuthority?: boolean;
}

/**
 * The built-in {@link EnvironmentLike} for the public Azure cloud.
 *
 * @remarks Values mirror `@azure/ms-rest-azure-env`'s `Environment.AzureCloud`.
 */
export const AzurePublicCloud: EnvironmentLike = {
    name: 'AzureCloud',
    portalUrl: 'https://portal.azure.com',
    publishingProfileUrl: 'https://go.microsoft.com/fwlink/?LinkId=254432',
    managementEndpointUrl: 'https://management.core.windows.net',
    resourceManagerEndpointUrl: 'https://management.azure.com/',
    sqlManagementEndpointUrl: 'https://management.core.windows.net:8443/',
    sqlServerHostnameSuffix: '.database.windows.net',
    galleryEndpointUrl: 'https://gallery.azure.com/',
    activeDirectoryEndpointUrl: 'https://login.microsoftonline.com/',
    activeDirectoryResourceId: 'https://management.core.windows.net/',
    activeDirectoryGraphResourceId: 'https://graph.windows.net/',
    batchResourceId: 'https://batch.core.windows.net/',
    activeDirectoryGraphApiVersion: '2013-04-05',
    storageEndpointSuffix: 'core.windows.net',
    keyVaultDnsSuffix: '.vault.azure.net',
    azureDataLakeStoreFileSystemEndpointSuffix: 'azuredatalakestore.net',
    azureDataLakeAnalyticsCatalogAndJobEndpointSuffix: 'azuredatalakeanalytics.net',
    validateAuthority: true,
};

/**
 * The built-in {@link EnvironmentLike} for the Azure China cloud.
 *
 * @remarks Values mirror `@azure/ms-rest-azure-env`'s `Environment.ChinaCloud`.
 */
export const AzureChinaCloud: EnvironmentLike = {
    name: 'AzureChinaCloud',
    portalUrl: 'https://portal.azure.cn',
    publishingProfileUrl: 'https://go.microsoft.com/fwlink/?LinkID=301774',
    managementEndpointUrl: 'https://management.core.chinacloudapi.cn',
    resourceManagerEndpointUrl: 'https://management.chinacloudapi.cn',
    sqlManagementEndpointUrl: 'https://management.core.chinacloudapi.cn:8443/',
    sqlServerHostnameSuffix: '.database.chinacloudapi.cn',
    galleryEndpointUrl: 'https://gallery.chinacloudapi.cn/',
    activeDirectoryEndpointUrl: 'https://login.chinacloudapi.cn/',
    activeDirectoryResourceId: 'https://management.core.chinacloudapi.cn/',
    activeDirectoryGraphResourceId: 'https://graph.chinacloudapi.cn/',
    activeDirectoryGraphApiVersion: '2013-04-05',
    batchResourceId: 'https://batch.chinacloudapi.cn/',
    storageEndpointSuffix: 'core.chinacloudapi.cn',
    keyVaultDnsSuffix: '.vault.azure.cn',
    azureDataLakeStoreFileSystemEndpointSuffix: 'N/A',
    azureDataLakeAnalyticsCatalogAndJobEndpointSuffix: 'N/A',
    validateAuthority: true,
};

/**
 * The built-in {@link EnvironmentLike} for the Azure US Government cloud.
 *
 * @remarks Values mirror `@azure/ms-rest-azure-env`'s `Environment.USGovernment`.
 */
export const AzureUSGovernmentCloud: EnvironmentLike = {
    name: 'AzureUSGovernment',
    portalUrl: 'https://portal.azure.us',
    publishingProfileUrl: 'https://manage.windowsazure.us/publishsettings/index',
    managementEndpointUrl: 'https://management.core.usgovcloudapi.net',
    resourceManagerEndpointUrl: 'https://management.usgovcloudapi.net',
    sqlManagementEndpointUrl: 'https://management.core.usgovcloudapi.net:8443/',
    sqlServerHostnameSuffix: '.database.usgovcloudapi.net',
    galleryEndpointUrl: 'https://gallery.usgovcloudapi.net/',
    activeDirectoryEndpointUrl: 'https://login.microsoftonline.us/',
    activeDirectoryResourceId: 'https://management.core.usgovcloudapi.net/',
    activeDirectoryGraphResourceId: 'https://graph.windows.net/',
    batchResourceId: 'https://batch.core.usgovcloudapi.net/',
    activeDirectoryGraphApiVersion: '2013-04-05',
    storageEndpointSuffix: 'core.usgovcloudapi.net',
    keyVaultDnsSuffix: '.vault.usgovcloudapi.net',
    azureDataLakeStoreFileSystemEndpointSuffix: 'N/A',
    azureDataLakeAnalyticsCatalogAndJobEndpointSuffix: 'N/A',
    validateAuthority: true,
};
