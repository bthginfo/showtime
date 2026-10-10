import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
export default ts.config(
 {ignores:['node_modules/**','.local/**','.svelte-kit/**','.vercel/**','drizzle/**','static/**','public/**','artifacts/**','test-results/**','playwright-report/**','coverage/**']},
 ...ts.configs.recommended,...svelte.configs['flat/recommended'],
 {files:['**/*.svelte'],languageOptions:{parserOptions:{parser:ts.parser}}},
 {rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':'off','@typescript-eslint/no-empty-object-type':'off','@typescript-eslint/no-empty-function':'off','@typescript-eslint/no-unused-expressions':'off','@typescript-eslint/no-require-imports':'off','svelte/no-at-html-tags':'off','svelte/require-each-key':'off',
 // Root-relative application links and explicit whitespace preserve the original UI.
 'svelte/no-navigation-without-resolve':'off','svelte/no-useless-mustaches':'off','svelte/no-immutable-reactive-statements':'off'}}
);
