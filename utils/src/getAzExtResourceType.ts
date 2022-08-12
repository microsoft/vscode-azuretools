/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtResourceType } from "./azExtResourceType";

const FunctionAppKind = 'functionapp';
const LogicAppKind = 'workflowapp';

export function getAzExtResourceType(resource: { type: string; kind?: string; }): AzExtResourceType | undefined {
    const type = resource.type.toLowerCase();
    const kind = resource.kind?.toLowerCase() || '';

    switch (type) {
        case 'microsoft.web/sites':
            // Logic apps, function apps, and app services all have the same type
            if (kind.includes(FunctionAppKind) && kind.includes(LogicAppKind)) {
                return AzExtResourceType.LogicApp;
            } else if (kind.includes(FunctionAppKind)) {
                return AzExtResourceType.FunctionApp;
            } else {
                return AzExtResourceType.AppServices;
            }

        default:
            return azureTypeToAzExtResourceTypeMap[type];
    }
}

const azureTypeToAzExtResourceTypeMap: Record<string, AzExtResourceType | undefined> = {
    'microsoft.app/containerapps': AzExtResourceType.ContainerApps,
    'microsoft.app/managedenvironments': AzExtResourceType.ContainerAppsEnvironment,
    'microsoft.compute/virtualmachines': AzExtResourceType.VirtualMachines,
    'microsoft.dbforpostgresql/flexibleservers': AzExtResourceType.PostgresqlServersFlexible,
    'microsoft.dbforpostgresql/servers': AzExtResourceType.PostgresqlServersStandard,
    'microsoft.documentdb/databaseaccounts': AzExtResourceType.AzureCosmosDb,
    'microsoft.storage/storageaccounts': AzExtResourceType.StorageAccounts,
    'microsoft.web/staticsites': AzExtResourceType.StaticWebApps,
    // The below are not supported by the Azure extensions but have icons in the Resources extension
    'microsoft.apimanagement/service': AzExtResourceType.ApiManagementService,
    'microsoft.batch/batchaccounts': AzExtResourceType.BatchAccounts,
    'microsoft.cache/redis': AzExtResourceType.CacheRedis,
    'microsoft.cdn/profiles': AzExtResourceType.FrontDoorAndCdnProfiles,
    'microsoft.compute/availabilitysets': AzExtResourceType.AvailabilitySets,
    'microsoft.compute/disks': AzExtResourceType.Disks,
    'microsoft.compute/images': AzExtResourceType.Images,
    'microsoft.compute/virtualmachinescalesets': AzExtResourceType.VirtualMachineScaleSets,
    'microsoft.containerregistry/registries': AzExtResourceType.ContainerRegistry,
    'microsoft.containerservice/managedclusters': AzExtResourceType.ContainerServiceManagedClusters,
    'microsoft.dbformysql/servers': AzExtResourceType.MysqlServers,
    'microsoft.devices/iothubs': AzExtResourceType.DeviceIotHubs,
    'microsoft.devtestlab/labs': AzExtResourceType.DevTestLabs,
    'microsoft.eventgrid/domains': AzExtResourceType.EventGridDomains,
    'microsoft.eventgrid/eventsubscriptions': AzExtResourceType.EventGridEventSubscriptions,
    'microsoft.eventgrid/topics': AzExtResourceType.EventGridTopics,
    'microsoft.eventhub/namespaces': AzExtResourceType.EventHubNamespaces,
    'microsoft.extendedlocation/customlocations': AzExtResourceType.CustomLocations,
    'microsoft.insights/components': AzExtResourceType.ApplicationInsights,
    'microsoft.keyvault/vaults': AzExtResourceType.KeyVaults,
    'microsoft.kubernetes/connectedclusters': AzExtResourceType.KubernetesConnectedClusters,
    'microsoft.logic/workflows': AzExtResourceType.LogicWorkflows,
    'microsoft.managedidentity/userassignedidentities': AzExtResourceType.ManagedIdentityUserAssignedIdentities,
    'microsoft.network/applicationgateways': AzExtResourceType.NetworkApplicationGateways,
    'microsoft.network/applicationsecuritygroups': AzExtResourceType.NetworkApplicationSecurityGroups,
    'microsoft.network/loadbalancers': AzExtResourceType.LoadBalancers,
    'microsoft.network/localnetworkgateways': AzExtResourceType.NetworkLocalNetworkGateways,
    'microsoft.network/networkinterfaces': AzExtResourceType.NetworkInterfaces,
    'microsoft.network/networksecuritygroups': AzExtResourceType.NetworkSecurityGroups,
    'microsoft.network/networkwatchers': AzExtResourceType.NetworkWatchers,
    'microsoft.network/publicipaddresses': AzExtResourceType.PublicIpAddresses,
    'microsoft.network/publicipprefixes': AzExtResourceType.NetworkPublicIpPrefixes,
    'microsoft.network/routetables': AzExtResourceType.NetworkRouteTables,
    'microsoft.network/virtualnetworkgateways': AzExtResourceType.NetworkVirtualNetworkGateways,
    'microsoft.network/virtualnetworks': AzExtResourceType.VirtualNetworks,
    'microsoft.notificationhubs/namespaces': AzExtResourceType.NotificationHubNamespaces,
    'microsoft.operationalinsights/workspaces': AzExtResourceType.OperationalInsightsWorkspaces,
    'microsoft.operationsmanagement/solutions': AzExtResourceType.OperationsManagementSolutions,
    'microsoft.servicebus/namespaces': AzExtResourceType.ServiceBusNamespaces,
    'microsoft.servicefabric/clusters': AzExtResourceType.ServiceFabricClusters,
    'microsoft.servicefabricmesh/applications': AzExtResourceType.ServiceFabricMeshApplications,
    'microsoft.signalrservice/signalr': AzExtResourceType.SignalRService,
    'microsoft.sql/servers': AzExtResourceType.SqlServers,
    'microsoft.sql/servers/databases': AzExtResourceType.SqlDatabases,
    'microsoft.web/hostingenvironments': AzExtResourceType.WebHostingEnvironments,
    'microsoft.web/kubeenvironments': AzExtResourceType.AppServiceKubernetesEnvironment,
    'microsoft.web/serverfarms': AzExtResourceType.AppServicePlans,
};
