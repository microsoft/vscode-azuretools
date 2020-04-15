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
                displayVersion: "2.3",
                runtimeVersion: "RUBY|2.3"
            },
            {
                displayVersion: "2.4",
                runtimeVersion: "RUBY|2.4"
            },
            {
                displayVersion: "2.5",
                runtimeVersion: "RUBY|2.5"
            },
            {
                displayVersion: "2.6",
                runtimeVersion: "RUBY|2.6"
            }
        ]
    },
    {
        name: "node",
        display: "Node",
        majorVersions: [
            {
                displayVersion: "LTS",
                runtimeVersion: "NODE|lts"
            },
            {
                displayVersion: "12 LTS",
                runtimeVersion: "NODE|12-lts"
            },
            {
                displayVersion: "10 LTS",
                runtimeVersion: "NODE|10-lts"
            },
            {
                displayVersion: "8 LTS",
                runtimeVersion: "NODE|8-lts"
            },
            {
                displayVersion: "6 LTS",
                runtimeVersion: "NODE|6-lts"
            },
            {
                displayVersion: "4.4",
                runtimeVersion: "NODE|4.4"
            },
            {
                displayVersion: "4.5",
                runtimeVersion: "NODE|4.5"
            },
            {
                displayVersion: "4.8",
                runtimeVersion: "NODE|4.8"
            },
            {
                displayVersion: "6.2",
                runtimeVersion: "NODE|6.2"
            },
            {
                displayVersion: "6.6",
                runtimeVersion: "NODE|6.6"
            },
            {
                displayVersion: "6.9",
                runtimeVersion: "NODE|6.9"
            },
            {
                displayVersion: "6.10",
                runtimeVersion: "NODE|6.10"
            },
            {
                displayVersion: "6.11",
                runtimeVersion: "NODE|6.11"
            },
            {
                displayVersion: "8.0",
                runtimeVersion: "NODE|8.0"
            },
            {
                displayVersion: "8.1",
                runtimeVersion: "NODE|8.1"
            },
            {
                displayVersion: "8.2",
                runtimeVersion: "NODE|8.2"
            },
            {
                displayVersion: "8.8",
                runtimeVersion: "NODE|8.8"
            },
            {
                displayVersion: "8.9",
                runtimeVersion: "NODE|8.9"
            },
            {
                displayVersion: "8.11",
                runtimeVersion: "NODE|8.11"
            },
            {
                displayVersion: "8.12",
                runtimeVersion: "NODE|8.12"
            },
            {
                displayVersion: "9.4",
                runtimeVersion: "NODE|9.4"
            },
            {
                displayVersion: "10.1",
                runtimeVersion: "NODE|10.1"
            },
            {
                displayVersion: "10.10",
                runtimeVersion: "NODE|10.10"
            },
            {
                displayVersion: "10.12",
                runtimeVersion: "NODE|10.12"
            },
            {
                displayVersion: "10.14",
                runtimeVersion: "NODE|10.14"
            },
            {
                displayVersion: "10.16",
                runtimeVersion: "NODE|10.16"
            },
            {
                displayVersion: "12.9",
                runtimeVersion: "NODE|12.9"
            }
        ]
    },
    {
        name: "php",
        display: "PHP",
        majorVersions: [
            {
                displayVersion: "5.6",
                runtimeVersion: "PHP|5.6"
            },
            {
                displayVersion: "7.0",
                runtimeVersion: "PHP|7.0"
            },
            {
                displayVersion: "7.2",
                runtimeVersion: "PHP|7.2"
            },
            {
                displayVersion: "7.3",
                runtimeVersion: "PHP|7.3"
            }
        ]
    },
    {
        name: "dotnetcore",
        display: ".NET Core",
        majorVersions: [
            {
                displayVersion: "1.0",
                runtimeVersion: "DOTNETCORE|1.0"
            },
            {
                displayVersion: "1.1",
                runtimeVersion: "DOTNETCORE|1.1"
            },
            {
                displayVersion: "2.0",
                runtimeVersion: "DOTNETCORE|2.0"
            },
            {
                displayVersion: "2.1",
                runtimeVersion: "DOTNETCORE|2.1"
            },
            {
                displayVersion: "2.2",
                runtimeVersion: "DOTNETCORE|2.2"
            },
            {
                displayVersion: "3.0",
                runtimeVersion: "DOTNETCORE|3.0"
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
                displayVersion: "3.8",
                runtimeVersion: "PYTHON|3.8"
            },
            {
                displayVersion: "3.7",
                runtimeVersion: "PYTHON|3.7"
            },
            {
                displayVersion: "3.6",
                runtimeVersion: "PYTHON|3.6"
            },
            {
                displayVersion: "2.7",
                runtimeVersion: "PYTHON|2.7"
            }
        ]
    }
];

