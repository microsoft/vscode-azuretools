/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from '@fluentui/react-components';
import { CheckmarkRegular } from '@fluentui/react-icons';
import mermaid from 'mermaid';
import { useCallback, useContext, useEffect, useRef, useState, type JSX } from 'react';
import { WebviewContext } from '../WebviewContext';
import '../styles/localPlanView.scss';
import { type LocalPlanContent, type LocalPlanData, type LocalPlanSection } from './utils/parseLocalPlanMarkdown';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontSize: 30,
    flowchart: {
        nodeSpacing: 60,
        rankSpacing: 80,
        padding: 20,
        useMaxWidth: false,
    },
});
let mermaidIdCounter = 0;

const alwaysExpandedSections = new Set(['project analysis', 'prerequisites', 'scan results']);

export const LocalPlanView = (): JSX.Element => {
    const [plan, setPlan] = useState<LocalPlanData | null>(null);
    const { vscodeApi } = useContext(WebviewContext);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.command === 'setLocalPlanData') {
                setPlan(message.data as LocalPlanData);
            }
        };
        window.addEventListener('message', handler);
        vscodeApi.postMessage({ command: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleApprove = useCallback(() => {
        if (plan) {
            vscodeApi.postMessage({ command: 'approvePlan', data: plan });
        }
    }, [plan, vscodeApi]);

    if (!plan) {
        return <div className='localPlanView'><p>Loading local dev plan...</p></div>;
    }

    return (
        <div className='localPlanView'>
            <div className='planHeader'>
                <div className='headerTop'>
                    <div>
                        <h1>{plan.title}</h1>
                        <div className='metadataBadges'>
                            <span className='badge'>{plan.status}</span>
                        </div>
                        {plan.headerNote && (
                            <p className='headerNote' dangerouslySetInnerHTML={{ __html: formatInline(plan.headerNote) }} />
                        )}
                    </div>
                    <Button
                        appearance='primary'
                        icon={<CheckmarkRegular />}
                        onClick={handleApprove}
                    >
                        Approve Plan
                    </Button>
                </div>
            </div>

            {plan.sections
                .filter((s) => !isHiddenSection(s.title))
                .map((section, i) => (
                    <SectionCard
                        key={i}
                        section={section}
                        collapsible={!alwaysExpandedSections.has(section.title.toLowerCase())}
                    />
                ))}
        </div>
    );
};

const SectionCard = ({ section, collapsible }: { section: LocalPlanSection; collapsible: boolean }): JSX.Element => {
    const [open, setOpen] = useState(!collapsible);

    return (
        <div className='sectionCard'>
            <div
                className={`sectionHeading ${collapsible ? 'clickable' : ''}`}
                onClick={() => collapsible && setOpen(!open)}
            >
                {collapsible && <span className={`sectionChevron ${open ? 'open' : ''}`}>▶</span>}
                <h2>{section.title}</h2>
            </div>
            {open && (
                <div className='sectionContent'>
                    {section.content.map((item, i) => (
                        <ContentBlock key={i} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

function isHiddenSection(title: string): boolean {
    const lower = title.toLowerCase();
    return lower === 'execution checklist' || lower === 'manual tests';
}

const ContentBlock = ({ item }: { item: LocalPlanContent }): JSX.Element => {
    switch (item.type) {
        case 'table':
            return <TableBlock headers={item.headers} rows={item.rows} />;
        case 'codeBlock':
            if (item.language?.toLowerCase() === 'mermaid') {
                return <MermaidBlock code={item.code} />;
            }
            return <CodeBlock language={item.language} code={item.code} />;
        case 'bulletList':
            return <BulletListBlock items={item.items} />;
        case 'blockquote':
            return <BlockquoteBlock text={item.text} />;
        case 'paragraph':
            return <p className='paragraph' dangerouslySetInnerHTML={{ __html: formatInline(item.text) }} />;
        case 'subsection':
            return <SubsectionBlock title={item.title} content={item.content} />;
    }
};

const TableBlock = ({ headers, rows }: { headers: string[]; rows: string[][] }): JSX.Element => (
    <table className='planTable'>
        <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
            {rows.map((row, ri) => (
                <tr key={ri}>
                    {row.map((cell, ci) => (
                        <td key={ci} dangerouslySetInnerHTML={{ __html: formatInline(cell) }} />
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

const CodeBlock = ({ language, code }: { language: string; code: string }): JSX.Element => (
    <div className='codeBlock'>
        {language && <span className='codeBlockLang'>{language}</span>}
        <pre><code>{code}</code></pre>
    </div>
);

const MermaidBlock = ({ code }: { code: string }): JSX.Element => {
    const ref = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const id = `mermaid-diagram-${++mermaidIdCounter}`;
        mermaid.render(id, code).then(({ svg }) => {
            if (!cancelled && ref.current) {
                ref.current.innerHTML = svg;
                setError(null);
            }
        }).catch((err: Error) => {
            if (!cancelled) {
                setError(err.message);
            }
        });
        return () => { cancelled = true; };
    }, [code]);

    if (error) {
        return (
            <div className='codeBlock'>
                <span className='codeBlockLang'>mermaid (error)</span>
                <pre><code>{code}</code></pre>
            </div>
        );
    }

    return <div className='mermaidDiagram' ref={ref} />;
};

const BulletListBlock = ({ items }: { items: string[] }): JSX.Element => (
    <ul className='bulletList'>
        {items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
        ))}
    </ul>
);

const BlockquoteBlock = ({ text }: { text: string }): JSX.Element => (
    <div className='blockquote' dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
);

const SubsectionBlock = ({ title, content }: { title: string; content: LocalPlanContent[] }): JSX.Element => {
    const [open, setOpen] = useState(false);

    return (
        <div className='subsection'>
            <div className='subsectionHeading clickable' onClick={() => setOpen(!open)}>
                <span className={`sectionChevron ${open ? 'open' : ''}`}>▶</span>
                <h3>{title}</h3>
            </div>
            {open && (
                <div className='subsectionContent'>
                    {content.map((item, i) => (
                        <ContentBlock key={i} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

function formatInline(text: string): string {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="link" title="$2">$1</span>');
}
