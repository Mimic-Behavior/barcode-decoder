import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import perfectionist from 'eslint-plugin-perfectionist'
import prettier from 'eslint-plugin-prettier/recommended'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
    {
        extends: ['js/recommended'],
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: { js },
    },
    tseslint.configs.recommended,
    {
        extends: ['json/recommended'],
        files: ['**/*.json'],
        language: 'json/json',
        plugins: { json },
    },
    {
        extends: ['json/recommended'],
        files: ['**/*.jsonc'],
        language: 'json/jsonc',
        plugins: { json },
    },
    {
        extends: ['json/recommended'],
        files: ['**/*.json5'],
        language: 'json/json5',
        plugins: { json },
    },
    {
        extends: ['markdown/recommended'],
        files: ['**/*.md'],
        language: 'markdown/commonmark',
        plugins: { markdown },
    },
    {
        extends: ['css/recommended'],
        files: ['**/*.css'],
        language: 'css/css',
        plugins: { css },
    },
    perfectionist.configs['recommended-alphabetical'],
    prettier,
])
