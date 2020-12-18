import * as request from 'request';
import * as vscode from "vscode";
import { AzureResourceFilter } from './azure-account.api';

let baseUrl: string = "";
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

export function ifStack(): boolean {
    try {
        let target_azurestack_api_version = vscode.workspace.getConfiguration("azure").get("target_azurestack_api_version");
        if (target_azurestack_api_version) {
            isStack = true;
            let ppe = vscode.workspace.getConfiguration("azure").get<IPPE>("ppe");
            let resourceManagerUrl = ppe?.resourceManagerEndpointUrl;
            if (resourceManagerUrl) {
                baseUrl = resourceManagerUrl
            } else {
                throw new Error("Can not find a valid resourceManagerEndpointUrl");
            }
        }
    } catch (error) {
        throw error;
    }
    return isStack;
}

async function fetchEndpointMetadata(): Promise<IMetaData> {
    const fetchUrl: string = baseUrl.concat("metadata/endpoints?api-version=1.0");
    let options = {
        url: fetchUrl,
        headers: {
            'User-Agent': 'request'
        },
        rejectUnauthorized: false
    };
    return new Promise((resolve, reject) => {
        request.get(options, (err, _resp, body: string) => {
            if (err) {
                reject(err);
            } else {
                resolve(<IMetaData>JSON.parse(body));
            }
        });
    });
}

export async function getEnvironment(filter: AzureResourceFilter): Promise<void> {
    if (isStack) {
        let result = await fetchEndpointMetadata();
        let metadata: IMetaData = result;
        let env = filter.session.credentials2["environment" as any];
        env.portalUrl = metadata.portalEndpoint;
        env.galleryEndpointUrl = metadata.galleryEndpoint;
        env.activeDirectoryEndpointUrl = metadata.authentication.loginEndpoint.slice(0, metadata.authentication.loginEndpoint.lastIndexOf("/") + 1);
        env.activeDirectoryResourceId = metadata.authentication.audiences[0];
        env.activeDirectoryGraphResourceId = metadata.graphEndpoint;
        env.storageEndpointSuffix = baseUrl.substring(baseUrl.indexOf('.'));
        env.keyVaultDnsSuffix = ".vault".concat(baseUrl.substring(baseUrl.indexOf('.')));
        env.managementEndpointUrl = metadata.authentication.audiences[0];
        (filter.session["environment" as any]) = env;
    }
}
