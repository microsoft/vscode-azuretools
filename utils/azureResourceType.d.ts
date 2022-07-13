/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/**
 * Normalized type for Azure resources that uniquely identifies resource type for the purposes
 * of the Azure extensions
 */
export declare enum AzureResourceType {
    AppServices = 'AppServices',
    StaticWebApps = 'StaticWebApps',
    FunctionApp = 'FunctionApp',
    LogicApp = 'LogicApp',
    VirtualMachines = 'VirtualMachines',
    StorageAccounts = 'StorageAccounts',
    NetworkSecurityGroups = 'NetworkSecurityGroups',
    LoadBalancers = 'LoadBalancers',
    Disks = 'Disks',
    Images = 'Images',
    AvailabilitySets = 'AvailabilitySets',
    VirtualMachineScaleSets = 'VirtualMachineScaleSets',
    VirtualNetworks = 'VirtualNetworks',
    FrontDoorAndCdnProfiles = 'FrontDoorAndCdnProfiles',
    PublicIpAddresses = 'PublicIpAddresses',
    NetworkInterfaces = 'NetworkInterfaces',
    NetworkWatchers = 'NetworkWatchers',
    BatchAccounts = 'BatchAccounts',
    ContainerRegistry = 'ContainerRegistry',
    PostgresqlServersStandard = 'PostgresqlServersStandard',
    PostgresqlServersFlexible = 'PostgresqlServersFlexible',
    MysqlServers = 'MysqlServers',
    SqlDatabases = 'SqlDatabases',
    SqlServers = 'SqlServers',
    AzureCosmosDb = 'AzureCosmosDb',
    OperationalInsightsWorkspaces = 'OperationalInsightsWorkspaces',
    OperationsManagementSolutions = 'OperationsManagementSolutions',
    ApplicationInsights = 'ApplicationInsights',
    AppServicePlans = 'AppServicePlans',
    AppServiceKubernetesEnvironment = 'AppServiceKubernetesEnvironment',
    ContainerAppsEnvironment = 'ContainerAppsEnvironment',
    ContainerApps = 'ContainerApps',
}

/**
 * Gets a normalized type for an Azure resource, accounting for the fact that some
 * Azure resources share values for type
 * @param resource The resource to check the {@link AzureResourceType} for
 * @returns The normalized Azure resource type
 */
export declare function getAzureResourceType(resource: { type: string; kind?: string }): AzureResourceType | undefined;
