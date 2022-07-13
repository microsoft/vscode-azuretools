/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureResourceBrand } from "../azureResourceType";

const FunctionAppKind = 'functionapp';
const LogicAppKind = 'workflowapp';

export function getAzureResourceType(resource: { type: string; kind?: string; }): AzureResourceBrand | undefined {
    const type = resource.type.toLowerCase();
    const kind = resource.kind?.toLowerCase() || '';

    switch (type) {
        case 'microsoft.web/sites':
            // Logic apps, function apps, and app services all have the same type
            if (kind.includes(FunctionAppKind) && kind.includes(LogicAppKind)) {
                return 'LogicApp';
            } else if (kind.includes(FunctionAppKind)) {
                return 'FunctionApp';
            } else {
                return 'AppServices';
            }

        case 'microsoft.web/staticsites':
            return 'StaticWebApps';

        case 'microsoft.compute/virtualmachines':
            return 'VirtualMachines';

        case 'microsoft.storage/storageaccounts':
            return 'StorageAccounts';

        case 'microsoft.network/networksecuritygroups':
            return 'NetworkSecurityGroups';

        case 'microsoft.network/loadbalancers':
            return 'LoadBalancers';

        case 'microsoft.compute/disks':
            return 'Disks';

        case 'microsoft.compute/images':
            return 'Images';

        case 'microsoft.compute/availabilitysets':
            return 'AvailabilitySets';

        case 'microsoft.compute/virtualmachinescalesets':
            return 'VirtualMachineScaleSets';

        case 'microsoft.network/virtualnetworks':
            return 'VirtualNetworks';

        case 'microsoft.cdn/profiles':
            return 'FrontDoorAndCdnProfiles';

        case 'microsoft.network/publicipaddresses':
            return 'PublicIpAddresses';

        case 'microsoft.network/networkinterfaces':
            return 'NetworkInterfaces';

        case 'microsoft.network/networkwatchers':
            return 'NetworkWatchers';

        case 'microsoft.batch/batchaccounts':
            return 'BatchAccounts';

        case 'microsoft.containerregistry/registries':
            return 'ContainerRegistry';

        case 'microsoft.dbforpostgresql/servers':
            return 'PostgresqlServersStandard';

        case 'microsoft.dbforpostgresql/flexibleservers':
            return 'PostgresqlServersFlexible';

        case 'microsoft.dbformysql/servers':
            return 'MysqlServers';

        case 'microsoft.sql/servers/databases':
            return 'SqlDatabases';

        case 'microsoft.sql/servers':
            return 'SqlServers';

        case 'microsoft.documentdb/databaseaccounts':
            return 'AzureCosmosDb';

        case 'microsoft.operationalinsights/workspaces':
            return 'OperationalInsightsWorkspaces';

        case 'microsoft.operationsmanagement/solutions':
            return 'OperationsManagementSolutions';

        case 'microsoft.insights/components':
            return 'ApplicationInsights';

        case 'microsoft.web/serverfarms':
            return 'AppServicePlans';

        case 'microsoft.web/kubeenvironments':
            return 'AppServiceKubernetesEnvironment';

        case 'microsoft.app/managedenvironments':
            return 'ContainerAppsEnvironment';

        case 'microsoft.app/containerapps':
            return 'ContainerApps';

        default:
            return undefined;
    }
}
