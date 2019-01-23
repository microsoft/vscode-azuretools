/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:max-func-body-length no-multiline-string indent object-literal-key-quotes typedef

import * as assert from 'assert';
// tslint:disable-next-line:no-require-imports
import copyWebpackPlugin = require('copy-webpack-plugin');
import { Configuration } from 'webpack';
import { excludeNodeModulesAndDependencies, getExternalsEntries, getNodeModuleCopyEntries, getNodeModulesDependencyClosure, PackageLock } from "../src/webpack/excludeNodeModulesAndDependencies";

const packageLockJson: PackageLock = {
    "name": "vscode-azureextensiondev",
    "version": "0.1.1",
    "lockfileVersion": 1,
    "requires": true,
    "dependencies": {
        "@types/mocha": {
            "version": "2.2.48",
            "resolved": "https://registry.npmjs.org/@types/mocha/-/mocha-2.2.48.tgz",
            "integrity": "sha512-nlK/iyETgafGli8Zh9zJVCTicvU3iajSkRwOh3Hhiva598CMqNJ4NcVCGMTGKpGpTYj/9R8RLzS9NAykSSCqGw==",
            "dev": true
        },
        "@types/node": {
            "version": "10.12.18",
            "resolved": "https://registry.npmjs.org/@types/node/-/node-10.12.18.tgz",
            "integrity": "sha512-fh+pAqt4xRzPfqA6eh3Z2y6fyZavRIumvjhaCL753+TVkGKGhpPeyrJG2JftD0T9q4GF00KjefsQ+PQNDdWQaQ==",
            "dev": true
        },
        "ajv": {
            "version": "6.7.0",
            "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.7.0.tgz",
            "integrity": "sha512-RZXPviBTtfmtka9n9sy1N5M5b82CbxWIR6HIis4s3WQTXDJamc/0gpCWNGz6EWdWp4DOfjzJfhz/AS9zVPjjWg==",
            "dev": true,
            "requires": {
                "fast-deep-equal": "^2.0.1",
                "fast-json-stable-stringify": "^2.0.0",
                "json-schema-traverse": "^0.4.1",
                "uri-js": "^4.2.2"
            }
        },
        "ansi-cyan": {
            "version": "0.1.1",
            "resolved": "https://registry.npmjs.org/ansi-cyan/-/ansi-cyan-0.1.1.tgz",
            "integrity": "sha1-U4rlKK+JgvKK4w2G8vF0VtJgmHM=",
            "dev": true,
            "requires": {
                "ansi-wrap": "0.1.0"
            }
        },
        "ansi-red": {
            "version": "0.1.1",
            "resolved": "https://registry.npmjs.org/ansi-red/-/ansi-red-0.1.1.tgz",
            "integrity": "sha1-jGOPnRCAgAo1PJwoyKgcpHBdlGw=",
            "dev": true,
            "requires": {
                "ansi-wrap": "0.1.0"
            }
        },
        "ansi-regex": {
            "version": "3.0.0",
            "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-3.0.0.tgz",
            "integrity": "sha1-7QMXwyIGT3lGbAKWa922Bas32Zg=",
            "dev": true
        },
        "ansi-styles": {
            "version": "2.2.1",
            "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-2.2.1.tgz",
            "integrity": "sha1-tDLdM1i2NM914eRmQ2gkBTPB3b4=",
            "dev": true
        },
        "ansi-wrap": {
            "version": "0.1.0",
            "resolved": "https://registry.npmjs.org/ansi-wrap/-/ansi-wrap-0.1.0.tgz",
            "integrity": "sha1-qCJQ3bABXponyoLoLqYDu/pF768=",
            "dev": true
        },
        "append-buffer": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/append-buffer/-/append-buffer-1.0.2.tgz",
            "integrity": "sha1-2CIM9GYIFSXv6lBhTz3mUU36WPE=",
            "dev": true,
            "requires": {
                "buffer-equal": "^1.0.0"
            }
        },
        "argparse": {
            "version": "1.0.10",
            "resolved": "https://registry.npmjs.org/argparse/-/argparse-1.0.10.tgz",
            "integrity": "sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg==",
            "dev": true,
            "requires": {
                "sprintf-js": "~1.0.2"
            }
        },
        "arr-diff": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/arr-diff/-/arr-diff-1.1.0.tgz",
            "integrity": "sha1-aHwydYFjWI/vfeezb6vklesaOZo=",
            "dev": true,
            "requires": {
                "arr-flatten": "^1.0.1",
                "array-slice": "^0.2.3"
            }
        },
        "arr-flatten": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/arr-flatten/-/arr-flatten-1.1.0.tgz",
            "integrity": "sha512-L3hKV5R/p5o81R7O02IGnwpDmkp6E982XhtbuwSe3O4qOtMMMtodicASA1Cny2U+aCXcNpml+m4dPsvsJ3jatg==",
            "dev": true
        },
        "arr-union": {
            "version": "2.1.0",
            "resolved": "https://registry.npmjs.org/arr-union/-/arr-union-2.1.0.tgz",
            "integrity": "sha1-IPnqtexw9cfSFbEHexw5Fh0pLH0=",
            "dev": true
        },
        "array-differ": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/array-differ/-/array-differ-1.0.0.tgz",
            "integrity": "sha1-7/UuN1gknTO+QCuLuOVkuytdQDE=",
            "dev": true
        },
        "array-slice": {
            "version": "0.2.3",
            "resolved": "https://registry.npmjs.org/array-slice/-/array-slice-0.2.3.tgz",
            "integrity": "sha1-3Tz7gO15c6dRF82sabC5nshhhvU=",
            "dev": true
        },
        "array-union": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/array-union/-/array-union-1.0.2.tgz",
            "integrity": "sha1-mjRBDk9OPaI96jdb5b5w8kd47Dk=",
            "dev": true,
            "requires": {
                "array-uniq": "^1.0.1"
            }
        },
        "array-uniq": {
            "version": "1.0.3",
            "resolved": "https://registry.npmjs.org/array-uniq/-/array-uniq-1.0.3.tgz",
            "integrity": "sha1-r2rId6Jcx/dOBYiUdThY39sk/bY=",
            "dev": true
        },
        "arrify": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/arrify/-/arrify-1.0.1.tgz",
            "integrity": "sha1-iYUI2iIm84DfkEcoRWhJwVAaSw0=",
            "dev": true
        },
        "asn1": {
            "version": "0.2.4",
            "resolved": "https://registry.npmjs.org/asn1/-/asn1-0.2.4.tgz",
            "integrity": "sha512-jxwzQpLQjSmWXgwaCZE9Nz+glAG01yF1QnWgbhGwHI5A6FRIEY6IVqtHhIepHqI7/kyEyQEagBC5mBEFlIYvdg==",
            "dev": true,
            "requires": {
                "safer-buffer": "~2.1.0"
            }
        },
        "assert-plus": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/assert-plus/-/assert-plus-1.0.0.tgz",
            "integrity": "sha1-8S4PPF13sLHN2RRpQuTpbB5N1SU=",
            "dev": true
        },
        "asynckit": {
            "version": "0.4.0",
            "resolved": "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz",
            "integrity": "sha1-x57Zf380y48robyXkLzDZkdLS3k=",
            "dev": true
        },
        "aws-sign2": {
            "version": "0.7.0",
            "resolved": "https://registry.npmjs.org/aws-sign2/-/aws-sign2-0.7.0.tgz",
            "integrity": "sha1-tG6JCTSpWR8tL2+G1+ap8bP+dqg=",
            "dev": true
        },
        "aws4": {
            "version": "1.8.0",
            "resolved": "https://registry.npmjs.org/aws4/-/aws4-1.8.0.tgz",
            "integrity": "sha512-ReZxvNHIOv88FlT7rxcXIIC0fPt4KZqZbOlivyWtXLt8ESx84zd3kMC6iK5jVeS2qt+g7ftS7ye4fi06X5rtRQ==",
            "dev": true
        },
        "babel-code-frame": {
            "version": "6.26.0",
            "resolved": "https://registry.npmjs.org/babel-code-frame/-/babel-code-frame-6.26.0.tgz",
            "integrity": "sha1-Y/1D99weO7fONZR9uP42mj9Yx0s=",
            "dev": true,
            "requires": {
                "chalk": "^1.1.3",
                "esutils": "^2.0.2",
                "js-tokens": "^3.0.2"
            },
            "dependencies": {
                "ansi-regex": {
                    "version": "2.1.1",
                    "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-2.1.1.tgz",
                    "integrity": "sha1-w7M6te42DYbg5ijwRorn7yfWVN8=",
                    "dev": true
                },
                "chalk": {
                    "version": "1.1.3",
                    "resolved": "https://registry.npmjs.org/chalk/-/chalk-1.1.3.tgz",
                    "integrity": "sha1-qBFcVeSnAv5NFQq9OHKCKn4J/Jg=",
                    "dev": true,
                    "requires": {
                        "ansi-styles": "^2.2.1",
                        "escape-string-regexp": "^1.0.2",
                        "has-ansi": "^2.0.0",
                        "strip-ansi": "^3.0.0",
                        "supports-color": "^2.0.0"
                    }
                },
                "strip-ansi": {
                    "version": "3.0.1",
                    "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-3.0.1.tgz",
                    "integrity": "sha1-ajhfuIU9lS1f8F0Oiq+UJ43GPc8=",
                    "dev": true,
                    "requires": {
                        "ansi-regex": "^2.0.0"
                    }
                },
                "supports-color": {
                    "version": "2.0.0",
                    "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-2.0.0.tgz",
                    "integrity": "sha1-U10EXOa2Nj+kARcIRimZXp3zJMc=",
                    "dev": true
                }
            }
        },
        "balanced-match": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.0.tgz",
            "integrity": "sha1-ibTRmasr7kneFk6gK4nORi1xt2c=",
            "dev": true
        },
        "bcrypt-pbkdf": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/bcrypt-pbkdf/-/bcrypt-pbkdf-1.0.2.tgz",
            "integrity": "sha1-pDAdOJtqQ/m2f/PKEaP2Y342Dp4=",
            "dev": true,
            "requires": {
                "tweetnacl": "^0.14.3"
            }
        },
        "block-stream": {
            "version": "0.0.9",
            "resolved": "https://registry.npmjs.org/block-stream/-/block-stream-0.0.9.tgz",
            "integrity": "sha1-E+v+d4oDIFz+A3UUgeu0szAMEmo=",
            "dev": true,
            "requires": {
                "inherits": "~2.0.0"
            }
        },
        "brace-expansion": {
            "version": "1.1.11",
            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.11.tgz",
            "integrity": "sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==",
            "dev": true,
            "requires": {
                "balanced-match": "^1.0.0",
                "concat-map": "0.0.1"
            }
        },
        "browser-stdout": {
            "version": "1.3.0",
            "resolved": "https://registry.npmjs.org/browser-stdout/-/browser-stdout-1.3.0.tgz",
            "integrity": "sha1-81HTKWnTL6XXpVZxVCY9korjvR8=",
            "dev": true
        },
        "buffer-crc32": {
            "version": "0.2.13",
            "resolved": "https://registry.npmjs.org/buffer-crc32/-/buffer-crc32-0.2.13.tgz",
            "integrity": "sha1-DTM+PwDqxQqhRUq9MO+MKl2ackI=",
            "dev": true
        },
        "buffer-equal": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/buffer-equal/-/buffer-equal-1.0.0.tgz",
            "integrity": "sha1-WWFrSYME1Var1GaWayLu2j7KX74=",
            "dev": true
        },
        "buffer-from": {
            "version": "1.1.1",
            "resolved": "https://registry.npmjs.org/buffer-from/-/buffer-from-1.1.1.tgz",
            "integrity": "sha512-MQcXEUbCKtEo7bhqEs6560Hyd4XaovZlO/k9V3hjVUF/zwW7KBVdSK4gIt/bzwS9MbR5qob+F5jusZsb0YQK2A==",
            "dev": true
        },
        "builtin-modules": {
            "version": "1.1.1",
            "resolved": "https://registry.npmjs.org/builtin-modules/-/builtin-modules-1.1.1.tgz",
            "integrity": "sha1-Jw8HbFpywC9bZaR9+Uxf46J4iS8=",
            "dev": true
        },
        "caseless": {
            "version": "0.12.0",
            "resolved": "https://registry.npmjs.org/caseless/-/caseless-0.12.0.tgz",
            "integrity": "sha1-G2gcIf+EAzyCZUMJBolCDRhxUdw=",
            "dev": true
        },
        "chalk": {
            "version": "2.4.2",
            "resolved": "https://registry.npmjs.org/chalk/-/chalk-2.4.2.tgz",
            "integrity": "sha512-Mti+f9lpJNcwF4tWV8/OrTTtF1gZi+f8FqlyAdouralcFWFQWF2+NgCHShjkCb+IFBLq9buZwE1xckQU4peSuQ==",
            "dev": true,
            "requires": {
                "ansi-styles": "^3.2.1",
                "escape-string-regexp": "^1.0.5",
                "supports-color": "^5.3.0"
            },
            "dependencies": {
                "ansi-styles": {
                    "version": "3.2.1",
                    "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-3.2.1.tgz",
                    "integrity": "sha512-VT0ZI6kZRdTh8YyJw3SMbYm/u+NqfsAxEpWO0Pf9sq8/e94WxxOpPKx9FR1FlyCtOVDNOQ+8ntlqFxiRc+r5qA==",
                    "dev": true,
                    "requires": {
                        "color-convert": "^1.9.0"
                    }
                },
                "escape-string-regexp": {
                    "version": "1.0.5",
                    "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-1.0.5.tgz",
                    "integrity": "sha1-G2HAViGQqN/2rjuyzwIAyhMLhtQ=",
                    "dev": true
                },
                "supports-color": {
                    "version": "5.5.0",
                    "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-5.5.0.tgz",
                    "integrity": "sha512-QjVjwdXIt408MIiAqCX4oUKsgU2EqAGzs2Ppkm4aQYbjm+ZEWEcW4SfFNTr4uMNZma0ey4f5lgLrkB0aX0QMow==",
                    "dev": true,
                    "requires": {
                        "has-flag": "^3.0.0"
                    }
                }
            }
        },
        "charenc": {
            "version": "0.0.2",
            "resolved": "https://registry.npmjs.org/charenc/-/charenc-0.0.2.tgz",
            "integrity": "sha1-wKHS86cJLgN3S/qD8UwPxXkKhmc=",
            "dev": true
        },
        "clone": {
            "version": "0.2.0",
            "resolved": "https://registry.npmjs.org/clone/-/clone-0.2.0.tgz",
            "integrity": "sha1-xhJqkK1Pctv1rNskPMN3JP6T/B8=",
            "dev": true
        },
        "clone-buffer": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/clone-buffer/-/clone-buffer-1.0.0.tgz",
            "integrity": "sha1-4+JbIHrE5wGvch4staFnksrD3Fg=",
            "dev": true
        },
        "clone-stats": {
            "version": "0.0.1",
            "resolved": "https://registry.npmjs.org/clone-stats/-/clone-stats-0.0.1.tgz",
            "integrity": "sha1-uI+UqCzzi4eR1YBG6kAprYjKmdE=",
            "dev": true
        },
        "cloneable-readable": {
            "version": "1.1.2",
            "resolved": "https://registry.npmjs.org/cloneable-readable/-/cloneable-readable-1.1.2.tgz",
            "integrity": "sha512-Bq6+4t+lbM8vhTs/Bef5c5AdEMtapp/iFb6+s4/Hh9MVTt8OLKH7ZOOZSCT+Ys7hsHvqv0GuMPJ1lnQJVHvxpg==",
            "dev": true,
            "requires": {
                "inherits": "^2.0.1",
                "process-nextick-args": "^2.0.0",
                "readable-stream": "^2.3.5"
            }
        },
        "color-convert": {
            "version": "1.9.3",
            "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-1.9.3.tgz",
            "integrity": "sha512-QfAUtd+vFdAtFQcC8CCyYt1fYWxSqAiK2cSD6zDB8N3cpsEBAvRxp9zOGg6G/SHHJYAT88/az/IuDGALsNVbGg==",
            "dev": true,
            "requires": {
                "color-name": "1.1.3"
            }
        },
        "color-name": {
            "version": "1.1.3",
            "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.3.tgz",
            "integrity": "sha1-p9BVi9icQveV3UIyj3QIMcpTvCU=",
            "dev": true
        },
        "combined-stream": {
            "version": "1.0.7",
            "resolved": "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.7.tgz",
            "integrity": "sha512-brWl9y6vOB1xYPZcpZde3N9zDByXTosAeMDo4p1wzo6UMOX4vumB+TP1RZ76sfE6Md68Q0NJSrE/gbezd4Ul+w==",
            "dev": true,
            "requires": {
                "delayed-stream": "~1.0.0"
            }
        },
        "commander": {
            "version": "2.3.0",
            "resolved": "https://registry.npmjs.org/commander/-/commander-2.3.0.tgz",
            "integrity": "sha1-/UMOiJgy7DU7ms0d4hfBHLPu+HM=",
            "dev": true
        },
        "concat-map": {
            "version": "0.0.1",
            "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
            "integrity": "sha1-2Klr13/Wjfd5OnMDajug1UBdR3s=",
            "dev": true
        },
        "convert-source-map": {
            "version": "1.6.0",
            "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-1.6.0.tgz",
            "integrity": "sha512-eFu7XigvxdZ1ETfbgPBohgyQ/Z++C0eEhTor0qRwBw9unw+L0/6V8wkSuGgzdThkiS5lSpdptOQPD8Ak40a+7A==",
            "dev": true,
            "requires": {
                "safe-buffer": "~5.1.1"
            }
        },
        "core-util-is": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/core-util-is/-/core-util-is-1.0.2.tgz",
            "integrity": "sha1-tf1UIgqivFq1eqtxQMlAdUUDwac=",
            "dev": true
        },
        "crypt": {
            "version": "0.0.2",
            "resolved": "https://registry.npmjs.org/crypt/-/crypt-0.0.2.tgz",
            "integrity": "sha1-iNf/fsDfuG9xPch7u0LQRNPmxBs=",
            "dev": true
        },
        "dashdash": {
            "version": "1.14.1",
            "resolved": "https://registry.npmjs.org/dashdash/-/dashdash-1.14.1.tgz",
            "integrity": "sha1-hTz6D3y+L+1d4gMmuN1YEDX24vA=",
            "dev": true,
            "requires": {
                "assert-plus": "^1.0.0"
            }
        },
        "debug": {
            "version": "2.2.0",
            "resolved": "https://registry.npmjs.org/debug/-/debug-2.2.0.tgz",
            "integrity": "sha1-+HBX6ZWxofauaklgZkE3vFbwOdo=",
            "dev": true,
            "requires": {
                "ms": "0.7.1"
            }
        },
        "deep-assign": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/deep-assign/-/deep-assign-1.0.0.tgz",
            "integrity": "sha1-sJJ0O+hCfcYh6gBnzex+cN0Z83s=",
            "dev": true,
            "requires": {
                "is-obj": "^1.0.0"
            }
        },
        "define-properties": {
            "version": "1.1.3",
            "resolved": "https://registry.npmjs.org/define-properties/-/define-properties-1.1.3.tgz",
            "integrity": "sha512-3MqfYKj2lLzdMSf8ZIZE/V+Zuy+BgD6f164e8K2w7dgnpKArBDerGYpM46IYYcjnkdPNMjPk9A6VFB8+3SKlXQ==",
            "dev": true,
            "requires": {
                "object-keys": "^1.0.12"
            }
        },
        "delayed-stream": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz",
            "integrity": "sha1-3zrhmayt+31ECqrgsp4icrJOxhk=",
            "dev": true
        },
        "diff": {
            "version": "1.4.0",
            "resolved": "https://registry.npmjs.org/diff/-/diff-1.4.0.tgz",
            "integrity": "sha1-fyjS657nsVqX79ic5j3P2qPMur8=",
            "dev": true
        },
        "duplexer": {
            "version": "0.1.1",
            "resolved": "https://registry.npmjs.org/duplexer/-/duplexer-0.1.1.tgz",
            "integrity": "sha1-rOb/gIwc5mtX0ev5eXessCM0z8E=",
            "dev": true
        },
        "duplexify": {
            "version": "3.6.1",
            "resolved": "https://registry.npmjs.org/duplexify/-/duplexify-3.6.1.tgz",
            "integrity": "sha512-vM58DwdnKmty+FSPzT14K9JXb90H+j5emaR4KYbr2KTIz00WHGbWOe5ghQTx233ZCLZtrGDALzKwcjEtSt35mA==",
            "dev": true,
            "requires": {
                "end-of-stream": "^1.0.0",
                "inherits": "^2.0.1",
                "readable-stream": "^2.0.0",
                "stream-shift": "^1.0.0"
            }
        },
        "ecc-jsbn": {
            "version": "0.1.2",
            "resolved": "https://registry.npmjs.org/ecc-jsbn/-/ecc-jsbn-0.1.2.tgz",
            "integrity": "sha1-OoOpBOVDUyh4dMVkt1SThoSamMk=",
            "dev": true,
            "requires": {
                "jsbn": "~0.1.0",
                "safer-buffer": "^2.1.0"
            }
        },
        "end-of-stream": {
            "version": "1.4.1",
            "resolved": "https://registry.npmjs.org/end-of-stream/-/end-of-stream-1.4.1.tgz",
            "integrity": "sha512-1MkrZNvWTKCaigbn+W15elq2BB/L22nqrSY5DKlo3X6+vclJm8Bb5djXJBmEX6fS3+zCh/F4VBK5Z2KxJt4s2Q==",
            "dev": true,
            "requires": {
                "once": "^1.4.0"
            }
        },
        "escape-string-regexp": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-1.0.2.tgz",
            "integrity": "sha1-Tbwv5nTnGUnK8/smlc5/LcHZqNE=",
            "dev": true
        },
        "esprima": {
            "version": "4.0.1",
            "resolved": "https://registry.npmjs.org/esprima/-/esprima-4.0.1.tgz",
            "integrity": "sha512-eGuFFw7Upda+g4p+QHvnW0RyTX/SVeJBDM/gCtMARO0cLuT2HcEKnTPvhjV6aGeqrCB/sbNop0Kszm0jsaWU4A==",
            "dev": true
        },
        "esutils": {
            "version": "2.0.2",
            "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.2.tgz",
            "integrity": "sha1-Cr9PHKpbyx96nYrMbepPqqBLrJs=",
            "dev": true
        },
        "event-stream": {
            "version": "3.3.4",
            "resolved": "https://registry.npmjs.org/event-stream/-/event-stream-3.3.4.tgz",
            "integrity": "sha1-SrTJoPWlTbkzi0w02Gv86PSzVXE=",
            "dev": true,
            "requires": {
                "duplexer": "~0.1.1",
                "from": "~0",
                "map-stream": "~0.1.0",
                "pause-stream": "0.0.11",
                "split": "0.3",
                "stream-combiner": "~0.0.4",
                "through": "~2.3.1"
            }
        },
        "extend": {
            "version": "3.0.2",
            "resolved": "https://registry.npmjs.org/extend/-/extend-3.0.2.tgz",
            "integrity": "sha512-fjquC59cD7CyW6urNXK0FBufkZcoiGG80wTuPujX590cB5Ttln20E2UB4S/WARVqhXffZl2LNgS+gQdPIIim/g==",
            "dev": true
        },
        "extend-shallow": {
            "version": "1.1.4",
            "resolved": "https://registry.npmjs.org/extend-shallow/-/extend-shallow-1.1.4.tgz",
            "integrity": "sha1-Gda/lN/AnXa6cR85uHLSH/TdkHE=",
            "dev": true,
            "requires": {
                "kind-of": "^1.1.0"
            }
        },
        "extsprintf": {
            "version": "1.3.0",
            "resolved": "https://registry.npmjs.org/extsprintf/-/extsprintf-1.3.0.tgz",
            "integrity": "sha1-lpGEQOMEGnpBT4xS48V06zw+HgU=",
            "dev": true
        },
        "fast-deep-equal": {
            "version": "2.0.1",
            "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-2.0.1.tgz",
            "integrity": "sha1-ewUhjd+WZ79/Nwv3/bLLFf3Qqkk=",
            "dev": true
        },
        "fast-json-stable-stringify": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.0.0.tgz",
            "integrity": "sha1-1RQsDK7msRifh9OnYREGT4bIu/I=",
            "dev": true
        },
        "fd-slicer": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/fd-slicer/-/fd-slicer-1.1.0.tgz",
            "integrity": "sha1-JcfInLH5B3+IkbvmHY85Dq4lbx4=",
            "dev": true,
            "requires": {
                "pend": "~1.2.0"
            }
        },
        "flush-write-stream": {
            "version": "1.0.3",
            "resolved": "https://registry.npmjs.org/flush-write-stream/-/flush-write-stream-1.0.3.tgz",
            "integrity": "sha512-calZMC10u0FMUqoiunI2AiGIIUtUIvifNwkHhNupZH4cbNnW1Itkoh/Nf5HFYmDrwWPjrUxpkZT0KhuCq0jmGw==",
            "dev": true,
            "requires": {
                "inherits": "^2.0.1",
                "readable-stream": "^2.0.4"
            }
        },
        "forever-agent": {
            "version": "0.6.1",
            "resolved": "https://registry.npmjs.org/forever-agent/-/forever-agent-0.6.1.tgz",
            "integrity": "sha1-+8cfDEGt6zf5bFd60e1C2P2sypE=",
            "dev": true
        },
        "form-data": {
            "version": "2.3.3",
            "resolved": "https://registry.npmjs.org/form-data/-/form-data-2.3.3.tgz",
            "integrity": "sha512-1lLKB2Mu3aGP1Q/2eCOx0fNbRMe7XdwktwOruhfqqd0rIJWwN4Dh+E3hrPSlDCXnSR7UtZ1N38rVXm+6+MEhJQ==",
            "dev": true,
            "requires": {
                "asynckit": "^0.4.0",
                "combined-stream": "^1.0.6",
                "mime-types": "^2.1.12"
            }
        },
        "from": {
            "version": "0.1.7",
            "resolved": "https://registry.npmjs.org/from/-/from-0.1.7.tgz",
            "integrity": "sha1-g8YK/Fi5xWmXAH7Rp2izqzA6RP4=",
            "dev": true
        },
        "fs-mkdirp-stream": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/fs-mkdirp-stream/-/fs-mkdirp-stream-1.0.0.tgz",
            "integrity": "sha1-C3gV/DIBxqaeFNuYzgmMFpNSWes=",
            "dev": true,
            "requires": {
                "graceful-fs": "^4.1.11",
                "through2": "^2.0.3"
            }
        },
        "fs.realpath": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
            "integrity": "sha1-FQStJSMVjKpA20onh8sBQRmU6k8=",
            "dev": true
        },
        "fstream": {
            "version": "1.0.11",
            "resolved": "https://registry.npmjs.org/fstream/-/fstream-1.0.11.tgz",
            "integrity": "sha1-XB+x8RdHcRTwYyoOtLcbPLD9MXE=",
            "dev": true,
            "requires": {
                "graceful-fs": "^4.1.2",
                "inherits": "~2.0.0",
                "mkdirp": ">=0.5 0",
                "rimraf": "2"
            }
        },
        "function-bind": {
            "version": "1.1.1",
            "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.1.tgz",
            "integrity": "sha512-yIovAzMX49sF8Yl58fSCWJ5svSLuaibPxXQJFLmBObTuCr0Mf1KiPopGM9NiFjiYBCbfaa2Fh6breQ6ANVTI0A==",
            "dev": true
        },
        "getpass": {
            "version": "0.1.7",
            "resolved": "https://registry.npmjs.org/getpass/-/getpass-0.1.7.tgz",
            "integrity": "sha1-Xv+OPmhNVprkyysSgmBOi6YhSfo=",
            "dev": true,
            "requires": {
                "assert-plus": "^1.0.0"
            }
        },
        "glob": {
            "version": "3.2.11",
            "resolved": "https://registry.npmjs.org/glob/-/glob-3.2.11.tgz",
            "integrity": "sha1-Spc/Y1uRkPcV0QmH1cAP0oFevj0=",
            "dev": true,
            "requires": {
                "inherits": "2",
                "minimatch": "0.3"
            }
        },
        "glob-parent": {
            "version": "3.1.0",
            "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-3.1.0.tgz",
            "integrity": "sha1-nmr2KZ2NO9K9QEMIMr0RPfkGxa4=",
            "dev": true,
            "requires": {
                "is-glob": "^3.1.0",
                "path-dirname": "^1.0.0"
            }
        },
        "glob-stream": {
            "version": "6.1.0",
            "resolved": "https://registry.npmjs.org/glob-stream/-/glob-stream-6.1.0.tgz",
            "integrity": "sha1-cEXJlBOz65SIjYOrRtC0BMx73eQ=",
            "dev": true,
            "requires": {
                "extend": "^3.0.0",
                "glob": "^7.1.1",
                "glob-parent": "^3.1.0",
                "is-negated-glob": "^1.0.0",
                "ordered-read-streams": "^1.0.0",
                "pumpify": "^1.3.5",
                "readable-stream": "^2.1.5",
                "remove-trailing-separator": "^1.0.1",
                "to-absolute-glob": "^2.0.0",
                "unique-stream": "^2.0.2"
            },
            "dependencies": {
                "glob": {
                    "version": "7.1.3",
                    "resolved": "https://registry.npmjs.org/glob/-/glob-7.1.3.tgz",
                    "integrity": "sha512-vcfuiIxogLV4DlGBHIUOwI0IbrJ8HWPc4MU7HzviGeNho/UJDfi6B5p3sHeWIQ0KGIU0Jpxi5ZHxemQfLkkAwQ==",
                    "dev": true,
                    "requires": {
                        "fs.realpath": "^1.0.0",
                        "inflight": "^1.0.4",
                        "inherits": "2",
                        "minimatch": "^3.0.4",
                        "once": "^1.3.0",
                        "path-is-absolute": "^1.0.0"
                    }
                },
                "minimatch": {
                    "version": "3.0.4",
                    "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.0.4.tgz",
                    "integrity": "sha512-yJHVQEhyqPLUTgt9B83PXu6W3rx4MvvHvSUvToogpwoGDOUQ+yDrR0HRot+yOCdCO7u4hX3pWft6kWBBcqh0UA==",
                    "dev": true,
                    "requires": {
                        "brace-expansion": "^1.1.7"
                    }
                }
            }
        },
        "graceful-fs": {
            "version": "4.1.15",
            "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.1.15.tgz",
            "integrity": "sha512-6uHUhOPEBgQ24HM+r6b/QwWfZq+yiFcipKFrOFiBEnWdy5sdzYoi+pJeQaPI5qOLRFqWmAXUPQNsielzdLoecA==",
            "dev": true
        },
        "growl": {
            "version": "1.9.2",
            "resolved": "https://registry.npmjs.org/growl/-/growl-1.9.2.tgz",
            "integrity": "sha1-Dqd0NxXbjY3ixe3hd14bRayFwC8=",
            "dev": true
        },
        "gulp-chmod": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/gulp-chmod/-/gulp-chmod-2.0.0.tgz",
            "integrity": "sha1-AMOQuSigeZslGsz2MaoJ4BzGKZw=",
            "dev": true,
            "requires": {
                "deep-assign": "^1.0.0",
                "stat-mode": "^0.2.0",
                "through2": "^2.0.0"
            }
        },
        "gulp-filter": {
            "version": "5.1.0",
            "resolved": "https://registry.npmjs.org/gulp-filter/-/gulp-filter-5.1.0.tgz",
            "integrity": "sha1-oF4Rr/sHz33PQafeHLe2OsN4PnM=",
            "dev": true,
            "requires": {
                "multimatch": "^2.0.0",
                "plugin-error": "^0.1.2",
                "streamfilter": "^1.0.5"
            }
        },
        "gulp-gunzip": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/gulp-gunzip/-/gulp-gunzip-1.0.0.tgz",
            "integrity": "sha1-FbdBFF6Dqcb1CIYkG1fMWHHxUak=",
            "dev": true,
            "requires": {
                "through2": "~0.6.5",
                "vinyl": "~0.4.6"
            },
            "dependencies": {
                "isarray": {
                    "version": "0.0.1",
                    "resolved": "https://registry.npmjs.org/isarray/-/isarray-0.0.1.tgz",
                    "integrity": "sha1-ihis/Kmo9Bd+Cav8YDiTmwXR7t8=",
                    "dev": true
                },
                "readable-stream": {
                    "version": "1.0.34",
                    "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-1.0.34.tgz",
                    "integrity": "sha1-Elgg40vIQtLyqq+v5MKRbuMsFXw=",
                    "dev": true,
                    "requires": {
                        "core-util-is": "~1.0.0",
                        "inherits": "~2.0.1",
                        "isarray": "0.0.1",
                        "string_decoder": "~0.10.x"
                    }
                },
                "string_decoder": {
                    "version": "0.10.31",
                    "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-0.10.31.tgz",
                    "integrity": "sha1-YuIDvEF2bGwoyfyEMB2rHFMQ+pQ=",
                    "dev": true
                },
                "through2": {
                    "version": "0.6.5",
                    "resolved": "https://registry.npmjs.org/through2/-/through2-0.6.5.tgz",
                    "integrity": "sha1-QaucZ7KdVyCQcUEOHXp6lozTrUg=",
                    "dev": true,
                    "requires": {
                        "readable-stream": ">=1.0.33-1 <1.1.0-0",
                        "xtend": ">=4.0.0 <4.1.0-0"
                    }
                }
            }
        },
        "gulp-remote-src-vscode": {
            "version": "0.5.1",
            "resolved": "https://registry.npmjs.org/gulp-remote-src-vscode/-/gulp-remote-src-vscode-0.5.1.tgz",
            "integrity": "sha512-mw4OGjtC/jlCWJFhbcAlel4YPvccChlpsl3JceNiB/DLJi24/UPxXt53/N26lgI3dknEqd4ErfdHrO8sJ5bATQ==",
            "dev": true,
            "requires": {
                "event-stream": "3.3.4",
                "node.extend": "^1.1.2",
                "request": "^2.79.0",
                "through2": "^2.0.3",
                "vinyl": "^2.0.1"
            },
            "dependencies": {
                "clone": {
                    "version": "2.1.2",
                    "resolved": "https://registry.npmjs.org/clone/-/clone-2.1.2.tgz",
                    "integrity": "sha1-G39Ln1kfHo+DZwQBYANFoCiHQ18=",
                    "dev": true
                },
                "clone-stats": {
                    "version": "1.0.0",
                    "resolved": "https://registry.npmjs.org/clone-stats/-/clone-stats-1.0.0.tgz",
                    "integrity": "sha1-s3gt/4u1R04Yuba/D9/ngvh3doA=",
                    "dev": true
                },
                "vinyl": {
                    "version": "2.2.0",
                    "resolved": "https://registry.npmjs.org/vinyl/-/vinyl-2.2.0.tgz",
                    "integrity": "sha512-MBH+yP0kC/GQ5GwBqrTPTzEfiiLjta7hTtvQtbxBgTeSXsmKQRQecjibMbxIXzVT3Y9KJK+drOz1/k+vsu8Nkg==",
                    "dev": true,
                    "requires": {
                        "clone": "^2.1.1",
                        "clone-buffer": "^1.0.0",
                        "clone-stats": "^1.0.0",
                        "cloneable-readable": "^1.0.0",
                        "remove-trailing-separator": "^1.0.1",
                        "replace-ext": "^1.0.0"
                    }
                }
            }
        },
        "gulp-untar": {
            "version": "0.0.7",
            "resolved": "https://registry.npmjs.org/gulp-untar/-/gulp-untar-0.0.7.tgz",
            "integrity": "sha512-0QfbCH2a1k2qkTLWPqTX+QO4qNsHn3kC546YhAP3/n0h+nvtyGITDuDrYBMDZeW4WnFijmkOvBWa5HshTic1tw==",
            "dev": true,
            "requires": {
                "event-stream": "~3.3.4",
                "streamifier": "~0.1.1",
                "tar": "^2.2.1",
                "through2": "~2.0.3",
                "vinyl": "^1.2.0"
            },
            "dependencies": {
                "clone": {
                    "version": "1.0.4",
                    "resolved": "https://registry.npmjs.org/clone/-/clone-1.0.4.tgz",
                    "integrity": "sha1-2jCcwmPfFZlMaIypAheco8fNfH4=",
                    "dev": true
                },
                "replace-ext": {
                    "version": "0.0.1",
                    "resolved": "https://registry.npmjs.org/replace-ext/-/replace-ext-0.0.1.tgz",
                    "integrity": "sha1-KbvZIHinOfC8zitO5B6DeVNSKSQ=",
                    "dev": true
                },
                "vinyl": {
                    "version": "1.2.0",
                    "resolved": "https://registry.npmjs.org/vinyl/-/vinyl-1.2.0.tgz",
                    "integrity": "sha1-XIgDbPVl5d8FVYv8kR+GVt8hiIQ=",
                    "dev": true,
                    "requires": {
                        "clone": "^1.0.0",
                        "clone-stats": "^0.0.1",
                        "replace-ext": "0.0.1"
                    }
                }
            }
        },
        "gulp-vinyl-zip": {
            "version": "2.1.2",
            "resolved": "https://registry.npmjs.org/gulp-vinyl-zip/-/gulp-vinyl-zip-2.1.2.tgz",
            "integrity": "sha512-wJn09jsb8PyvUeyFF7y7ImEJqJwYy40BqL9GKfJs6UGpaGW9A+N68Q+ajsIpb9AeR6lAdjMbIdDPclIGo1/b7Q==",
            "dev": true,
            "requires": {
                "event-stream": "3.3.4",
                "queue": "^4.2.1",
                "through2": "^2.0.3",
                "vinyl": "^2.0.2",
                "vinyl-fs": "^3.0.3",
                "yauzl": "^2.2.1",
                "yazl": "^2.2.1"
            },
            "dependencies": {
                "clone": {
                    "version": "2.1.2",
                    "resolved": "https://registry.npmjs.org/clone/-/clone-2.1.2.tgz",
                    "integrity": "sha1-G39Ln1kfHo+DZwQBYANFoCiHQ18=",
                    "dev": true
                },
                "clone-stats": {
                    "version": "1.0.0",
                    "resolved": "https://registry.npmjs.org/clone-stats/-/clone-stats-1.0.0.tgz",
                    "integrity": "sha1-s3gt/4u1R04Yuba/D9/ngvh3doA=",
                    "dev": true
                },
                "vinyl": {
                    "version": "2.2.0",
                    "resolved": "https://registry.npmjs.org/vinyl/-/vinyl-2.2.0.tgz",
                    "integrity": "sha512-MBH+yP0kC/GQ5GwBqrTPTzEfiiLjta7hTtvQtbxBgTeSXsmKQRQecjibMbxIXzVT3Y9KJK+drOz1/k+vsu8Nkg==",
                    "dev": true,
                    "requires": {
                        "clone": "^2.1.1",
                        "clone-buffer": "^1.0.0",
                        "clone-stats": "^1.0.0",
                        "cloneable-readable": "^1.0.0",
                        "remove-trailing-separator": "^1.0.1",
                        "replace-ext": "^1.0.0"
                    }
                }
            }
        },
        "har-schema": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/har-schema/-/har-schema-2.0.0.tgz",
            "integrity": "sha1-qUwiJOvKwEeCoNkDVSHyRzW37JI=",
            "dev": true
        },
        "har-validator": {
            "version": "5.1.3",
            "resolved": "https://registry.npmjs.org/har-validator/-/har-validator-5.1.3.tgz",
            "integrity": "sha512-sNvOCzEQNr/qrvJgc3UG/kD4QtlHycrzwS+6mfTrrSq97BvaYcPZZI1ZSqGSPR73Cxn4LKTD4PttRwfU7jWq5g==",
            "dev": true,
            "requires": {
                "ajv": "^6.5.5",
                "har-schema": "^2.0.0"
            }
        },
        "has": {
            "version": "1.0.3",
            "resolved": "https://registry.npmjs.org/has/-/has-1.0.3.tgz",
            "integrity": "sha512-f2dvO0VU6Oej7RkWJGrehjbzMAjFp5/VKPp5tTpWIV4JHHZK1/BxbFRtf/siA2SWTe09caDmVtYYzWEIbBS4zw==",
            "dev": true,
            "requires": {
                "function-bind": "^1.1.1"
            }
        },
        "has-ansi": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/has-ansi/-/has-ansi-2.0.0.tgz",
            "integrity": "sha1-NPUEnOHs3ysGSa8+8k5F7TVBbZE=",
            "dev": true,
            "requires": {
                "ansi-regex": "^2.0.0"
            },
            "dependencies": {
                "ansi-regex": {
                    "version": "2.1.1",
                    "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-2.1.1.tgz",
                    "integrity": "sha1-w7M6te42DYbg5ijwRorn7yfWVN8=",
                    "dev": true
                }
            }
        },
        "has-flag": {
            "version": "3.0.0",
            "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-3.0.0.tgz",
            "integrity": "sha1-tdRU3CGZriJWmfNGfloH87lVuv0=",
            "dev": true
        },
        "has-symbols": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/has-symbols/-/has-symbols-1.0.0.tgz",
            "integrity": "sha1-uhqPGvKg/DllD1yFA2dwQSIGO0Q=",
            "dev": true
        },
        "he": {
            "version": "1.1.1",
            "resolved": "https://registry.npmjs.org/he/-/he-1.1.1.tgz",
            "integrity": "sha1-k0EP0hsAlzUVH4howvJx80J+I/0=",
            "dev": true
        },
        "http-signature": {
            "version": "1.2.0",
            "resolved": "https://registry.npmjs.org/http-signature/-/http-signature-1.2.0.tgz",
            "integrity": "sha1-muzZJRFHcvPZW2WmCruPfBj7rOE=",
            "dev": true,
            "requires": {
                "assert-plus": "^1.0.0",
                "jsprim": "^1.2.2",
                "sshpk": "^1.7.0"
            }
        },
        "inflight": {
            "version": "1.0.6",
            "resolved": "https://registry.npmjs.org/inflight/-/inflight-1.0.6.tgz",
            "integrity": "sha1-Sb1jMdfQLQwJvJEKEHW6gWW1bfk=",
            "dev": true,
            "requires": {
                "once": "^1.3.0",
                "wrappy": "1"
            }
        },
        "inherits": {
            "version": "2.0.3",
            "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.3.tgz",
            "integrity": "sha1-Yzwsg+PaQqUC9SRmAiSA9CCCYd4=",
            "dev": true
        },
        "is": {
            "version": "3.3.0",
            "resolved": "https://registry.npmjs.org/is/-/is-3.3.0.tgz",
            "integrity": "sha512-nW24QBoPcFGGHJGUwnfpI7Yc5CdqWNdsyHQszVE/z2pKHXzh7FZ5GWhJqSyaQ9wMkQnsTx+kAI8bHlCX4tKdbg==",
            "dev": true
        },
        "is-absolute": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/is-absolute/-/is-absolute-1.0.0.tgz",
            "integrity": "sha512-dOWoqflvcydARa360Gvv18DZ/gRuHKi2NU/wU5X1ZFzdYfH29nkiNZsF3mp4OJ3H4yo9Mx8A/uAGNzpzPN3yBA==",
            "dev": true,
            "requires": {
                "is-relative": "^1.0.0",
                "is-windows": "^1.0.1"
            }
        },
        "is-buffer": {
            "version": "1.1.6",
            "resolved": "https://registry.npmjs.org/is-buffer/-/is-buffer-1.1.6.tgz",
            "integrity": "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w==",
            "dev": true
        },
        "is-extglob": {
            "version": "2.1.1",
            "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
            "integrity": "sha1-qIwCU1eR8C7TfHahueqXc8gz+MI=",
            "dev": true
        },
        "is-glob": {
            "version": "3.1.0",
            "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-3.1.0.tgz",
            "integrity": "sha1-e6WuJCF4BKxwcHuWkiVnSGzD6Eo=",
            "dev": true,
            "requires": {
                "is-extglob": "^2.1.0"
            }
        },
        "is-negated-glob": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/is-negated-glob/-/is-negated-glob-1.0.0.tgz",
            "integrity": "sha1-aRC8pdqMleeEtXUbl2z1oQ/uNtI=",
            "dev": true
        },
        "is-obj": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/is-obj/-/is-obj-1.0.1.tgz",
            "integrity": "sha1-PkcprB9f3gJc19g6iW2rn09n2w8=",
            "dev": true
        },
        "is-relative": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/is-relative/-/is-relative-1.0.0.tgz",
            "integrity": "sha512-Kw/ReK0iqwKeu0MITLFuj0jbPAmEiOsIwyIXvvbfa6QfmN9pkD1M+8pdk7Rl/dTKbH34/XBFMbgD4iMJhLQbGA==",
            "dev": true,
            "requires": {
                "is-unc-path": "^1.0.0"
            }
        },
        "is-typedarray": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/is-typedarray/-/is-typedarray-1.0.0.tgz",
            "integrity": "sha1-5HnICFjfDBsR3dppQPlgEfzaSpo=",
            "dev": true
        },
        "is-unc-path": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/is-unc-path/-/is-unc-path-1.0.0.tgz",
            "integrity": "sha512-mrGpVd0fs7WWLfVsStvgF6iEJnbjDFZh9/emhRDcGWTduTfNHd9CHeUwH3gYIjdbwo4On6hunkztwOaAw0yllQ==",
            "dev": true,
            "requires": {
                "unc-path-regex": "^0.1.2"
            }
        },
        "is-utf8": {
            "version": "0.2.1",
            "resolved": "https://registry.npmjs.org/is-utf8/-/is-utf8-0.2.1.tgz",
            "integrity": "sha1-Sw2hRCEE0bM2NA6AeX6GXPOffXI=",
            "dev": true
        },
        "is-valid-glob": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/is-valid-glob/-/is-valid-glob-1.0.0.tgz",
            "integrity": "sha1-Kb8+/3Ab4tTTFdusw5vDn+j2Aao=",
            "dev": true
        },
        "is-windows": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/is-windows/-/is-windows-1.0.2.tgz",
            "integrity": "sha512-eXK1UInq2bPmjyX6e3VHIzMLobc4J94i4AWn+Hpq3OU5KkrRC96OAcR3PRJ/pGu6m8TRnBHP9dkXQVsT/COVIA==",
            "dev": true
        },
        "isarray": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/isarray/-/isarray-1.0.0.tgz",
            "integrity": "sha1-u5NdSFgsuhaMBoNJV6VKPgcSTxE=",
            "dev": true
        },
        "isstream": {
            "version": "0.1.2",
            "resolved": "https://registry.npmjs.org/isstream/-/isstream-0.1.2.tgz",
            "integrity": "sha1-R+Y/evVa+m+S4VAOaQ64uFKcCZo=",
            "dev": true
        },
        "jade": {
            "version": "0.26.3",
            "resolved": "https://registry.npmjs.org/jade/-/jade-0.26.3.tgz",
            "integrity": "sha1-jxDXl32NefL2/4YqgbBRPMslaGw=",
            "dev": true,
            "requires": {
                "commander": "0.6.1",
                "mkdirp": "0.3.0"
            },
            "dependencies": {
                "commander": {
                    "version": "0.6.1",
                    "resolved": "https://registry.npmjs.org/commander/-/commander-0.6.1.tgz",
                    "integrity": "sha1-+mihT2qUXVTbvlDYzbMyDp47GgY=",
                    "dev": true
                },
                "mkdirp": {
                    "version": "0.3.0",
                    "resolved": "https://registry.npmjs.org/mkdirp/-/mkdirp-0.3.0.tgz",
                    "integrity": "sha1-G79asbqCevI1dRQ0kEJkVfSB/h4=",
                    "dev": true
                }
            }
        },
        "js-tokens": {
            "version": "3.0.2",
            "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-3.0.2.tgz",
            "integrity": "sha1-mGbfOVECEw449/mWvOtlRDIJwls=",
            "dev": true
        },
        "js-yaml": {
            "version": "3.12.1",
            "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-3.12.1.tgz",
            "integrity": "sha512-um46hB9wNOKlwkHgiuyEVAybXBjwFUV0Z/RaHJblRd9DXltue9FTYvzCr9ErQrK9Adz5MU4gHWVaNUfdmrC8qA==",
            "dev": true,
            "requires": {
                "argparse": "^1.0.7",
                "esprima": "^4.0.0"
            }
        },
        "jsbn": {
            "version": "0.1.1",
            "resolved": "https://registry.npmjs.org/jsbn/-/jsbn-0.1.1.tgz",
            "integrity": "sha1-peZUwuWi3rXyAdls77yoDA7y9RM=",
            "dev": true
        },
        "json-schema": {
            "version": "0.2.3",
            "resolved": "https://registry.npmjs.org/json-schema/-/json-schema-0.2.3.tgz",
            "integrity": "sha1-tIDIkuWaLwWVTOcnvT8qTogvnhM=",
            "dev": true
        },
        "json-schema-traverse": {
            "version": "0.4.1",
            "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz",
            "integrity": "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==",
            "dev": true
        },
        "json-stable-stringify-without-jsonify": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz",
            "integrity": "sha1-nbe1lJatPzz+8wp1FC0tkwrXJlE=",
            "dev": true
        },
        "json-stringify-safe": {
            "version": "5.0.1",
            "resolved": "https://registry.npmjs.org/json-stringify-safe/-/json-stringify-safe-5.0.1.tgz",
            "integrity": "sha1-Epai1Y/UXxmg9s4B1lcB4sc1tus=",
            "dev": true
        },
        "jsprim": {
            "version": "1.4.1",
            "resolved": "https://registry.npmjs.org/jsprim/-/jsprim-1.4.1.tgz",
            "integrity": "sha1-MT5mvB5cwG5Di8G3SZwuXFastqI=",
            "dev": true,
            "requires": {
                "assert-plus": "1.0.0",
                "extsprintf": "1.3.0",
                "json-schema": "0.2.3",
                "verror": "1.10.0"
            }
        },
        "kind-of": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/kind-of/-/kind-of-1.1.0.tgz",
            "integrity": "sha1-FAo9LUGjbS78+pN3tiwk+ElaXEQ=",
            "dev": true
        },
        "lazystream": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/lazystream/-/lazystream-1.0.0.tgz",
            "integrity": "sha1-9plf4PggOS9hOWvolGJAe7dxaOQ=",
            "dev": true,
            "requires": {
                "readable-stream": "^2.0.5"
            }
        },
        "lead": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/lead/-/lead-1.0.0.tgz",
            "integrity": "sha1-bxT5mje+Op3XhPVJVpDlkDRm7kI=",
            "dev": true,
            "requires": {
                "flush-write-stream": "^1.0.2"
            }
        },
        "lru-cache": {
            "version": "2.7.3",
            "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-2.7.3.tgz",
            "integrity": "sha1-bUUk6LlV+V1PW1iFHOId1y+06VI=",
            "dev": true
        },
        "map-stream": {
            "version": "0.1.0",
            "resolved": "https://registry.npmjs.org/map-stream/-/map-stream-0.1.0.tgz",
            "integrity": "sha1-5WqpTEyAVaFkBKBnS3jyFffI4ZQ=",
            "dev": true
        },
        "md5": {
            "version": "2.2.1",
            "resolved": "https://registry.npmjs.org/md5/-/md5-2.2.1.tgz",
            "integrity": "sha1-U6s41f48iJG6RlMp6iP6wFQBJvk=",
            "dev": true,
            "requires": {
                "charenc": "~0.0.1",
                "crypt": "~0.0.1",
                "is-buffer": "~1.1.1"
            }
        },
        "mime-db": {
            "version": "1.37.0",
            "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.37.0.tgz",
            "integrity": "sha512-R3C4db6bgQhlIhPU48fUtdVmKnflq+hRdad7IyKhtFj06VPNVdk2RhiYL3UjQIlso8L+YxAtFkobT0VK+S/ybg==",
            "dev": true
        },
        "mime-types": {
            "version": "2.1.21",
            "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.21.tgz",
            "integrity": "sha512-3iL6DbwpyLzjR3xHSFNFeb9Nz/M8WDkX33t1GFQnFOllWk8pOrh/LSrB5OXlnlW5P9LH73X6loW/eogc+F5lJg==",
            "dev": true,
            "requires": {
                "mime-db": "~1.37.0"
            }
        },
        "minimatch": {
            "version": "0.3.0",
            "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-0.3.0.tgz",
            "integrity": "sha1-J12O2qxPG7MyZHIInnlJyDlGmd0=",
            "dev": true,
            "requires": {
                "lru-cache": "2",
                "sigmund": "~1.0.0"
            }
        },
        "minimist": {
            "version": "0.0.8",
            "resolved": "https://registry.npmjs.org/minimist/-/minimist-0.0.8.tgz",
            "integrity": "sha1-hX/Kv8M5fSYluCKCYuhqp6ARsF0=",
            "dev": true
        },
        "mkdirp": {
            "version": "0.5.1",
            "resolved": "https://registry.npmjs.org/mkdirp/-/mkdirp-0.5.1.tgz",
            "integrity": "sha1-MAV0OOrGz3+MR2fzhkjWaX11yQM=",
            "dev": true,
            "requires": {
                "minimist": "0.0.8"
            }
        },
        "mocha": {
            "version": "2.5.3",
            "resolved": "https://registry.npmjs.org/mocha/-/mocha-2.5.3.tgz",
            "integrity": "sha1-FhvlvetJZ3HrmzV0UFC2IrWu/Fg=",
            "dev": true,
            "requires": {
                "commander": "2.3.0",
                "debug": "2.2.0",
                "diff": "1.4.0",
                "escape-string-regexp": "1.0.2",
                "glob": "3.2.11",
                "growl": "1.9.2",
                "jade": "0.26.3",
                "mkdirp": "0.5.1",
                "supports-color": "1.2.0",
                "to-iso-string": "0.0.2"
            }
        },
        "mocha-junit-reporter": {
            "version": "1.18.0",
            "resolved": "https://registry.npmjs.org/mocha-junit-reporter/-/mocha-junit-reporter-1.18.0.tgz",
            "integrity": "sha512-y3XuqKa2+HRYtg0wYyhW/XsLm2Ps+pqf9HaTAt7+MVUAKFJaNAHOrNseTZo9KCxjfIbxUWwckP5qCDDPUmjSWA==",
            "dev": true,
            "requires": {
                "debug": "^2.2.0",
                "md5": "^2.1.0",
                "mkdirp": "~0.5.1",
                "strip-ansi": "^4.0.0",
                "xml": "^1.0.0"
            }
        },
        "ms": {
            "version": "0.7.1",
            "resolved": "https://registry.npmjs.org/ms/-/ms-0.7.1.tgz",
            "integrity": "sha1-nNE8A62/8ltl7/3nzoZO6VIBcJg=",
            "dev": true
        },
        "multimatch": {
            "version": "2.1.0",
            "resolved": "https://registry.npmjs.org/multimatch/-/multimatch-2.1.0.tgz",
            "integrity": "sha1-nHkGoi+0wCkZ4vX3UWG0zb1LKis=",
            "dev": true,
            "requires": {
                "array-differ": "^1.0.0",
                "array-union": "^1.0.1",
                "arrify": "^1.0.0",
                "minimatch": "^3.0.0"
            },
            "dependencies": {
                "minimatch": {
                    "version": "3.0.4",
                    "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.0.4.tgz",
                    "integrity": "sha512-yJHVQEhyqPLUTgt9B83PXu6W3rx4MvvHvSUvToogpwoGDOUQ+yDrR0HRot+yOCdCO7u4hX3pWft6kWBBcqh0UA==",
                    "dev": true,
                    "requires": {
                        "brace-expansion": "^1.1.7"
                    }
                }
            }
        },
        "node.extend": {
            "version": "1.1.8",
            "resolved": "https://registry.npmjs.org/node.extend/-/node.extend-1.1.8.tgz",
            "integrity": "sha512-L/dvEBwyg3UowwqOUTyDsGBU6kjBQOpOhshio9V3i3BMPv5YUb9+mWNN8MK0IbWqT0AqaTSONZf0aTuMMahWgA==",
            "dev": true,
            "requires": {
                "has": "^1.0.3",
                "is": "^3.2.1"
            }
        },
        "normalize-path": {
            "version": "2.1.1",
            "resolved": "https://registry.npmjs.org/normalize-path/-/normalize-path-2.1.1.tgz",
            "integrity": "sha1-GrKLVW4Zg2Oowab35vogE3/mrtk=",
            "dev": true,
            "requires": {
                "remove-trailing-separator": "^1.0.1"
            }
        },
        "now-and-later": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/now-and-later/-/now-and-later-2.0.0.tgz",
            "integrity": "sha1-vGHLtFbXnLMiB85HygUTb/Ln1u4=",
            "dev": true,
            "requires": {
                "once": "^1.3.2"
            }
        },
        "oauth-sign": {
            "version": "0.9.0",
            "resolved": "https://registry.npmjs.org/oauth-sign/-/oauth-sign-0.9.0.tgz",
            "integrity": "sha512-fexhUFFPTGV8ybAtSIGbV6gOkSv8UtRbDBnAyLQw4QPKkgNlsH2ByPGtMUqdWkos6YCRmAqViwgZrJc/mRDzZQ==",
            "dev": true
        },
        "object-keys": {
            "version": "1.0.12",
            "resolved": "https://registry.npmjs.org/object-keys/-/object-keys-1.0.12.tgz",
            "integrity": "sha512-FTMyFUm2wBcGHnH2eXmz7tC6IwlqQZ6mVZ+6dm6vZ4IQIHjs6FdNsQBuKGPuUUUY6NfJw2PshC08Tn6LzLDOag==",
            "dev": true
        },
        "object.assign": {
            "version": "4.1.0",
            "resolved": "https://registry.npmjs.org/object.assign/-/object.assign-4.1.0.tgz",
            "integrity": "sha512-exHJeq6kBKj58mqGyTQ9DFvrZC/eR6OwxzoM9YRoGBqrXYonaFyGiFMuc9VZrXf7DarreEwMpurG3dd+CNyW5w==",
            "dev": true,
            "requires": {
                "define-properties": "^1.1.2",
                "function-bind": "^1.1.1",
                "has-symbols": "^1.0.0",
                "object-keys": "^1.0.11"
            }
        },
        "once": {
            "version": "1.4.0",
            "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
            "integrity": "sha1-WDsap3WWHUsROsF9nFC6753Xa9E=",
            "dev": true,
            "requires": {
                "wrappy": "1"
            }
        },
        "ordered-read-streams": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/ordered-read-streams/-/ordered-read-streams-1.0.1.tgz",
            "integrity": "sha1-d8DLN8QVJdZBZtmQ/61+xqDhNj4=",
            "dev": true,
            "requires": {
                "readable-stream": "^2.0.1"
            }
        },
        "path-dirname": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/path-dirname/-/path-dirname-1.0.2.tgz",
            "integrity": "sha1-zDPSTVJeCZpTiMAzbG4yuRYGCeA=",
            "dev": true
        },
        "path-is-absolute": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/path-is-absolute/-/path-is-absolute-1.0.1.tgz",
            "integrity": "sha1-F0uSaHNVNP+8es5r9TpanhtcX18=",
            "dev": true
        },
        "path-parse": {
            "version": "1.0.6",
            "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.6.tgz",
            "integrity": "sha512-GSmOT2EbHrINBf9SR7CDELwlJ8AENk3Qn7OikK4nFYAu3Ote2+JYNVvkpAEQm3/TLNEJFD/xZJjzyxg3KBWOzw==",
            "dev": true
        },
        "pause-stream": {
            "version": "0.0.11",
            "resolved": "https://registry.npmjs.org/pause-stream/-/pause-stream-0.0.11.tgz",
            "integrity": "sha1-/lo0sMvOErWqaitAPuLnO2AvFEU=",
            "dev": true,
            "requires": {
                "through": "~2.3"
            }
        },
        "pend": {
            "version": "1.2.0",
            "resolved": "https://registry.npmjs.org/pend/-/pend-1.2.0.tgz",
            "integrity": "sha1-elfrVQpng/kRUzH89GY9XI4AelA=",
            "dev": true
        },
        "performance-now": {
            "version": "2.1.0",
            "resolved": "https://registry.npmjs.org/performance-now/-/performance-now-2.1.0.tgz",
            "integrity": "sha1-Ywn04OX6kT7BxpMHrjZLSzd8nns=",
            "dev": true
        },
        "plugin-error": {
            "version": "0.1.2",
            "resolved": "https://registry.npmjs.org/plugin-error/-/plugin-error-0.1.2.tgz",
            "integrity": "sha1-O5uzM1zPAPQl4HQ34ZJ2ln2kes4=",
            "dev": true,
            "requires": {
                "ansi-cyan": "^0.1.1",
                "ansi-red": "^0.1.1",
                "arr-diff": "^1.0.1",
                "arr-union": "^2.0.1",
                "extend-shallow": "^1.1.2"
            }
        },
        "process-nextick-args": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/process-nextick-args/-/process-nextick-args-2.0.0.tgz",
            "integrity": "sha512-MtEC1TqN0EU5nephaJ4rAtThHtC86dNN9qCuEhtshvpVBkAW5ZO7BASN9REnF9eoXGcRub+pFuKEpOHE+HbEMw==",
            "dev": true
        },
        "psl": {
            "version": "1.1.31",
            "resolved": "https://registry.npmjs.org/psl/-/psl-1.1.31.tgz",
            "integrity": "sha512-/6pt4+C+T+wZUieKR620OpzN/LlnNKuWjy1iFLQ/UG35JqHlR/89MP1d96dUfkf6Dne3TuLQzOYEYshJ+Hx8mw==",
            "dev": true
        },
        "pump": {
            "version": "2.0.1",
            "resolved": "https://registry.npmjs.org/pump/-/pump-2.0.1.tgz",
            "integrity": "sha512-ruPMNRkN3MHP1cWJc9OWr+T/xDP0jhXYCLfJcBuX54hhfIBnaQmAUMfDcG4DM5UMWByBbJY69QSphm3jtDKIkA==",
            "dev": true,
            "requires": {
                "end-of-stream": "^1.1.0",
                "once": "^1.3.1"
            }
        },
        "pumpify": {
            "version": "1.5.1",
            "resolved": "https://registry.npmjs.org/pumpify/-/pumpify-1.5.1.tgz",
            "integrity": "sha512-oClZI37HvuUJJxSKKrC17bZ9Cu0ZYhEAGPsPUy9KlMUmv9dKX2o77RUmq7f3XjIxbwyGwYzbzQ1L2Ks8sIradQ==",
            "dev": true,
            "requires": {
                "duplexify": "^3.6.0",
                "inherits": "^2.0.3",
                "pump": "^2.0.0"
            }
        },
        "punycode": {
            "version": "2.1.1",
            "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.1.1.tgz",
            "integrity": "sha512-XRsRjdf+j5ml+y/6GKHPZbrF/8p2Yga0JPtdqTIY2Xe5ohJPD9saDJJLPvp9+NSBprVvevdXZybnj2cv8OEd0A==",
            "dev": true
        },
        "qs": {
            "version": "6.5.2",
            "resolved": "https://registry.npmjs.org/qs/-/qs-6.5.2.tgz",
            "integrity": "sha512-N5ZAX4/LxJmF+7wN74pUD6qAh9/wnvdQcjq9TZjevvXzSUo7bfmw91saqMjzGS2xq91/odN2dW/WOl7qQHNDGA==",
            "dev": true
        },
        "querystringify": {
            "version": "2.1.0",
            "resolved": "https://registry.npmjs.org/querystringify/-/querystringify-2.1.0.tgz",
            "integrity": "sha512-sluvZZ1YiTLD5jsqZcDmFyV2EwToyXZBfpoVOmktMmW+VEnhgakFHnasVph65fOjGPTWN0Nw3+XQaSeMayr0kg==",
            "dev": true
        },
        "queue": {
            "version": "4.5.1",
            "resolved": "https://registry.npmjs.org/queue/-/queue-4.5.1.tgz",
            "integrity": "sha512-AMD7w5hRXcFSb8s9u38acBZ+309u6GsiibP4/0YacJeaurRshogB7v/ZcVPxP5gD5+zIw6ixRHdutiYUJfwKHw==",
            "dev": true,
            "requires": {
                "inherits": "~2.0.0"
            }
        },
        "readable-stream": {
            "version": "2.3.6",
            "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-2.3.6.tgz",
            "integrity": "sha512-tQtKA9WIAhBF3+VLAseyMqZeBjW0AHJoxOtYqSUZNJxauErmLbVm2FW1y+J/YA9dUrAC39ITejlZWhVIwawkKw==",
            "dev": true,
            "requires": {
                "core-util-is": "~1.0.0",
                "inherits": "~2.0.3",
                "isarray": "~1.0.0",
                "process-nextick-args": "~2.0.0",
                "safe-buffer": "~5.1.1",
                "string_decoder": "~1.1.1",
                "util-deprecate": "~1.0.1"
            }
        },
        "remove-bom-buffer": {
            "version": "3.0.0",
            "resolved": "https://registry.npmjs.org/remove-bom-buffer/-/remove-bom-buffer-3.0.0.tgz",
            "integrity": "sha512-8v2rWhaakv18qcvNeli2mZ/TMTL2nEyAKRvzo1WtnZBl15SHyEhrCu2/xKlJyUFKHiHgfXIyuY6g2dObJJycXQ==",
            "dev": true,
            "requires": {
                "is-buffer": "^1.1.5",
                "is-utf8": "^0.2.1"
            }
        },
        "remove-bom-stream": {
            "version": "1.2.0",
            "resolved": "https://registry.npmjs.org/remove-bom-stream/-/remove-bom-stream-1.2.0.tgz",
            "integrity": "sha1-BfGlk/FuQuH7kOv1nejlaVJflSM=",
            "dev": true,
            "requires": {
                "remove-bom-buffer": "^3.0.0",
                "safe-buffer": "^5.1.0",
                "through2": "^2.0.3"
            }
        },
        "remove-trailing-separator": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/remove-trailing-separator/-/remove-trailing-separator-1.1.0.tgz",
            "integrity": "sha1-wkvOKig62tW8P1jg1IJJuSN52O8=",
            "dev": true
        },
        "replace-ext": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/replace-ext/-/replace-ext-1.0.0.tgz",
            "integrity": "sha1-3mMSg3P8v3w8z6TeWkgMRaZ5WOs=",
            "dev": true
        },
        "request": {
            "version": "2.88.0",
            "resolved": "https://registry.npmjs.org/request/-/request-2.88.0.tgz",
            "integrity": "sha512-NAqBSrijGLZdM0WZNsInLJpkJokL72XYjUpnB0iwsRgxh7dB6COrHnTBNwN0E+lHDAJzu7kLAkDeY08z2/A0hg==",
            "dev": true,
            "requires": {
                "aws-sign2": "~0.7.0",
                "aws4": "^1.8.0",
                "caseless": "~0.12.0",
                "combined-stream": "~1.0.6",
                "extend": "~3.0.2",
                "forever-agent": "~0.6.1",
                "form-data": "~2.3.2",
                "har-validator": "~5.1.0",
                "http-signature": "~1.2.0",
                "is-typedarray": "~1.0.0",
                "isstream": "~0.1.2",
                "json-stringify-safe": "~5.0.1",
                "mime-types": "~2.1.19",
                "oauth-sign": "~0.9.0",
                "performance-now": "^2.1.0",
                "qs": "~6.5.2",
                "safe-buffer": "^5.1.2",
                "tough-cookie": "~2.4.3",
                "tunnel-agent": "^0.6.0",
                "uuid": "^3.3.2"
            }
        },
        "requires-port": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/requires-port/-/requires-port-1.0.0.tgz",
            "integrity": "sha1-kl0mAdOaxIXgkc8NpcbmlNw9yv8=",
            "dev": true
        },
        "resolve": {
            "version": "1.9.0",
            "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.9.0.tgz",
            "integrity": "sha512-TZNye00tI67lwYvzxCxHGjwTNlUV70io54/Ed4j6PscB8xVfuBJpRenI/o6dVk0cY0PYTY27AgCoGGxRnYuItQ==",
            "dev": true,
            "requires": {
                "path-parse": "^1.0.6"
            }
        },
        "resolve-options": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/resolve-options/-/resolve-options-1.1.0.tgz",
            "integrity": "sha1-MrueOcBtZzONyTeMDW1gdFZq0TE=",
            "dev": true,
            "requires": {
                "value-or-function": "^3.0.0"
            }
        },
        "rimraf": {
            "version": "2.6.3",
            "resolved": "https://registry.npmjs.org/rimraf/-/rimraf-2.6.3.tgz",
            "integrity": "sha512-mwqeW5XsA2qAejG46gYdENaxXjx9onRNCfn7L0duuP4hCuTIi/QO7PDK07KJfp1d+izWPrzEJDcSqBa0OZQriA==",
            "dev": true,
            "requires": {
                "glob": "^7.1.3"
            },
            "dependencies": {
                "glob": {
                    "version": "7.1.3",
                    "resolved": "https://registry.npmjs.org/glob/-/glob-7.1.3.tgz",
                    "integrity": "sha512-vcfuiIxogLV4DlGBHIUOwI0IbrJ8HWPc4MU7HzviGeNho/UJDfi6B5p3sHeWIQ0KGIU0Jpxi5ZHxemQfLkkAwQ==",
                    "dev": true,
                    "requires": {
                        "fs.realpath": "^1.0.0",
                        "inflight": "^1.0.4",
                        "inherits": "2",
                        "minimatch": "^3.0.4",
                        "once": "^1.3.0",
                        "path-is-absolute": "^1.0.0"
                    }
                },
                "minimatch": {
                    "version": "3.0.4",
                    "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.0.4.tgz",
                    "integrity": "sha512-yJHVQEhyqPLUTgt9B83PXu6W3rx4MvvHvSUvToogpwoGDOUQ+yDrR0HRot+yOCdCO7u4hX3pWft6kWBBcqh0UA==",
                    "dev": true,
                    "requires": {
                        "brace-expansion": "^1.1.7"
                    }
                }
            }
        },
        "safe-buffer": {
            "version": "5.1.2",
            "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.1.2.tgz",
            "integrity": "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==",
            "dev": true
        },
        "safer-buffer": {
            "version": "2.1.2",
            "resolved": "https://registry.npmjs.org/safer-buffer/-/safer-buffer-2.1.2.tgz",
            "integrity": "sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==",
            "dev": true
        },
        "semver": {
            "version": "5.6.0",
            "resolved": "https://registry.npmjs.org/semver/-/semver-5.6.0.tgz",
            "integrity": "sha512-RS9R6R35NYgQn++fkDWaOmqGoj4Ek9gGs+DPxNUZKuwE183xjJroKvyo1IzVFeXvUrvmALy6FWD5xrdJT25gMg==",
            "dev": true
        },
        "sigmund": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/sigmund/-/sigmund-1.0.1.tgz",
            "integrity": "sha1-P/IfGYytIXX587eBhT/ZTQ0ZtZA=",
            "dev": true
        },
        "source-map": {
            "version": "0.6.1",
            "resolved": "https://registry.npmjs.org/source-map/-/source-map-0.6.1.tgz",
            "integrity": "sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==",
            "dev": true
        },
        "source-map-support": {
            "version": "0.5.10",
            "resolved": "https://registry.npmjs.org/source-map-support/-/source-map-support-0.5.10.tgz",
            "integrity": "sha512-YfQ3tQFTK/yzlGJuX8pTwa4tifQj4QS2Mj7UegOu8jAz59MqIiMGPXxQhVQiIMNzayuUSF/jEuVnfFF5JqybmQ==",
            "dev": true,
            "requires": {
                "buffer-from": "^1.0.0",
                "source-map": "^0.6.0"
            }
        },
        "split": {
            "version": "0.3.3",
            "resolved": "https://registry.npmjs.org/split/-/split-0.3.3.tgz",
            "integrity": "sha1-zQ7qXmOiEd//frDwkcQTPi0N0o8=",
            "dev": true,
            "requires": {
                "through": "2"
            }
        },
        "sprintf-js": {
            "version": "1.0.3",
            "resolved": "https://registry.npmjs.org/sprintf-js/-/sprintf-js-1.0.3.tgz",
            "integrity": "sha1-BOaSb2YolTVPPdAVIDYzuFcpfiw=",
            "dev": true
        },
        "sshpk": {
            "version": "1.16.0",
            "resolved": "https://registry.npmjs.org/sshpk/-/sshpk-1.16.0.tgz",
            "integrity": "sha512-Zhev35/y7hRMcID/upReIvRse+I9SVhyVre/KTJSJQWMz3C3+G+HpO7m1wK/yckEtujKZ7dS4hkVxAnmHaIGVQ==",
            "dev": true,
            "requires": {
                "asn1": "~0.2.3",
                "assert-plus": "^1.0.0",
                "bcrypt-pbkdf": "^1.0.0",
                "dashdash": "^1.12.0",
                "ecc-jsbn": "~0.1.1",
                "getpass": "^0.1.1",
                "jsbn": "~0.1.0",
                "safer-buffer": "^2.0.2",
                "tweetnacl": "~0.14.0"
            }
        },
        "stat-mode": {
            "version": "0.2.2",
            "resolved": "https://registry.npmjs.org/stat-mode/-/stat-mode-0.2.2.tgz",
            "integrity": "sha1-5sgLYjEj19gM8TLOU480YokHJQI=",
            "dev": true
        },
        "stream-combiner": {
            "version": "0.0.4",
            "resolved": "https://registry.npmjs.org/stream-combiner/-/stream-combiner-0.0.4.tgz",
            "integrity": "sha1-TV5DPBhSYd3mI8o/RMWGvPXErRQ=",
            "dev": true,
            "requires": {
                "duplexer": "~0.1.1"
            }
        },
        "stream-shift": {
            "version": "1.0.0",
            "resolved": "https://registry.npmjs.org/stream-shift/-/stream-shift-1.0.0.tgz",
            "integrity": "sha1-1cdSgl5TZ+eG944Y5EXqIjoVWVI=",
            "dev": true
        },
        "streamfilter": {
            "version": "1.0.7",
            "resolved": "https://registry.npmjs.org/streamfilter/-/streamfilter-1.0.7.tgz",
            "integrity": "sha512-Gk6KZM+yNA1JpW0KzlZIhjo3EaBJDkYfXtYSbOwNIQ7Zd6006E6+sCFlW1NDvFG/vnXhKmw6TJJgiEQg/8lXfQ==",
            "dev": true,
            "requires": {
                "readable-stream": "^2.0.2"
            }
        },
        "streamifier": {
            "version": "0.1.1",
            "resolved": "https://registry.npmjs.org/streamifier/-/streamifier-0.1.1.tgz",
            "integrity": "sha1-l+mNj6TRBdYqJpHR3AfoINuN/E8=",
            "dev": true
        },
        "string_decoder": {
            "version": "1.1.1",
            "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.1.1.tgz",
            "integrity": "sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==",
            "dev": true,
            "requires": {
                "safe-buffer": "~5.1.0"
            }
        },
        "strip-ansi": {
            "version": "4.0.0",
            "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-4.0.0.tgz",
            "integrity": "sha1-qEeQIusaw2iocTibY1JixQXuNo8=",
            "dev": true,
            "requires": {
                "ansi-regex": "^3.0.0"
            }
        },
        "supports-color": {
            "version": "1.2.0",
            "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-1.2.0.tgz",
            "integrity": "sha1-/x7R5hFp0Gs88tWI4YixjYhH4X4=",
            "dev": true
        },
        "tar": {
            "version": "2.2.1",
            "resolved": "https://registry.npmjs.org/tar/-/tar-2.2.1.tgz",
            "integrity": "sha1-jk0qJWwOIYXGsYrWlK7JaLg8sdE=",
            "dev": true,
            "requires": {
                "block-stream": "*",
                "fstream": "^1.0.2",
                "inherits": "2"
            }
        },
        "through": {
            "version": "2.3.8",
            "resolved": "https://registry.npmjs.org/through/-/through-2.3.8.tgz",
            "integrity": "sha1-DdTJ/6q8NXlgsbckEV1+Doai4fU=",
            "dev": true
        },
        "through2": {
            "version": "2.0.5",
            "resolved": "https://registry.npmjs.org/through2/-/through2-2.0.5.tgz",
            "integrity": "sha512-/mrRod8xqpA+IHSLyGCQ2s8SPHiCDEeQJSep1jqLYeEUClOFG2Qsh+4FU6G9VeqpZnGW/Su8LQGc4YKni5rYSQ==",
            "dev": true,
            "requires": {
                "readable-stream": "~2.3.6",
                "xtend": "~4.0.1"
            }
        },
        "through2-filter": {
            "version": "3.0.0",
            "resolved": "https://registry.npmjs.org/through2-filter/-/through2-filter-3.0.0.tgz",
            "integrity": "sha512-jaRjI2WxN3W1V8/FMZ9HKIBXixtiqs3SQSX4/YGIiP3gL6djW48VoZq9tDqeCWs3MT8YY5wb/zli8VW8snY1CA==",
            "dev": true,
            "requires": {
                "through2": "~2.0.0",
                "xtend": "~4.0.0"
            }
        },
        "to-absolute-glob": {
            "version": "2.0.2",
            "resolved": "https://registry.npmjs.org/to-absolute-glob/-/to-absolute-glob-2.0.2.tgz",
            "integrity": "sha1-GGX0PZ50sIItufFFt4z/fQ98hJs=",
            "dev": true,
            "requires": {
                "is-absolute": "^1.0.0",
                "is-negated-glob": "^1.0.0"
            }
        },
        "to-iso-string": {
            "version": "0.0.2",
            "resolved": "https://registry.npmjs.org/to-iso-string/-/to-iso-string-0.0.2.tgz",
            "integrity": "sha1-TcGeZk38y+Jb2NtQiwDG2hWCVdE=",
            "dev": true
        },
        "to-through": {
            "version": "2.0.0",
            "resolved": "https://registry.npmjs.org/to-through/-/to-through-2.0.0.tgz",
            "integrity": "sha1-/JKtq6ByZHvAtn1rA2ZKoZUJOvY=",
            "dev": true,
            "requires": {
                "through2": "^2.0.3"
            }
        },
        "tough-cookie": {
            "version": "2.4.3",
            "resolved": "https://registry.npmjs.org/tough-cookie/-/tough-cookie-2.4.3.tgz",
            "integrity": "sha512-Q5srk/4vDM54WJsJio3XNn6K2sCG+CQ8G5Wz6bZhRZoAe/+TxjWB/GlFAnYEbkYVlON9FMk/fE3h2RLpPXo4lQ==",
            "dev": true,
            "requires": {
                "psl": "^1.1.24",
                "punycode": "^1.4.1"
            },
            "dependencies": {
                "punycode": {
                    "version": "1.4.1",
                    "resolved": "https://registry.npmjs.org/punycode/-/punycode-1.4.1.tgz",
                    "integrity": "sha1-wNWmOycYgArY4esPpSachN1BhF4=",
                    "dev": true
                }
            }
        },
        "tslib": {
            "version": "1.9.3",
            "resolved": "https://registry.npmjs.org/tslib/-/tslib-1.9.3.tgz",
            "integrity": "sha512-4krF8scpejhaOgqzBEcGM7yDIEfi0/8+8zDRZhNZZ2kjmHJ4hv3zCbQWxoJGz1iw5U0Jl0nma13xzHXcncMavQ==",
            "dev": true
        },
        "tslint": {
            "version": "5.12.1",
            "resolved": "https://registry.npmjs.org/tslint/-/tslint-5.12.1.tgz",
            "integrity": "sha512-sfodBHOucFg6egff8d1BvuofoOQ/nOeYNfbp7LDlKBcLNrL3lmS5zoiDGyOMdT7YsEXAwWpTdAHwOGOc8eRZAw==",
            "dev": true,
            "requires": {
                "babel-code-frame": "^6.22.0",
                "builtin-modules": "^1.1.1",
                "chalk": "^2.3.0",
                "commander": "^2.12.1",
                "diff": "^3.2.0",
                "glob": "^7.1.1",
                "js-yaml": "^3.7.0",
                "minimatch": "^3.0.4",
                "resolve": "^1.3.2",
                "semver": "^5.3.0",
                "tslib": "^1.8.0",
                "tsutils": "^2.27.2"
            },
            "dependencies": {
                "commander": {
                    "version": "2.19.0",
                    "resolved": "https://registry.npmjs.org/commander/-/commander-2.19.0.tgz",
                    "integrity": "sha512-6tvAOO+D6OENvRAh524Dh9jcfKTYDQAqvqezbCW82xj5X0pSrcpxtvRKHLG0yBY6SD7PSDrJaj+0AiOcKVd1Xg==",
                    "dev": true
                },
                "diff": {
                    "version": "3.5.0",
                    "resolved": "https://registry.npmjs.org/diff/-/diff-3.5.0.tgz",
                    "integrity": "sha512-A46qtFgd+g7pDZinpnwiRJtxbC1hpgf0uzP3iG89scHk0AUC7A1TGxf5OiiOUv/JMZR8GOt8hL900hV0bOy5xA==",
                    "dev": true
                },
                "glob": {
                    "version": "7.1.3",
                    "resolved": "https://registry.npmjs.org/glob/-/glob-7.1.3.tgz",
                    "integrity": "sha512-vcfuiIxogLV4DlGBHIUOwI0IbrJ8HWPc4MU7HzviGeNho/UJDfi6B5p3sHeWIQ0KGIU0Jpxi5ZHxemQfLkkAwQ==",
                    "dev": true,
                    "requires": {
                        "fs.realpath": "^1.0.0",
                        "inflight": "^1.0.4",
                        "inherits": "2",
                        "minimatch": "^3.0.4",
                        "once": "^1.3.0",
                        "path-is-absolute": "^1.0.0"
                    }
                },
                "minimatch": {
                    "version": "3.0.4",
                    "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.0.4.tgz",
                    "integrity": "sha512-yJHVQEhyqPLUTgt9B83PXu6W3rx4MvvHvSUvToogpwoGDOUQ+yDrR0HRot+yOCdCO7u4hX3pWft6kWBBcqh0UA==",
                    "dev": true,
                    "requires": {
                        "brace-expansion": "^1.1.7"
                    }
                }
            }
        },
        "tslint-microsoft-contrib": {
            "version": "5.0.1",
            "resolved": "https://registry.npmjs.org/tslint-microsoft-contrib/-/tslint-microsoft-contrib-5.0.1.tgz",
            "integrity": "sha1-Mo7pwo0HzfeTKTIEyW4v+rkiGZQ=",
            "dev": true,
            "requires": {
                "tsutils": "^1.4.0"
            },
            "dependencies": {
                "tsutils": {
                    "version": "1.9.1",
                    "resolved": "https://registry.npmjs.org/tsutils/-/tsutils-1.9.1.tgz",
                    "integrity": "sha1-ufmrROVa+WgYMdXyjQrur1x1DLA=",
                    "dev": true
                }
            }
        },
        "tsutils": {
            "version": "2.29.0",
            "resolved": "https://registry.npmjs.org/tsutils/-/tsutils-2.29.0.tgz",
            "integrity": "sha512-g5JVHCIJwzfISaXpXE1qvNalca5Jwob6FjI4AoPlqMusJ6ftFE7IkkFoMhVLRgK+4Kx3gkzb8UZK5t5yTTvEmA==",
            "dev": true,
            "requires": {
                "tslib": "^1.8.1"
            }
        },
        "tunnel-agent": {
            "version": "0.6.0",
            "resolved": "https://registry.npmjs.org/tunnel-agent/-/tunnel-agent-0.6.0.tgz",
            "integrity": "sha1-J6XeoGs2sEoKmWZ3SykIaPD8QP0=",
            "dev": true,
            "requires": {
                "safe-buffer": "^5.0.1"
            }
        },
        "tweetnacl": {
            "version": "0.14.5",
            "resolved": "https://registry.npmjs.org/tweetnacl/-/tweetnacl-0.14.5.tgz",
            "integrity": "sha1-WuaBd/GS1EViadEIr6k/+HQ/T2Q=",
            "dev": true
        },
        "typescript": {
            "version": "2.9.2",
            "resolved": "https://registry.npmjs.org/typescript/-/typescript-2.9.2.tgz",
            "integrity": "sha512-Gr4p6nFNaoufRIY4NMdpQRNmgxVIGMs4Fcu/ujdYk3nAZqk7supzBE9idmvfZIlH/Cuj//dvi+019qEue9lV0w==",
            "dev": true
        },
        "unc-path-regex": {
            "version": "0.1.2",
            "resolved": "https://registry.npmjs.org/unc-path-regex/-/unc-path-regex-0.1.2.tgz",
            "integrity": "sha1-5z3T17DXxe2G+6xrCufYxqadUPo=",
            "dev": true
        },
        "unique-stream": {
            "version": "2.3.1",
            "resolved": "https://registry.npmjs.org/unique-stream/-/unique-stream-2.3.1.tgz",
            "integrity": "sha512-2nY4TnBE70yoxHkDli7DMazpWiP7xMdCYqU2nBRO0UB+ZpEkGsSija7MvmvnZFUeC+mrgiUfcHSr3LmRFIg4+A==",
            "dev": true,
            "requires": {
                "json-stable-stringify-without-jsonify": "^1.0.1",
                "through2-filter": "^3.0.0"
            }
        },
        "uri-js": {
            "version": "4.2.2",
            "resolved": "https://registry.npmjs.org/uri-js/-/uri-js-4.2.2.tgz",
            "integrity": "sha512-KY9Frmirql91X2Qgjry0Wd4Y+YTdrdZheS8TFwvkbLWf/G5KNJDCh6pKL5OZctEW4+0Baa5idK2ZQuELRwPznQ==",
            "dev": true,
            "requires": {
                "punycode": "^2.1.0"
            }
        },
        "url-parse": {
            "version": "1.4.4",
            "resolved": "https://registry.npmjs.org/url-parse/-/url-parse-1.4.4.tgz",
            "integrity": "sha512-/92DTTorg4JjktLNLe6GPS2/RvAd/RGr6LuktmWSMLEOa6rjnlrFXNgSbSmkNvCoL2T028A0a1JaJLzRMlFoHg==",
            "dev": true,
            "requires": {
                "querystringify": "^2.0.0",
                "requires-port": "^1.0.0"
            }
        },
        "util-deprecate": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
            "integrity": "sha1-RQ1Nyfpw3nMnYvvS1KKJgUGaDM8=",
            "dev": true
        },
        "uuid": {
            "version": "3.3.2",
            "resolved": "https://registry.npmjs.org/uuid/-/uuid-3.3.2.tgz",
            "integrity": "sha512-yXJmeNaw3DnnKAOKJE51sL/ZaYfWJRl1pK9dr19YFCu0ObS231AB1/LbqTKRAQ5kw8A90rA6fr4riOUpTZvQZA==",
            "dev": true
        },
        "value-or-function": {
            "version": "3.0.0",
            "resolved": "https://registry.npmjs.org/value-or-function/-/value-or-function-3.0.0.tgz",
            "integrity": "sha1-HCQ6ULWVwb5Up1S/7OhWO5/42BM=",
            "dev": true
        },
        "verror": {
            "version": "1.10.0",
            "resolved": "https://registry.npmjs.org/verror/-/verror-1.10.0.tgz",
            "integrity": "sha1-OhBcoXBTr1XW4nDB+CiGguGNpAA=",
            "dev": true,
            "requires": {
                "assert-plus": "^1.0.0",
                "core-util-is": "1.0.2",
                "extsprintf": "^1.2.0"
            }
        },
        "vinyl": {
            "version": "0.4.6",
            "resolved": "https://registry.npmjs.org/vinyl/-/vinyl-0.4.6.tgz",
            "integrity": "sha1-LzVsh6VQolVGHza76ypbqL94SEc=",
            "dev": true,
            "requires": {
                "clone": "^0.2.0",
                "clone-stats": "^0.0.1"
            }
        },
        "vinyl-fs": {
            "version": "3.0.3",
            "resolved": "https://registry.npmjs.org/vinyl-fs/-/vinyl-fs-3.0.3.tgz",
            "integrity": "sha512-vIu34EkyNyJxmP0jscNzWBSygh7VWhqun6RmqVfXePrOwi9lhvRs//dOaGOTRUQr4tx7/zd26Tk5WeSVZitgng==",
            "dev": true,
            "requires": {
                "fs-mkdirp-stream": "^1.0.0",
                "glob-stream": "^6.1.0",
                "graceful-fs": "^4.0.0",
                "is-valid-glob": "^1.0.0",
                "lazystream": "^1.0.0",
                "lead": "^1.0.0",
                "object.assign": "^4.0.4",
                "pumpify": "^1.3.5",
                "readable-stream": "^2.3.3",
                "remove-bom-buffer": "^3.0.0",
                "remove-bom-stream": "^1.2.0",
                "resolve-options": "^1.1.0",
                "through2": "^2.0.0",
                "to-through": "^2.0.0",
                "value-or-function": "^3.0.0",
                "vinyl": "^2.0.0",
                "vinyl-sourcemap": "^1.1.0"
            },
            "dependencies": {
                "clone": {
                    "version": "2.1.2",
                    "resolved": "https://registry.npmjs.org/clone/-/clone-2.1.2.tgz",
                    "integrity": "sha1-G39Ln1kfHo+DZwQBYANFoCiHQ18=",
                    "dev": true
                },
                "clone-stats": {
                    "version": "1.0.0",
                    "resolved": "https://registry.npmjs.org/clone-stats/-/clone-stats-1.0.0.tgz",
                    "integrity": "sha1-s3gt/4u1R04Yuba/D9/ngvh3doA=",
                    "dev": true
                },
                "vinyl": {
                    "version": "2.2.0",
                    "resolved": "https://registry.npmjs.org/vinyl/-/vinyl-2.2.0.tgz",
                    "integrity": "sha512-MBH+yP0kC/GQ5GwBqrTPTzEfiiLjta7hTtvQtbxBgTeSXsmKQRQecjibMbxIXzVT3Y9KJK+drOz1/k+vsu8Nkg==",
                    "dev": true,
                    "requires": {
                        "clone": "^2.1.1",
                        "clone-buffer": "^1.0.0",
                        "clone-stats": "^1.0.0",
                        "cloneable-readable": "^1.0.0",
                        "remove-trailing-separator": "^1.0.1",
                        "replace-ext": "^1.0.0"
                    }
                }
            }
        },
        "vinyl-source-stream": {
            "version": "1.1.2",
            "resolved": "https://registry.npmjs.org/vinyl-source-stream/-/vinyl-source-stream-1.1.2.tgz",
            "integrity": "sha1-YrU6E1YQqJbpjKlr7jqH8Aio54A=",
            "dev": true,
            "requires": {
                "through2": "^2.0.3",
                "vinyl": "^0.4.3"
            }
        },
        "vinyl-sourcemap": {
            "version": "1.1.0",
            "resolved": "https://registry.npmjs.org/vinyl-sourcemap/-/vinyl-sourcemap-1.1.0.tgz",
            "integrity": "sha1-kqgAWTo4cDqM2xHYswCtS+Y7PhY=",
            "dev": true,
            "requires": {
                "append-buffer": "^1.0.2",
                "convert-source-map": "^1.5.0",
                "graceful-fs": "^4.1.6",
                "normalize-path": "^2.1.1",
                "now-and-later": "^2.0.0",
                "remove-bom-buffer": "^3.0.0",
                "vinyl": "^2.0.0"
            },
            "dependencies": {
                "clone": {
                    "version": "2.1.2",
                    "resolved": "https://registry.npmjs.org/clone/-/clone-2.1.2.tgz",
                    "integrity": "sha1-G39Ln1kfHo+DZwQBYANFoCiHQ18=",
                    "dev": true
                },
                "clone-stats": {
                    "version": "1.0.0",
                    "resolved": "https://registry.npmjs.org/clone-stats/-/clone-stats-1.0.0.tgz",
                    "integrity": "sha1-s3gt/4u1R04Yuba/D9/ngvh3doA=",
                    "dev": true
                },
                "vinyl": {
                    "version": "2.2.0",
                    "resolved": "https://registry.npmjs.org/vinyl/-/vinyl-2.2.0.tgz",
                    "integrity": "sha512-MBH+yP0kC/GQ5GwBqrTPTzEfiiLjta7hTtvQtbxBgTeSXsmKQRQecjibMbxIXzVT3Y9KJK+drOz1/k+vsu8Nkg==",
                    "dev": true,
                    "requires": {
                        "clone": "^2.1.1",
                        "clone-buffer": "^1.0.0",
                        "clone-stats": "^1.0.0",
                        "cloneable-readable": "^1.0.0",
                        "remove-trailing-separator": "^1.0.1",
                        "replace-ext": "^1.0.0"
                    }
                }
            }
        },
        "vscode": {
            "version": "1.1.26",
            "resolved": "https://registry.npmjs.org/vscode/-/vscode-1.1.26.tgz",
            "integrity": "sha512-z1Nf5J38gjUFbuDCbJHPN6OJ//5EG+e/yHlh6ERxj/U9B2Qc3aiHaFr38/fee/GGnxvRw/XegLMOG+UJwKi/Qg==",
            "dev": true,
            "requires": {
                "glob": "^7.1.2",
                "gulp-chmod": "^2.0.0",
                "gulp-filter": "^5.0.1",
                "gulp-gunzip": "1.0.0",
                "gulp-remote-src-vscode": "^0.5.1",
                "gulp-untar": "^0.0.7",
                "gulp-vinyl-zip": "^2.1.2",
                "mocha": "^4.0.1",
                "request": "^2.88.0",
                "semver": "^5.4.1",
                "source-map-support": "^0.5.0",
                "url-parse": "^1.4.3",
                "vinyl-fs": "^3.0.3",
                "vinyl-source-stream": "^1.1.0"
            },
            "dependencies": {
                "commander": {
                    "version": "2.11.0",
                    "resolved": "https://registry.npmjs.org/commander/-/commander-2.11.0.tgz",
                    "integrity": "sha512-b0553uYA5YAEGgyYIGYROzKQ7X5RAqedkfjiZxwi0kL1g3bOaBNNZfYkzt/CL0umgD5wc9Jec2FbB98CjkMRvQ==",
                    "dev": true
                },
                "debug": {
                    "version": "3.1.0",
                    "resolved": "https://registry.npmjs.org/debug/-/debug-3.1.0.tgz",
                    "integrity": "sha512-OX8XqP7/1a9cqkxYw2yXss15f26NKWBpDXQd0/uK/KPqdQhxbPa994hnzjcE2VqQpDslf55723cKPUOGSmMY3g==",
                    "dev": true,
                    "requires": {
                        "ms": "2.0.0"
                    }
                },
                "diff": {
                    "version": "3.3.1",
                    "resolved": "https://registry.npmjs.org/diff/-/diff-3.3.1.tgz",
                    "integrity": "sha512-MKPHZDMB0o6yHyDryUOScqZibp914ksXwAMYMTHj6KO8UeKsRYNJD3oNCKjTqZon+V488P7N/HzXF8t7ZR95ww==",
                    "dev": true
                },
                "escape-string-regexp": {
                    "version": "1.0.5",
                    "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-1.0.5.tgz",
                    "integrity": "sha1-G2HAViGQqN/2rjuyzwIAyhMLhtQ=",
                    "dev": true
                },
                "glob": {
                    "version": "7.1.3",
                    "resolved": "https://registry.npmjs.org/glob/-/glob-7.1.3.tgz",
                    "integrity": "sha512-vcfuiIxogLV4DlGBHIUOwI0IbrJ8HWPc4MU7HzviGeNho/UJDfi6B5p3sHeWIQ0KGIU0Jpxi5ZHxemQfLkkAwQ==",
                    "dev": true,
                    "requires": {
                        "fs.realpath": "^1.0.0",
                        "inflight": "^1.0.4",
                        "inherits": "2",
                        "minimatch": "^3.0.4",
                        "once": "^1.3.0",
                        "path-is-absolute": "^1.0.0"
                    }
                },
                "growl": {
                    "version": "1.10.3",
                    "resolved": "https://registry.npmjs.org/growl/-/growl-1.10.3.tgz",
                    "integrity": "sha512-hKlsbA5Vu3xsh1Cg3J7jSmX/WaW6A5oBeqzM88oNbCRQFz+zUaXm6yxS4RVytp1scBoJzSYl4YAEOQIt6O8V1Q==",
                    "dev": true
                },
                "has-flag": {
                    "version": "2.0.0",
                    "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-2.0.0.tgz",
                    "integrity": "sha1-6CB68cx7MNRGzHC3NLXovhj4jVE=",
                    "dev": true
                },
                "minimatch": {
                    "version": "3.0.4",
                    "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.0.4.tgz",
                    "integrity": "sha512-yJHVQEhyqPLUTgt9B83PXu6W3rx4MvvHvSUvToogpwoGDOUQ+yDrR0HRot+yOCdCO7u4hX3pWft6kWBBcqh0UA==",
                    "dev": true,
                    "requires": {
                        "brace-expansion": "^1.1.7"
                    }
                },
                "mocha": {
                    "version": "4.1.0",
                    "resolved": "https://registry.npmjs.org/mocha/-/mocha-4.1.0.tgz",
                    "integrity": "sha512-0RVnjg1HJsXY2YFDoTNzcc1NKhYuXKRrBAG2gDygmJJA136Cs2QlRliZG1mA0ap7cuaT30mw16luAeln+4RiNA==",
                    "dev": true,
                    "requires": {
                        "browser-stdout": "1.3.0",
                        "commander": "2.11.0",
                        "debug": "3.1.0",
                        "diff": "3.3.1",
                        "escape-string-regexp": "1.0.5",
                        "glob": "7.1.2",
                        "growl": "1.10.3",
                        "he": "1.1.1",
                        "mkdirp": "0.5.1",
                        "supports-color": "4.4.0"
                    },
                    "dependencies": {
                        "glob": {
                            "version": "7.1.2",
                            "resolved": "https://registry.npmjs.org/glob/-/glob-7.1.2.tgz",
                            "integrity": "sha512-MJTUg1kjuLeQCJ+ccE4Vpa6kKVXkPYJ2mOCQyUuKLcLQsdrMCpBPUi8qVE6+YuaJkozeA9NusTAw3hLr8Xe5EQ==",
                            "dev": true,
                            "requires": {
                                "fs.realpath": "^1.0.0",
                                "inflight": "^1.0.4",
                                "inherits": "2",
                                "minimatch": "^3.0.4",
                                "once": "^1.3.0",
                                "path-is-absolute": "^1.0.0"
                            }
                        }
                    }
                },
                "ms": {
                    "version": "2.0.0",
                    "resolved": "https://registry.npmjs.org/ms/-/ms-2.0.0.tgz",
                    "integrity": "sha1-VgiurfwAvmwpAd9fmGF4jeDVl8g=",
                    "dev": true
                },
                "supports-color": {
                    "version": "4.4.0",
                    "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-4.4.0.tgz",
                    "integrity": "sha512-rKC3+DyXWgK0ZLKwmRsrkyHVZAjNkfzeehuFWdGGcqGDTZFH73+RH6S/RDAAxl9GusSjZSUWYLmT9N5pzXFOXQ==",
                    "dev": true,
                    "requires": {
                        "has-flag": "^2.0.0"
                    }
                }
            }
        },
        "wrappy": {
            "version": "1.0.2",
            "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
            "integrity": "sha1-tSQ9jz7BqjXxNkYFvA0QNuMKtp8=",
            "dev": true
        },
        "xml": {
            "version": "1.0.1",
            "resolved": "https://registry.npmjs.org/xml/-/xml-1.0.1.tgz",
            "integrity": "sha1-eLpyAgApxbyHuKgaPPzXS0ovweU=",
            "dev": true
        },
        "xtend": {
            "version": "4.0.1",
            "resolved": "https://registry.npmjs.org/xtend/-/xtend-4.0.1.tgz",
            "integrity": "sha1-pcbVMr5lbiPbgg77lDofBJmNY68=",
            "dev": true
        },
        "yauzl": {
            "version": "2.10.0",
            "resolved": "https://registry.npmjs.org/yauzl/-/yauzl-2.10.0.tgz",
            "integrity": "sha1-x+sXyT4RLLEIb6bY5R+wZnt5pfk=",
            "dev": true,
            "requires": {
                "buffer-crc32": "~0.2.3",
                "fd-slicer": "~1.1.0"
            }
        },
        "yazl": {
            "version": "2.5.1",
            "resolved": "https://registry.npmjs.org/yazl/-/yazl-2.5.1.tgz",
            "integrity": "sha512-phENi2PLiHnHb6QBVot+dJnaAZ0xosj7p3fWl+znIjBDlnMI2PsZCJZ306BPTFOaHf5qdDEI8x5qFrSOBN5vrw==",
            "dev": true,
            "requires": {
                "buffer-crc32": "~0.2.3"
            }
        }
    }
};

