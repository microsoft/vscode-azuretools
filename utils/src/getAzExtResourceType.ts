/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtResourceType } from "../azExtResourceType";

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

        case 'microsoft.app/containerapps':
            return AzExtResourceType.ContainerApps;

        case 'microsoft.app/managedenvironments':
            return AzExtResourceType.ContainerAppsEnvironment;

        case 'microsoft.compute/virtualmachines':
            return AzExtResourceType.VirtualMachines;

        case 'microsoft.dbforpostgresql/flexibleservers':
            return AzExtResourceType.PostgresqlServersFlexible;

        case 'microsoft.dbforpostgresql/servers':
            return AzExtResourceType.PostgresqlServersStandard;

        case 'microsoft.documentdb/databaseaccounts':
            return AzExtResourceType.AzureCosmosDb;

        case 'microsoft.storage/storageaccounts':
            return AzExtResourceType.StorageAccounts;

        case 'microsoft.web/staticsites':
            return AzExtResourceType.StaticWebApps;

        // The below are not supported by the Azure extensions but have icons in the Resources extension

        case 'microsoft.apimanagement/service':
            return AzExtResourceType.ApiManagementService;

        case 'microsoft.batch/batchaccounts':
            return AzExtResourceType.BatchAccounts;

        case 'microsoft.cache/redis':
            return AzExtResourceType.CacheRedis;

        case 'microsoft.cdn/profiles':
            return AzExtResourceType.FrontDoorAndCdnProfiles;

        case 'microsoft.compute/availabilitysets':
            return AzExtResourceType.AvailabilitySets;

        case 'microsoft.compute/disks':
            return AzExtResourceType.Disks;

        case 'microsoft.compute/images':
            return AzExtResourceType.Images;

        case 'microsoft.compute/virtualmachinescalesets':
            return AzExtResourceType.VirtualMachineScaleSets;

        case 'microsoft.containerregistry/registries':
            return AzExtResourceType.ContainerRegistry;

        case 'microsoft.containerservice/managedclusters':
            return AzExtResourceType.ContainerServiceManagedClusters;

        case 'microsoft.dbformysql/servers':
            return AzExtResourceType.MysqlServers;

        case 'microsoft.devices/iothubs':
            return AzExtResourceType.DeviceIotHubs;

        case 'microsoft.devtestlab/labs':
            return AzExtResourceType.DevTestLabs;

        case 'microsoft.eventgrid/domains':
            return AzExtResourceType.EventGridDomains;

        case 'microsoft.eventgrid/eventsubscriptions':
            return AzExtResourceType.EventGridEventSubscriptions;

        case 'microsoft.eventgrid/topics':
            return AzExtResourceType.EventGridTopics;

        case 'microsoft.eventhub/namespaces':
            return AzExtResourceType.EventHubNamespaces;

        case 'microsoft.extendedlocation/customlocations':
            return AzExtResourceType.CustomLocations;

        case 'microsoft.insights/components':
            return AzExtResourceType.ApplicationInsights;

        case 'microsoft.keyvault/vaults':
            return AzExtResourceType.KeyVaults;

        case 'microsoft.kubernetes/connectedclusters':
            return AzExtResourceType.KubernetesConnectedClusters;

        case 'microsoft.logic/workflows':
            return AzExtResourceType.LogicWorkflows;

        case 'microsoft.managedidentity/userassignedidentities':
            return AzExtResourceType.ManagedIdentityUserAssignedIdentities;

        case 'microsoft.network/applicationgateways':
            return AzExtResourceType.NetworkApplicationGateways;

        case 'microsoft.network/applicationsecuritygroups':
            return AzExtResourceType.NetworkApplicationSecurityGroups;

        case 'microsoft.network/loadbalancers':
            return AzExtResourceType.LoadBalancers;

        case 'microsoft.network/localnetworkgateways':
            return AzExtResourceType.NetworkLocalNetworkGateways;

        case 'microsoft.network/networkinterfaces':
            return AzExtResourceType.NetworkInterfaces;

        case 'microsoft.network/networksecuritygroups':
            return AzExtResourceType.NetworkSecurityGroups;

        case 'microsoft.network/networkwatchers':
            return AzExtResourceType.NetworkWatchers;

        case 'microsoft.network/publicipaddresses':
            return AzExtResourceType.PublicIpAddresses;

        case 'microsoft.network/publicipprefixes':
            return AzExtResourceType.NetworkPublicIpPrefixes;

        case 'microsoft.network/routetables':
            return AzExtResourceType.NetworkRouteTables;

        case 'microsoft.network/virtualnetworkgateways':
            return AzExtResourceType.NetworkVirtualNetworkGateways;

        case 'microsoft.network/virtualnetworks':
            return AzExtResourceType.VirtualNetworks;

        case 'microsoft.notificationhubs/namespaces':
            return AzExtResourceType.NotificationHubNamespaces;

        case 'microsoft.operationalinsights/workspaces':
            return AzExtResourceType.OperationalInsightsWorkspaces;

        case 'microsoft.operationsmanagement/solutions':
            return AzExtResourceType.OperationsManagementSolutions;

        case 'microsoft.servicebus/namespaces':
            return AzExtResourceType.ServiceBusNamespaces;

        case 'microsoft.servicefabric/clusters':
            return AzExtResourceType.ServiceFabricClusters;

        case 'microsoft.servicefabricmesh/applications':
            return AzExtResourceType.ServiceFabricMeshApplications;

        case 'microsoft.signalrservice/signalr':
            return AzExtResourceType.SignalRService;

        case 'microsoft.sql/servers':
            return AzExtResourceType.SqlServers;

        case 'microsoft.sql/servers/databases':
            return AzExtResourceType.SqlDatabases;

        case 'microsoft.web/hostingenvironments':
            return AzExtResourceType.WebHostingEnvironments;

        case 'microsoft.web/kubeenvironments':
            return AzExtResourceType.AppServiceKubernetesEnvironment;

        case 'microsoft.web/serverfarms':
            return AzExtResourceType.AppServicePlans;

        default:
            return undefined;
    }
}
