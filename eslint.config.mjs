// @ts-check
import eslintConfigPrettier from "eslint-config-prettier";
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  [
    {
      rules: {
        "vue/no-v-html": 0,
        "vue/attributes-order": 0,
        "no-unused-vars": 0,
        "vue/no-unused-vars": 0,
        "@typescript-eslint/no-unused-vars": 0,
        "vue/require-default-prop": 0,
        "no-useless-escape": 0,
        "@typescript-eslint/no-empty-object-type": 0,
      },
    },
    eslintConfigPrettier,
  ]
  // Your custom configs here
);
