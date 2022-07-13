/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/**
 * Normalized type for Azure resources that uniquely identifies resource type for the purposes
 * of the Azure extensions
 */
type AzureResourceBrand = [
    'AppServices',
    'StaticWebApps',
    'FunctionApp',
    'LogicApp',
    'VirtualMachines',
    'StorageAccounts',
    'NetworkSecurityGroups',
    'LoadBalancers',
    'Disks',
    'Images',
    'AvailabilitySets',
    'VirtualMachineScaleSets',
    'VirtualNetworks',
    'FrontDoorAndCdnProfiles',
    'PublicIpAddresses',
    'NetworkInterfaces',
    'NetworkWatchers',
    'BatchAccounts',
    'ContainerRegistry',
    'PostgresqlServersStandard',
    'PostgresqlServersFlexible',
    'MysqlServers',
    'SqlDatabases',
    'SqlServers',
    'AzureCosmosDb',
    'OperationalInsightsWorkspaces',
    'OperationsManagementSolutions',
    'ApplicationInsights',
    'AppServicePlans',
    'AppServiceKubernetesEnvironment',
    'ContainerAppsEnvironment',
    'ContainerApps',
][number];

/**
 * Gets a normalized type for an Azure resource, accounting for the fact that some
 * Azure resources share values for type
 * @param resource The resource to check the {@link AzureResourceType} for
 * @returns The normalized Azure resource type
 */
export declare function getAzureResourceType(resource: { type: string; kind?: string }): AzureResourceBrand | undefined;
