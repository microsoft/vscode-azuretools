/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureResourceType } from "../azureResourceType";

const FunctionAppKind = 'functionapp';
const LogicAppKind = 'workflowapp';

export function getAzureResourceType(resource: { type: string; kind?: string; }): AzureResourceType | undefined {
    const type = resource.type.toLowerCase();
    const kind = resource.kind?.toLowerCase() || '';

    switch (type) {
        case 'microsoft.web/sites':
            // Logic apps, function apps, and app services all have the same type
            if (kind.includes(FunctionAppKind) && kind.includes(LogicAppKind)) {
                return AzureResourceType.LogicApp;
            } else if (kind.includes(FunctionAppKind)) {
                return AzureResourceType.FunctionApp;
            } else {
                return AzureResourceType.AppServices;
            }

        case 'microsoft.web/staticsites':
            return AzureResourceType.StaticWebApps;

        case 'microsoft.compute/virtualmachines':
            return AzureResourceType.VirtualMachines;

        case 'microsoft.storage/storageaccounts':
            return AzureResourceType.StorageAccounts;

        case 'microsoft.network/networksecuritygroups':
            return AzureResourceType.NetworkSecurityGroups;

        case 'microsoft.network/loadbalancers':
            return AzureResourceType.LoadBalancers;

        case 'microsoft.compute/disks':
            return AzureResourceType.Disks;

        case 'microsoft.compute/images':
            return AzureResourceType.Images;

        case 'microsoft.compute/availabilitysets':
            return AzureResourceType.AvailabilitySets;

        case 'microsoft.compute/virtualmachinescalesets':
            return AzureResourceType.VirtualMachineScaleSets;

        case 'microsoft.network/virtualnetworks':
            return AzureResourceType.VirtualNetworks;

        case 'microsoft.cdn/profiles':
            return AzureResourceType.FrontDoorAndCdnProfiles;

        case 'microsoft.network/publicipaddresses':
            return AzureResourceType.PublicIpAddresses;

        case 'microsoft.network/networkinterfaces':
            return AzureResourceType.NetworkInterfaces;

        case 'microsoft.network/networkwatchers':
            return AzureResourceType.NetworkWatchers;

        case 'microsoft.batch/batchaccounts':
            return AzureResourceType.BatchAccounts;

        case 'microsoft.containerregistry/registries':
            return AzureResourceType.ContainerRegistry;

        case 'microsoft.dbforpostgresql/servers':
            return AzureResourceType.PostgresqlServersStandard;

        case 'microsoft.dbforpostgresql/flexibleservers':
            return AzureResourceType.PostgresqlServersFlexible;

        case 'microsoft.dbformysql/servers':
            return AzureResourceType.MysqlServers;

        case 'microsoft.sql/servers/databases':
            return AzureResourceType.SqlDatabases;

        case 'microsoft.sql/servers':
            return AzureResourceType.SqlServers;

        case 'microsoft.documentdb/databaseaccounts':
            return AzureResourceType.AzureCosmosDb;

        case 'microsoft.operationalinsights/workspaces':
            return AzureResourceType.OperationalInsightsWorkspaces;

        case 'microsoft.operationsmanagement/solutions':
            return AzureResourceType.OperationsManagementSolutions;

        case 'microsoft.insights/components':
            return AzureResourceType.ApplicationInsights;

        case 'microsoft.web/serverfarms':
            return AzureResourceType.AppServicePlans;

        case 'microsoft.web/kubeenvironments':
            return AzureResourceType.AppServiceKubernetesEnvironment;

        case 'microsoft.app/managedenvironments':
            return AzureResourceType.ContainerAppsEnvironment;

        case 'microsoft.app/containerapps':
            return AzureResourceType.ContainerApps;

        default:
            return undefined;
    }
}
