import { AzExtParentTreeItem } from 'vscode-azureextensionui';
import { localize } from '../localize';

export abstract class DeploymentsTreeItemBase extends AzExtParentTreeItem {
    public static contextValueConnected: string = 'deploymentsConnected';
    public static contextValueUnconnected: string = 'deploymentsUnconnected';
    public parent: AzExtParentTreeItem;
    public readonly label: string = localize('Deployments', 'Deployments');
    public readonly childTypeLabel: string = localize('Deployment', 'Deployment');
}