/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from '@fluentui/react-components';
import { CheckmarkRegular } from '@fluentui/react-icons';
import mermaid from 'mermaid';
import { useCallback, useContext, useEffect, useRef, useState, type JSX } from 'react';
import { WebviewContext } from '../WebviewContext';
import './styles/deploymentPlanView.scss';

export interface DeploymentPlanTable {
    headers: string[];
    rows: string[][];
}

export interface DeploymentPlanData {
    status: string;
    mode: string;
    subscription: string;
    availableSubscriptions?: string[];
    location: string;
    locationCode: string;
    availableLocations?: { name: string; code: string }[];
    mermaidDiagram: string;
    workspaceScan: DeploymentPlanTable;
    decisions: DeploymentPlanTable;
    resources: DeploymentPlanTable;
}

export const DeploymentPlanView = (): JSX.Element => {
    const [plan, setPlan] = useState<DeploymentPlanData | null>(null);
    const { vscodeApi } = useContext(WebviewContext);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.command === 'setDeploymentPlanData') {
                setPlan(message.data as DeploymentPlanData);
            }
        };
        window.addEventListener('message', handler);
        vscodeApi.postMessage({ command: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleApprove = useCallback(() => {
        vscodeApi.postMessage({ command: 'approve', data: plan });
    }, [vscodeApi, plan]);

    const handleSubscriptionChange = useCallback((value: string) => {
        setPlan(prev => {
            if (!prev) { return prev; }
            return { ...prev, subscription: value };
        });
        vscodeApi.postMessage({ command: 'subscriptionChanged', data: value });
    }, [vscodeApi]);

    const handleLocationChange = useCallback((value: string) => {
        setPlan(prev => {
            if (!prev) { return prev; }
            const locations = prev.availableLocations ?? [];
            const selected = locations.find(l => l.code === value);
            return {
                ...prev,
                location: selected?.name ?? value,
                locationCode: value,
            };
        });
        vscodeApi.postMessage({ command: 'locationChanged', data: value });
    }, [vscodeApi]);

    const handleResourceSkuChange = useCallback((rowIdx: number, value: string) => {
        setPlan(prev => {
            if (!prev) { return prev; }
            const updated = structuredClone(prev);
            const skuColIdx = updated.resources.headers.length - 1;
            updated.resources.rows[rowIdx][skuColIdx] = value;
            return updated;
        });
    }, []);

    if (!plan) {
        return <div className='deploymentPlanView'><p>Loading deployment plan...</p></div>;
    }

    return (
        <div className='deploymentPlanView'>
            <div className='planHeader'>
                <div className='headerTop'>
                    <div>
                        <h1>Azure Deployment Plan</h1>
                        <div className='metadataBadges'>
                            <span className='badge status'>{plan.status}</span>
                            <span className='badge mode'>{plan.mode}</span>
                        </div>
                    </div>
                    <div className='headerActions'>
                        <Button
                            appearance='primary'
                            icon={<CheckmarkRegular />}
                            onClick={handleApprove}
                        >
                            Approve
                        </Button>
                    </div>
                </div>
            </div>

            <div className='infoCards'>
                <div className='infoCard'>
                    <span className='infoLabel'>Subscription</span>
                    {plan.availableSubscriptions && plan.availableSubscriptions.length > 0 ? (
                        <select
                            className='cellDropdown'
                            value={plan.subscription}
                            onChange={(e) => handleSubscriptionChange(e.target.value)}
                        >
                            {!plan.subscription && (
                                <option value='' disabled>Select a subscription...</option>
                            )}
                            {plan.subscription && !plan.availableSubscriptions.includes(plan.subscription) && (
                                <option value={plan.subscription}>{plan.subscription}</option>
                            )}
                            {plan.availableSubscriptions.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    ) : (
                        <span className='infoValue'>{plan.subscription}</span>
                    )}
                </div>
                <div className='infoCard'>
                    <span className='infoLabel'>Location</span>
                    {plan.availableLocations && plan.availableLocations.length > 0 ? (
                        <select
                            className='cellDropdown'
                            value={plan.locationCode}
                            onChange={(e) => handleLocationChange(e.target.value)}
                        >
                            {!plan.locationCode && (
                                <option value='' disabled>Select a location...</option>
                            )}
                            {plan.locationCode && !plan.availableLocations.some(l => l.code === plan.locationCode) && (
                                <option value={plan.locationCode}>{plan.location} ({plan.locationCode})</option>
                            )}
                            {plan.availableLocations.map(loc => (
                                <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
                            ))}
                        </select>
                    ) : (
                        <span className='infoValue'>{plan.location} <code>{plan.locationCode}</code></span>
                    )}
                </div>
            </div>

            <details className='sectionCard'>
                <summary><h2>Architecture Diagram</h2></summary>
                <MermaidDiagram definition={plan.mermaidDiagram} />
            </details>

            <details className='sectionCard'>
                <summary><h2>Workspace Scan</h2></summary>
                <PlanTable table={plan.workspaceScan} />
            </details>

            <details className='sectionCard'>
                <summary><h2>Decisions</h2></summary>
                <PlanTable table={plan.decisions} />
            </details>

            <div className='sectionCard'>
                <h2>Azure Resources</h2>
                <ResourcesTable table={plan.resources} onSkuChange={handleResourceSkuChange} />
            </div>
        </div>
    );
};

const MermaidDiagram = ({ definition }: { definition: string }): JSX.Element => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If the definition is empty or doesn't look like mermaid syntax, skip rendering
        if (!definition.trim() || !isMermaidSyntax(definition)) {
            setError('not-mermaid');
            return;
        }

        let cancelled = false;

        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'var(--vscode-font-family)',
            flowchart: {
                curve: 'basis',
                padding: 20,
                nodeSpacing: 40,
                rankSpacing: 50,
                htmlLabels: true,
                defaultRenderer: 'elk',
            },
            themeVariables: {
                primaryColor: '#0078d4',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#005a9e',
                lineColor: '#888888',
                secondaryColor: '#252526',
                tertiaryColor: '#1e1e1e',
                fontSize: '14px',
                nodeBorder: '2px',
                clusterBorder: '#555',
                edgeLabelBackground: '#1e1e1e',
            },
        });

        void (async () => {
            try {
                const id = `mermaid-${Date.now()}`;
                const { svg } = await mermaid.render(id, definition);
                if (!cancelled && containerRef.current) {
                    containerRef.current.innerHTML = svg;
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            }
        })();

        return () => { cancelled = true; };
    }, [definition]);

    if (error || !definition.trim()) {
        return <pre className='mermaidBlock'><code>{definition || 'No diagram available'}</code></pre>;
    }

    return <div className='mermaidRendered' ref={containerRef} />;
};

