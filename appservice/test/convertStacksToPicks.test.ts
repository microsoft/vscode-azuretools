/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ApplicationStack } from 'azure-arm-website/lib/models';
import { convertStacksToPicks } from '../src';
import { LinuxRuntimes } from '../src/createAppService/AppKind';

const stacks: ApplicationStack[] = [
    {
        name: "ruby",
        display: "Ruby",
        majorVersions: [
            {
                displayVersion: "Ruby 2.3",
                runtimeVersion: "RUBY|2.3"
            },
            {
                displayVersion: "Ruby 2.4",
                runtimeVersion: "RUBY|2.4"
            },
            {
                displayVersion: "Ruby 2.5",
                runtimeVersion: "RUBY|2.5"
            },
            {
                displayVersion: "Ruby 2.6",
                runtimeVersion: "RUBY|2.6"
            }
        ]
    },
    {
        name: "node",
        display: "Node.js",
        majorVersions: [
            {
                displayVersion: "Node.js LTS",
                runtimeVersion: "NODE|lts"
            },
            {
                displayVersion: "Node.js 4.4",
                runtimeVersion: "NODE|4.4"
            },
            {
                displayVersion: "Node.js 4.5",
                runtimeVersion: "NODE|4.5"
            },
            {
                displayVersion: "Node.js 4.8",
                runtimeVersion: "NODE|4.8"
            },
            {
                displayVersion: "Node.js 6.2",
                runtimeVersion: "NODE|6.2"
            },
            {
                displayVersion: "Node.js 6.6",
                runtimeVersion: "NODE|6.6"
            },
            {
                displayVersion: "Node.js 6.9",
                runtimeVersion: "NODE|6.9"
            },
            {
                displayVersion: "Node.js 6.10",
                runtimeVersion: "NODE|6.10"
            },
            {
                displayVersion: "Node.js 6.11",
                runtimeVersion: "NODE|6.11"
            },
            {
                displayVersion: "Node.js 8.0",
                runtimeVersion: "NODE|8.0"
            },
            {
                displayVersion: "Node.js 8.1",
                runtimeVersion: "NODE|8.1"
            },
            {
                displayVersion: "Node.js 8.2",
                runtimeVersion: "NODE|8.2"
            },
            {
                displayVersion: "Node.js 8.8",
                runtimeVersion: "NODE|8.8"
            },
            {
                displayVersion: "Node.js 8.9",
                runtimeVersion: "NODE|8.9"
            },
            {
                displayVersion: "Node.js 8.11",
                runtimeVersion: "NODE|8.11"
            },
            {
                displayVersion: "Node.js 8.12",
                runtimeVersion: "NODE|8.12"
            },
            {
                displayVersion: "Node.js 9.4",
                runtimeVersion: "NODE|9.4"
            },
            {
                displayVersion: "Node.js 10.1",
                runtimeVersion: "NODE|10.1"
            },
            {
                displayVersion: "Node.js 10.10",
                runtimeVersion: "NODE|10.10"
            },
            {
                displayVersion: "Node.js 10.12",
                runtimeVersion: "NODE|10.12"
            },
            {
                displayVersion: "Node.js 10.14",
                runtimeVersion: "NODE|10.14"
            }
        ]
    },
    {
        name: "php",
        display: "PHP",
        majorVersions: [
            {
                displayVersion: "PHP 5.6",
                runtimeVersion: "PHP|5.6"
            },
            {
                displayVersion: "PHP 7.0",
                runtimeVersion: "PHP|7.0"
            },
            {
                displayVersion: "PHP 7.2",
                runtimeVersion: "PHP|7.2"
            },
            {
                displayVersion: "PHP 7.3",
                runtimeVersion: "PHP|7.3"
            }
        ]
    },
    {
        name: "dotnetcore",
        display: ".NET Core",
        majorVersions: [
            {
                displayVersion: ".NET Core 1.0",
                runtimeVersion: "DOTNETCORE|1.0"
            },
            {
                displayVersion: ".NET Core 1.1",
                runtimeVersion: "DOTNETCORE|1.1"
            },
            {
                displayVersion: ".NET Core 2.0",
                runtimeVersion: "DOTNETCORE|2.0"
            },
            {
                displayVersion: ".NET Core 2.1",
                runtimeVersion: "DOTNETCORE|2.1"
            },
            {
                displayVersion: ".NET Core 2.2",
                runtimeVersion: "DOTNETCORE|2.2"
            }
        ]
    },
    {
        name: "java8",
        display: "Java 8",
        majorVersions: [
            {
                displayVersion: "Tomcat 8.5",
                runtimeVersion: "TOMCAT|8.5-jre8"
            },
            {
                displayVersion: "Tomcat 9.0",
                runtimeVersion: "TOMCAT|9.0-jre8"
            },
            {
                displayVersion: "Java SE",
                runtimeVersion: "JAVA|8-jre8"
            },
            {
                displayVersion: "WildFly 14 - Preview",
                runtimeVersion: "WILDFLY|14-jre8"
            }
        ]
    },
    {
        name: "java11",
        display: "Java 11",
        majorVersions: [
            {
                displayVersion: "Tomcat 8.5",
                runtimeVersion: "TOMCAT|8.5-java11"
            },
            {
                displayVersion: "Tomcat 9.0",
                runtimeVersion: "TOMCAT|9.0-java11"
            },
            {
                displayVersion: "Java SE",
                runtimeVersion: "JAVA|11-java11"
            }
        ]
    },
    {
        name: "python",
        display: "Python",
        majorVersions: [
            {
                displayVersion: "Python 3.7",
                runtimeVersion: "PYTHON|3.7"
            },
            {
                displayVersion: "Python 3.6",
                runtimeVersion: "PYTHON|3.6"
            },
            {
                displayVersion: "Python 2.7",
                runtimeVersion: "PYTHON|2.7"
            }
        ]
    }
];

