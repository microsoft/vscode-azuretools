/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Spinner, Textarea } from '@fluentui/react-components';
import { CheckmarkRegular, CommentEditRegular, DismissRegular, SendRegular } from '@fluentui/react-icons';
import mermaid from 'mermaid';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import '../styles/deploymentPlanView.scss';
import { WebviewContext } from '../WebviewContext';

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

type SkuKey = `sku:${number}`;

type FeedbackItem =
    | { id: string; kind: 'dropdown'; cell: SkuKey; rowIdx: number; field: string; from: string; to: string }
    | { id: string; kind: 'freeform'; text: string };

let feedbackIdCounter = 0;
const nextId = (): string => `fb-${++feedbackIdCounter}`;

function buildFeedbackPrompt(items: FeedbackItem[]): string {
    const changes = items
        .filter((i): i is Extract<FeedbackItem, { kind: 'dropdown' }> => i.kind === 'dropdown')
        .map(i => `- Change SKU for ${i.field} from ${i.from} to ${i.to}`);
    const notes = items
        .filter((i): i is Extract<FeedbackItem, { kind: 'freeform' }> => i.kind === 'freeform')
        .map(i => `- ${i.text.trim()}`)
        .filter(t => t.length > 2);

    const lines: string[] = [
        'Please revise the deployment plan based on my feedback and update plan.md.',
        'Keep existing sections unchanged unless a change below implies otherwise. Wait for my approval after updating the file.',
        '',
    ];
    if (changes.length > 0) {
        lines.push('Changes:', ...changes, '');
    }
    if (notes.length > 0) {
        lines.push('Additional notes:', ...notes, '');
    }
    return lines.join('\n').trimEnd();
}