const mermaidKeywords = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey)\b/m;

function isMermaidSyntax(text: string): boolean {
    return mermaidKeywords.test(text);
}

const PlanTable = ({ table }: { table: DeploymentPlanTable }): JSX.Element => (
    <table className='planTable'>
        <thead>
            <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
            {table.rows.map((row, ri) => (
                <tr key={ri}>
                    {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
            ))}
        </tbody>
    </table>
);

const skuOptions: Record<string, string[]> = {
    'Static Web Apps': ['Free', 'Standard'],
    'Functions App': ['Consumption (Y1)', 'Premium (EP1)', 'Premium (EP2)', 'Premium (EP3)'],
    'Storage Account': ['Standard LRS (required by Functions)', 'Standard GRS', 'Standard ZRS'],
    'Cosmos DB account': ['Serverless, NoSQL', 'Provisioned (400 RU/s), NoSQL', 'Provisioned (1000 RU/s), NoSQL'],
    'Key Vault': ['Standard', 'Premium'],
    'Log Analytics Workspace': ['PerGB2018', 'CapacityReservation', 'Free'],
};

interface ResourcesTableProps {
    table: DeploymentPlanTable;
    onSkuChange: (rowIdx: number, value: string) => void;
}

const ResourcesTable = ({ table, onSkuChange }: ResourcesTableProps): JSX.Element => {
    const skuColIdx = table.headers.length - 1;

    return (
        <table className='planTable'>
            <thead>
                <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
                {table.rows.map((row, ri) => {
                    const resourceName = row[0];
                    const options = skuOptions[resourceName];
                    return (
                        <tr key={ri}>
                            {row.map((cell, ci) => (
                                <td key={ci}>
                                    {ci === skuColIdx && options ? (
                                        <select
                                            className='cellDropdown'
                                            value={cell}
                                            onChange={(e) => onSkuChange(ri, e.target.value)}
                                        >
                                            {!options.includes(cell) && <option value={cell}>{cell}</option>}
                                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : cell}
                                </td>
                            ))}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};
