/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/**
 * Normalized type for Azure resources that uniquely identifies resource type for the purposes
 * of the Azure extensions
 */
export declare enum AzExtResourceType {
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

    // Below are not supported but have icons in the Resources extension
    WebHostingEnvironments = 'WebHostingEnvironments',
    SignalRService = 'SignalRService',
    ServiceFabricMeshApplications = 'ServiceFabricMeshApplications',
    ServiceFabricClusters = 'ServiceFabricClusters',
    ServiceBusNamespaces = 'ServiceBusNamespaces',
    NotificationHubNamespaces = 'NotificationHubNamespaces',
    NetworkApplicationGateways = 'NetworkApplicationGateways',
    NetworkApplicationSecurityGroups = 'NetworkApplicationSecurityGroups',
    NetworkLocalNetworkGateways = 'NetworkLocalNetworkGateways',
    NetworkPublicIpPrefixes = 'NetworkPublicIpPrefixes',
    NetworkRouteTables = 'NetworkRouteTables',
    NetworkVirtualNetworkGateways = 'NetworkVirtualNetworkGateways',
    ManagedIdentityUserAssignedIdentities = 'ManagedIdentityUserAssignedIdentities',
    LogicWorkflows = 'LogicWorkflows',
    KubernetesConnectedClusters = 'KubernetesConnectedClusters',
    KeyVaults = 'KeyVaults',
    Customlocations = 'Customlocations',
    EventHubNamespaces = 'EventHubNamespaces',
    EventGridDomains = 'EventGridDomains',
    EventGridEventSubscriptions = 'EventGridEventSubscriptions',
    EventGridTopics = 'EventGridTopics',
    DevTestLabs = 'DevTestLabs',
    DeviceIotHubs = 'DeviceIotHubs',
    ContainerServiceManagedClusters = 'ContainerServiceManagedClusters',
    CacheRedis = 'CacheRedis',
    ApiManagementService = 'ApiManagementService',
}

/**
 * Gets a normalized type for an Azure resource, accounting for the fact that some
 * Azure resources share values for type and/or kind
 * @param resource The resource to check the {@link AzExtResourceType} for
 * @returns The normalized Azure resource type
 */
export declare function getAzExtResourceType(resource: { type: string; kind?: string }): AzExtResourceType | undefined;