const expectedDotnetPicks: {}[] = [
    {
        id: "DOTNETCORE|2.2",
        label: ".NET Core 2.2",
        data: "DOTNETCORE|2.2",
        description: undefined
    },
    {
        id: "DOTNETCORE|2.1",
        label: ".NET Core 2.1",
        data: "DOTNETCORE|2.1",
        description: undefined
    }
];

const expectedJavaPicks: {}[] = [
    {
        id: "JAVA|11-java11",
        label: "Java SE",
        data: "JAVA|11-java11",
        description: "Java 11"
    },
    {
        id: "JAVA|8-jre8",
        label: "Java SE",
        data: "JAVA|8-jre8",
        description: "Java 8"
    }
];

const expectedNodePicks: {}[] = [
    {
        id: "NODE|lts",
        label: "Node.js LTS",
        data: "NODE|lts",
        description: undefined
    },
    {
        id: "NODE|10.14",
        label: "Node.js 10.14",
        data: "NODE|10.14",
        description: undefined
    },
    {
        id: "NODE|10.12",
        label: "Node.js 10.12",
        data: "NODE|10.12",
        description: undefined
    },
    {
        id: "NODE|10.10",
        label: "Node.js 10.10",
        data: "NODE|10.10",
        description: undefined
    },
    {
        id: "NODE|10.1",
        label: "Node.js 10.1",
        data: "NODE|10.1",
        description: undefined
    },
    {
        id: "NODE|9.4",
        label: "Node.js 9.4",
        data: "NODE|9.4",
        description: undefined
    },
    {
        id: "NODE|8.12",
        label: "Node.js 8.12",
        data: "NODE|8.12",
        description: undefined
    },
    {
        id: "NODE|8.11",
        label: "Node.js 8.11",
        data: "NODE|8.11",
        description: undefined
    },
    {
        id: "NODE|8.9",
        label: "Node.js 8.9",
        data: "NODE|8.9",
        description: undefined
    },
    {
        id: "NODE|8.8",
        label: "Node.js 8.8",
        data: "NODE|8.8",
        description: undefined
    },
    {
        id: "NODE|8.2",
        label: "Node.js 8.2",
        data: "NODE|8.2",
        description: undefined
    },
    {
        id: "NODE|8.1",
        label: "Node.js 8.1",
        data: "NODE|8.1",
        description: undefined
    },
    {
        id: "NODE|8.0",
        label: "Node.js 8.0",
        data: "NODE|8.0",
        description: undefined
    }
];

