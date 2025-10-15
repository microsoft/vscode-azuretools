module.exports = {
    "extends": "@microsoft/eslint-config-azuretools",
    "rules": {
        "@typescript-eslint/no-restricted-imports": ["error", {
            "patterns": [
                {
                    "group": ["@azure/*", "!@azure/ms-rest-azure-env"],
                    "message": "lazy",
                    "allowTypeImports": true
                }
            ]
        }]
    }
};
