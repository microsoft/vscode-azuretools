import { Environment } from '@azure/ms-rest-azure-env';
import Axios, { AxiosResponse } from 'axios';
import * as https from 'https';
import * as vscode from 'vscode';
import { AzureResourceFilter, AzureSession } from './azure-account.api';

let baseUrl: string = '';
let isStack: boolean = false;

interface IMetaData {
    galleryEndpoint: string;
    graphEndpoint: string;
    portalEndpoint: string;
    authentication: {
        loginEndpoint: string,
        audiences: [
            string
        ]
    };
}

interface IPPE {
    activeDirectoryEndpointUrl: string;
    activeDirectoryResourceId: string;
    resourceManagerEndpointUrl: string;
    validateAuthority: boolean;
}

interface IAzureStackSession extends AzureSession {
    environment: Environment;
}

export function ifStack(): boolean {
    try {
        const targetAzurestackApiProfile: boolean | undefined = vscode.workspace.getConfiguration('azure').get('target_azurestack_api_profile');
        if (targetAzurestackApiProfile) {
            isStack = true;
            const ppe: IPPE | undefined = vscode.workspace.getConfiguration('azure').get<IPPE>('ppe');
            const resourceManagerUrl: string | undefined = ppe?.resourceManagerEndpointUrl;
            if (resourceManagerUrl) {
                baseUrl = resourceManagerUrl;
            } else {
                throw new Error('Can not find a valid resourceManagerEndpointUrl');
            }
        }
    } catch (error) {
        throw error;
    }
    return isStack;
}

async function fetchEndpointMetadata(): Promise<IMetaData> {
    const fetchUrl: string = (baseUrl.endsWith('/') ? baseUrl : baseUrl.concat('/')).concat('metadata/endpoints?api-version=1.0');
    const response: AxiosResponse<IMetaData> = await Axios.get(fetchUrl, {
        httpAgent: new https.Agent({
            rejectUnauthorized: false
        })
    });
    return response.data;
}

export async function getEnvironment(filter: AzureResourceFilter): Promise<void> {
    if (isStack) {
        const metadata: IMetaData = await fetchEndpointMetadata();
        type IAzureStackEnvironment<T> = { -readonly [P in keyof T]: T[P] };
        const env: IAzureStackEnvironment<Environment> = filter.session.credentials2.environment;
        env.portalUrl = metadata.portalEndpoint;
        env.galleryEndpointUrl = metadata.galleryEndpoint;
        env.activeDirectoryEndpointUrl = metadata.authentication.loginEndpoint.slice(0, metadata.authentication.loginEndpoint.lastIndexOf('/') + 1);
        env.activeDirectoryResourceId = metadata.authentication.audiences[0];
        env.activeDirectoryGraphResourceId = metadata.graphEndpoint;
        env.storageEndpointSuffix = baseUrl.substring(baseUrl.indexOf('.'));
        env.keyVaultDnsSuffix = '.vault'.concat(baseUrl.substring(baseUrl.indexOf('.')));
        env.managementEndpointUrl = metadata.authentication.audiences[0];
        (<IAzureStackSession>filter.session).environment = env;
    }
}