export const DeploymentPlanView = (): JSX.Element => {
    const [plan, setPlan] = useState<DeploymentPlanData | null>(null);
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [freeformDraft, setFreeformDraft] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isAwaitingRevision, setIsAwaitingRevision] = useState(false);
    // Tracks the ORIGINAL SKU value when first edited, keyed by row index.
    // Used to revert cells when a dropdown feedback item is discarded or the
    // user selects the same value again.
    const originalSkuValues = useRef<Map<SkuKey, string>>(new Map());
    const { vscodeApi } = useContext(WebviewContext);

    const hasEdits = useMemo(
        () => feedbackItems.length > 0 || freeformDraft.trim().length > 0,
        [feedbackItems, freeformDraft],
    );

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.command === 'setDeploymentPlanData') {
                setPlan(message.data as DeploymentPlanData);
                // New plan data from the controller — either the initial load or a
                // post-revision refresh. Either way, clear pending feedback state.
                setFeedbackItems([]);
                setFreeformDraft('');
                originalSkuValues.current.clear();
            } else if (message?.command === 'revisionInProgress') {
                setIsAwaitingRevision(true);
                setDrawerOpen(false);
            } else if (message?.command === 'revisionComplete') {
                setIsAwaitingRevision(false);
            }
        };
        window.addEventListener('message', handler);
        vscodeApi.postMessage({ command: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleApprove = useCallback(() => {
        if (!plan) {
            return;
        }
        if (hasEdits) {
            setDrawerOpen(true);
            return;
        }
        vscodeApi.postMessage({ command: 'approve', data: plan });
    }, [vscodeApi, plan, hasEdits]);

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

    const mutateSku = useCallback((rowIdx: number, value: string) => {
        setPlan(prev => {
            if (!prev) { return prev; }
            const updated = structuredClone(prev);
            const skuColIdx = updated.resources.headers.length - 1;
            updated.resources.rows[rowIdx][skuColIdx] = value;
            return updated;
        });
    }, []);

    const handleResourceSkuChange = useCallback((rowIdx: number, value: string) => {
        if (!plan) {
            return;
        }
        const skuColIdx = plan.resources.headers.length - 1;
        const currentValue = plan.resources.rows[rowIdx][skuColIdx];
        const field = plan.resources.rows[rowIdx][0];
        const key: SkuKey = `sku:${rowIdx}`;
        const original = originalSkuValues.current.get(key) ?? currentValue;
        if (!originalSkuValues.current.has(key)) {
            originalSkuValues.current.set(key, currentValue);
        }

        mutateSku(rowIdx, value);

        setFeedbackItems(prev => {
            const existingIdx = prev.findIndex(i => i.kind === 'dropdown' && i.cell === key);
            // Back to original → drop the feedback item (and forget the original).
            if (value === original) {
                originalSkuValues.current.delete(key);
                if (existingIdx >= 0) {
                    const next = prev.slice();
                    next.splice(existingIdx, 1);
                    return next;
                }
                return prev;
            }
            if (existingIdx >= 0) {
                const next = prev.slice();
                const existing = next[existingIdx];
                if (existing.kind === 'dropdown') {
                    next[existingIdx] = { ...existing, to: value };
                }
                return next;
            }
            return [
                ...prev,
                {
                    id: nextId(),
                    kind: 'dropdown',
                    cell: key,
                    rowIdx,
                    field,
                    from: original,
                    to: value,
                },
            ];
        });
    }, [plan, mutateSku]);

    const handleRemoveFeedback = useCallback((id: string) => {
        setFeedbackItems(prev => {
            const item = prev.find(i => i.id === id);
            if (item?.kind === 'dropdown') {
                mutateSku(item.rowIdx, item.from);
                originalSkuValues.current.delete(item.cell);
            }
            return prev.filter(i => i.id !== id);
        });
    }, [mutateSku]);

    const handleAddNote = useCallback(() => {
        const text = freeformDraft.trim();
        if (!text) {
            return;
        }
        setFeedbackItems(prev => [...prev, { id: nextId(), kind: 'freeform', text }]);
        setFreeformDraft('');
    }, [freeformDraft]);

    const handleDiscardAll = useCallback(() => {
        // Revert any cells touched by dropdown feedback items.
        setFeedbackItems(prev => {
            for (const item of prev) {
                if (item.kind === 'dropdown') {
                    mutateSku(item.rowIdx, item.from);
                }
            }
            return [];
        });
        originalSkuValues.current.clear();
        setFreeformDraft('');
    }, [mutateSku]);

    const handleSubmitFeedback = useCallback(() => {
        if (!plan || !hasEdits) {
            return;
        }
        const draftTrimmed = freeformDraft.trim();
        const items = draftTrimmed.length > 0
            ? [...feedbackItems, { id: nextId(), kind: 'freeform' as const, text: draftTrimmed }]
            : feedbackItems;
        const prompt = buildFeedbackPrompt(items);
        vscodeApi.postMessage({ command: 'submitPlanFeedback', prompt, data: plan });
        setIsAwaitingRevision(true);
        setDrawerOpen(false);
    }, [plan, hasEdits, feedbackItems, freeformDraft, vscodeApi]);

    if (!plan) {
        return <div className='deploymentPlanView'><p>Loading deployment plan...</p></div>;
    }

    return (
        <div className={`deploymentPlanView ${drawerOpen ? 'drawerOpen' : ''} ${isAwaitingRevision ? 'revising' : ''}`}>
            <div className='planMain'>
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
                                appearance='secondary'
                                icon={<CommentEditRegular />}
                                disabled={isAwaitingRevision}
                                onClick={() => setDrawerOpen(v => !v)}
                            >
                                Feedback{hasEdits ? ` (${feedbackItems.length + (freeformDraft.trim() ? 1 : 0)})` : ''}
                            </Button>
                            <Button
                                appearance='primary'
                                icon={hasEdits ? <CommentEditRegular /> : <CheckmarkRegular />}
                                disabled={isAwaitingRevision}
                                onClick={handleApprove}
                            >
                                {hasEdits ? 'Review & Submit' : 'Approve'}
                            </Button>
                        </div>
                    </div>
                </div>

                {isAwaitingRevision && (
                    <div className='revisionBanner' role='status' aria-live='polite'>
                        <Spinner size='tiny' />
                        <span>Copilot is revising the plan…</span>
                    </div>
                )}

                <div className='infoCards'>
                    <div className='infoCard'>
                        <span className='infoLabel'>Subscription</span>
                        {plan.availableSubscriptions && plan.availableSubscriptions.length > 0 ? (
                            <select
                                className='cellDropdown'
                                value={plan.subscription}
                                disabled={isAwaitingRevision}
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
                                disabled={isAwaitingRevision}
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
                    <ResourcesTable
                        table={plan.resources}
                        disabled={isAwaitingRevision}
                        onSkuChange={handleResourceSkuChange}
                    />
                </div>
            </div>

            {drawerOpen && !isAwaitingRevision && (
                <FeedbackDrawer
                    items={feedbackItems}
                    freeformDraft={freeformDraft}
                    onFreeformChange={setFreeformDraft}
                    onAddNote={handleAddNote}
                    onRemoveItem={handleRemoveFeedback}
                    onSubmit={handleSubmitFeedback}
                    onDiscardAll={handleDiscardAll}
                    onClose={() => setDrawerOpen(false)}
                />
            )}
        </div>
    );
};

interface FeedbackDrawerProps {
    items: FeedbackItem[];
    freeformDraft: string;
    onFreeformChange: (value: string) => void;
    onAddNote: () => void;
    onRemoveItem: (id: string) => void;
    onSubmit: () => void;
    onDiscardAll: () => void;
    onClose: () => void;
}

const FeedbackDrawer = ({ items, freeformDraft, onFreeformChange, onAddNote, onRemoveItem, onSubmit, onDiscardAll, onClose }: FeedbackDrawerProps): JSX.Element => {
    const hasAny = items.length > 0 || freeformDraft.trim().length > 0;
    return (
        <aside className='feedbackDrawer' aria-label='Plan feedback'>
            <div className='drawerHeader'>
                <h2>Request changes</h2>
                <Button
                    appearance='subtle'
                    icon={<DismissRegular />}
                    aria-label='Close feedback'
                    onClick={onClose}
                />
            </div>

            <div className='drawerBody'>
                {items.length === 0 && (
                    <p className='drawerHint'>
                        Change a SKU in the Azure Resources table to capture a suggested edit here, or add a free-form note below.
                    </p>
                )}

                {items.length > 0 && (
                    <ul className='feedbackList'>
                        {items.map(item => (
                            <li key={item.id} className={`feedbackItem ${item.kind}`}>
                                {item.kind === 'dropdown' ? (
                                    <span className='feedbackChipText'>
                                        <strong>{item.field}:</strong> {item.from}
                                        <span className='arrow'> → </span>
                                        {item.to}
                                    </span>
                                ) : (
                                    <span className='feedbackFreeformText'>{item.text}</span>
                                )}
                                <Button
                                    appearance='subtle'
                                    size='small'
                                    icon={<DismissRegular />}
                                    aria-label='Remove feedback item'
                                    onClick={() => onRemoveItem(item.id)}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                <div className='freeformBlock'>
                    <Textarea
                        value={freeformDraft}
                        onChange={(_, data) => onFreeformChange(data.value)}
                        placeholder='Add a note for Copilot (e.g. "Use a Premium plan for the Functions App")'
                        rows={3}
                        resize='vertical'
                    />
                    <div className='freeformActions'>
                        <Button
                            appearance='secondary'
                            size='small'
                            disabled={freeformDraft.trim().length === 0}
                            onClick={onAddNote}
                        >
                            Add note
                        </Button>
                    </div>
                </div>
            </div>

            <div className='drawerFooter'>
                <Button
                    appearance='subtle'
                    disabled={!hasAny}
                    onClick={onDiscardAll}
                >
                    Discard all
                </Button>
                <Button
                    appearance='primary'
                    icon={<SendRegular />}
                    disabled={!hasAny}
                    onClick={onSubmit}
                >
                    Submit feedback
                </Button>
            </div>
        </aside>
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
    disabled?: boolean;
    onSkuChange: (rowIdx: number, value: string) => void;
}

const ResourcesTable = ({ table, disabled, onSkuChange }: ResourcesTableProps): JSX.Element => {
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
                                            disabled={disabled}
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
