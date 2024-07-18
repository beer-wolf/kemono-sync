import globals from "globals";
import pluginJs from "@eslint/js";


export default [
    { languageOptions: { globals: globals.browser, parserOptions: { ecmaVersion: 2023 } } },
    pluginJs.configs.recommended,
];