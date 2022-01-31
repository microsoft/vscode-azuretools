module.exports = {
    "extends": "@microsoft/eslint-config-azuretools",
    parserOptions: {
        project: "tsconfig.json",
        tsconfigRootDir: __dirname,
        sourceType: "module",
    }
};
