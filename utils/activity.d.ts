import { AzureResourcesExtensionApi } from '@microsoft/vscode-azureresources-api';
import { Activity } from './hostapi';

export interface ActivityApi {
    /**
     * Registers an activity to appear in the activity window.
    *
    * @param activity - The activity information to show.
    */
    registerActivity(activity: Activity): Promise<void>;
}

export interface AzureResourcesExtensionApiWithActivity extends AzureResourcesExtensionApi {
    activity: ActivityApi;
}