suite('getNodeModulesDependencyClosure', () => {
    test('Empty', () => {
        const closure = getNodeModulesDependencyClosure(packageLockJson, []);
        assert.deepStrictEqual(
            closure,
            []
        );
    });

    test('No deps', () => {
        const closure = getNodeModulesDependencyClosure(packageLockJson, ['xtend']);
        assert.deepStrictEqual(
            closure,
            [
                'xtend'
            ]);
    });

    test('Nested deps', () => {
        const closure = getNodeModulesDependencyClosure(packageLockJson, ['yauzl']);
        assert.deepStrictEqual(
            closure,
            [
                'buffer-crc32',
                'fd-slicer',
                'pend',
                'yauzl'
            ]);
    });

    test('Deeply nested deps', () => {
        const closure = getNodeModulesDependencyClosure(packageLockJson, ['remove-bom-stream']);
        assert.deepStrictEqual(
            closure,
            [
                "core-util-is",
                "inherits",
                "is-buffer",
                "is-utf8",
                "isarray",
                "process-nextick-args",
                "readable-stream",
                "remove-bom-buffer",
                "remove-bom-stream",
                "safe-buffer",
                "string_decoder",
                "through2",
                "util-deprecate",
                "xtend"
            ]);
    });

    test('Multiple', () => {
        const closure = getNodeModulesDependencyClosure(packageLockJson, ['xtend', 'yauzl']);
        assert.deepStrictEqual(
            closure,
            [
                'buffer-crc32',
                'fd-slicer',
                'pend',
                "xtend",
                'yauzl'
            ]);
    });
});