const expectedDotnetPicks: {}[] = [
    {
        id: "DOTNETCORE|3.0",
        label: ".NET Core 3.0",
        data: "DOTNETCORE|3.0",
        description: undefined
    },
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
        label: "Node LTS",
        data: "NODE|lts",
        description: undefined
    },
    {
        id: "NODE|12-lts",
        label: "Node 12 LTS",
        data: "NODE|12-lts",
        description: undefined
    },
    {
        id: "NODE|12.9",
        label: "Node 12.9",
        data: "NODE|12.9",
        description: undefined
    },
    {
        id: "NODE|10-lts",
        label: "Node 10 LTS",
        data: "NODE|10-lts",
        description: undefined
    },
    {
        id: "NODE|10.16",
        label: "Node 10.16",
        data: "NODE|10.16",
        description: undefined
    },
    {
        id: "NODE|10.14",
        label: "Node 10.14",
        data: "NODE|10.14",
        description: undefined
    },
    {
        id: "NODE|10.12",
        label: "Node 10.12",
        data: "NODE|10.12",
        description: undefined
    },
    {
        id: "NODE|10.10",
        label: "Node 10.10",
        data: "NODE|10.10",
        description: undefined
    },
    {
        id: "NODE|10.1",
        label: "Node 10.1",
        data: "NODE|10.1",
        description: undefined
    },
    {
        id: "NODE|9.4",
        label: "Node 9.4",
        data: "NODE|9.4",
        description: undefined
    },
    {
        id: "NODE|8-lts",
        label: "Node 8 LTS",
        data: "NODE|8-lts",
        description: undefined
    },
    {
        id: "NODE|8.12",
        label: "Node 8.12",
        data: "NODE|8.12",
        description: undefined
    },
    {
        id: "NODE|8.11",
        label: "Node 8.11",
        data: "NODE|8.11",
        description: undefined
    },
    {
        id: "NODE|8.9",
        label: "Node 8.9",
        data: "NODE|8.9",
        description: undefined
    },
    {
        id: "NODE|8.8",
        label: "Node 8.8",
        data: "NODE|8.8",
        description: undefined
    },
    {
        id: "NODE|8.2",
        label: "Node 8.2",
        data: "NODE|8.2",
        description: undefined
    },
    {
        id: "NODE|8.1",
        label: "Node 8.1",
        data: "NODE|8.1",
        description: undefined
    },
    {
        id: "NODE|8.0",
        label: "Node 8.0",
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
        id: "PYTHON|3.8",
        label: "Python 3.8",
        data: "PYTHON|3.8",
        description: undefined
    },
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

suite("convertStacksToPicks", () => {
    test('No recommendations', () => {
        assert.deepEqual(convertStacksToPicks(stacks, undefined), [
            ...expectedDotnetPicks,
            ...expectedJavaPicks,
            ...expectedNodePicks,
            ...expectedPhpPicks,
            ...expectedPythonPicks,
            ...expectedRubyPicks,
            ...expectedTomcatPicks
        ]);
    });

    test('Java recommendations', () => {
        assert.deepEqual(convertStacksToPicks(stacks, [LinuxRuntimes.java, LinuxRuntimes.tomcat]), [
            ...expectedJavaPicks,
            ...expectedTomcatPicks,
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
            ...expectedTomcatPicks
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
            ...expectedTomcatPicks
        ]);
    });
});