const expectedPhpPicks: {}[] = [
    {
        id: "PHP|7.3",
        label: "PHP 7.3",
        data: "PHP|7.3",
        description: undefined
    },
    {
        id: "PHP|7.2",
        label: "PHP 7.2",
        data: "PHP|7.2",
        description: undefined
    },
    {
        id: "PHP|7.0",
        label: "PHP 7.0",
        data: "PHP|7.0",
        description: undefined
    },
    {
        id: "PHP|5.6",
        label: "PHP 5.6",
        data: "PHP|5.6",
        description: undefined
    }
];

const expectedPythonPicks: {}[] = [
    {
        id: "PYTHON|3.7",
        label: "Python 3.7",
        data: "PYTHON|3.7",
        description: undefined
    },
    {
        id: "PYTHON|3.6",
        label: "Python 3.6",
        data: "PYTHON|3.6",
        description: undefined
    },
    {
        id: "PYTHON|2.7",
        label: "Python 2.7",
        data: "PYTHON|2.7",
        description: undefined
    }
];

const expectedRubyPicks: {}[] = [
    {
        id: "RUBY|2.6",
        label: "Ruby 2.6",
        data: "RUBY|2.6",
        description: undefined
    },
    {
        id: "RUBY|2.5",
        label: "Ruby 2.5",
        data: "RUBY|2.5",
        description: undefined
    },
    {
        id: "RUBY|2.4",
        label: "Ruby 2.4",
        data: "RUBY|2.4",
        description: undefined
    },
    {
        id: "RUBY|2.3",
        label: "Ruby 2.3",
        data: "RUBY|2.3",
        description: undefined
    }
];

const expectedTomcatPicks: {}[] = [
    {
        id: "TOMCAT|9.0-java11",
        label: "Tomcat 9.0",
        data: "TOMCAT|9.0-java11",
        description: "Java 11"
    },
    {
        id: "TOMCAT|9.0-jre8",
        label: "Tomcat 9.0",
        data: "TOMCAT|9.0-jre8",
        description: "Java 8"
    },
    {
        id: "TOMCAT|8.5-java11",
        label: "Tomcat 8.5",
        data: "TOMCAT|8.5-java11",
        description: "Java 11"
    },
    {
        id: "TOMCAT|8.5-jre8",
        label: "Tomcat 8.5",
        data: "TOMCAT|8.5-jre8",
        description: "Java 8"
    }
];

const expectedWildflyPicks: {}[] = [
    {
        id: "WILDFLY|14-jre8",
        label: "WildFly 14 - Preview",
        data: "WILDFLY|14-jre8",
        description: "Java 8"
    }
];

suite("convertStacksToPicks", () => {
    test('No recommendations', () => {
        assert.deepEqual(convertStacksToPicks(stacks, undefined), [
            ...expectedDotnetPicks,
            ...expectedJavaPicks,
            ...expectedNodePicks,
            ...expectedPhpPicks,
            ...expectedPythonPicks,
            ...expectedRubyPicks,
            ...expectedTomcatPicks,
            ...expectedWildflyPicks
        ]);
    });

    test('Java recommendations', () => {
        assert.deepEqual(convertStacksToPicks(stacks, [LinuxRuntimes.java, LinuxRuntimes.tomcat, LinuxRuntimes.wildfly]), [
            ...expectedJavaPicks,
            ...expectedTomcatPicks,
            ...expectedWildflyPicks,
            ...expectedDotnetPicks,
            ...expectedNodePicks,
            ...expectedPhpPicks,
            ...expectedPythonPicks,
            ...expectedRubyPicks
        ]);
    });

    test('Node recommendations', () => {
        assert.deepEqual(convertStacksToPicks(stacks, [LinuxRuntimes.node]), [
            ...expectedNodePicks,
            ...expectedDotnetPicks,
            ...expectedJavaPicks,
            ...expectedPhpPicks,
            ...expectedPythonPicks,
            ...expectedRubyPicks,
            ...expectedTomcatPicks,
            ...expectedWildflyPicks
        ]);
    });

    test('Python recommendations', () => {
        assert.deepEqual(convertStacksToPicks(stacks, [LinuxRuntimes.python]), [
            ...expectedPythonPicks,
            ...expectedDotnetPicks,
            ...expectedJavaPicks,
            ...expectedNodePicks,
            ...expectedPhpPicks,
            ...expectedRubyPicks,
            ...expectedTomcatPicks,
            ...expectedWildflyPicks
        ]);
    });
});