suite('getExternalsEntries', () => {
    test('test', () => {
        const entries = getExternalsEntries(['abc', 'def-ghi']);
        assert.deepStrictEqual(
            entries,
            {
                'abc': 'commonjs abc',
                'def-ghi': 'commonjs def-ghi'
            }
        );
    });
});

suite('getNodeModuleCopyEntries', () => {
    test('test', () => {
        const entries = getNodeModuleCopyEntries(['abc', 'def-ghi']);
        assert.deepStrictEqual(
            entries,
            [
                {
                    from: './node_modules/abc',
                    to: 'node_modules/abc/'
                },
                {
                    from: './node_modules/def-ghi',
                    to: 'node_modules/def-ghi/'
                }]
        );
    });
});

suite('excludeNodeModulesAndDependencies', () => {
    test('config empty', () => {
        const config: Configuration = {};
        excludeNodeModulesAndDependencies(config, packageLockJson, ['yauzl']);

        assert.deepStrictEqual(
            config.externals,
            {
                "buffer-crc32": "commonjs buffer-crc32",
                "fd-slicer": "commonjs fd-slicer",
                "pend": "commonjs pend",
                "yauzl": "commonjs yauzl"
            }
        );

        assert.equal(config.plugins && config.plugins.length, 1);
    });

    test('config already has entries', () => {
        const config: Configuration = {
            externals: {
                previous: 'commonjs previous'
            },
            plugins: [
                new copyWebpackPlugin()
            ]
        };
        excludeNodeModulesAndDependencies(config, packageLockJson, ['yauzl']);

        assert.deepStrictEqual(
            config.externals,
            {
                "buffer-crc32": "commonjs buffer-crc32",
                "fd-slicer": "commonjs fd-slicer",
                "pend": "commonjs pend",
                "previous": "commonjs previous",
                "yauzl": "commonjs yauzl"
            }
        );

        assert.equal(config.plugins && config.plugins.length, 2);
    });
});
