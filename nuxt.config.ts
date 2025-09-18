// https://nuxt.com/docs/api/configuration/nuxt-config
import * as childProcess from "child_process";
import fs from "node:fs";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import IconsResolver from "unplugin-icons/resolver";
import Icons from "unplugin-icons/vite";
import ViteComponents from "unplugin-vue-components/vite";
import glsl from "vite-plugin-glsl";

let lastCommitHash = "NA";
let packageVersion = 0;
let siteVersion = `${packageVersion} - ${lastCommitHash}`;
let lastShortCommitHash = "";
try {
  const packageJsonFileContent = fs.readFileSync("./package.json", "utf8");
  lastShortCommitHash = childProcess
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();
  lastCommitHash = childProcess
    .execSync("git rev-parse HEAD")
    .toString()
    .trim();
  packageVersion = JSON.parse(packageJsonFileContent).version || 0;
  siteVersion = `${packageVersion} - ${lastShortCommitHash}`;
} catch (e: unknown) {
  console.error(e);
  throw new Error(e as string);
}

export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,
  typescript: {
    typeCheck: true,
    tsConfig: {
      compilerOptions: {
        noImplicitThis: false,
        types: ["vite-plugin-glsl/ext"],
      },
    },
  },
  hooks: {
    "prerender:routes"({ routes }) {
      routes.clear();
    },
  },
  experimental: {
    payloadExtraction: true,
    appManifest: true,
    sharedPrerenderData: false,
  },
  build: {
    transpile: ["@rds-vue-ui"],
  },
  runtimeConfig: {
    public: {
      stage: process.env.APP_ENV || "dev",
      siteVersion: siteVersion,
      signInUrl: process.env.APP_URL
        ? `https://weblogin.asu.edu/cas/login?service=https://auth-main-poc.aiml.asu.edu/app/?aid=g1WGR674bvIeL7bVgfXIAU%26eid=64d2fcdd0845688c5e3e6850da11fe5f%26redirect=https://${process.env.APP_URL}/login/success`
        : `https://weblogin.asu.edu/cas/login?service=https://auth-main-poc.aiml.asu.edu/app/?aid=g1WGR674bvIeL7bVgfXIAU%26eid=64d2fcdd0845688c5e3e6850da11fe5f%26redirect=http://localhost:3000/login/success`,
      // Now coming from environment variables
      wsUrl: process.env.USE_LOCAL_SERVER
        ? "http://localhost:3001"
        : `wss://${process.env.BACKEND_URL}`,
      httpApiUrl: process.env.USE_LOCAL_SERVER
        ? "http://localhost:3001"
        : `https://${process.env.BACKEND_URL}`,
      oAuthRedirectUrl: process.env.USE_LOCAL_SERVER
        ? "http://localhost:3001/oauth/callback"
        : `https://${process.env.BACKEND_URL}/oauth/callback`,
    },
  },
  css: [
    "@rds-vue-ui/rds-theme-base/dist/css/rds-theme-base.css",
    "~/assets/main.scss",
  ],
  components: [
    { path: "~/components" },
    {
      path: "~/node_modules/@rds-vue-ui/",
      ignore: ["**/index.ts", "**/index.js"],
    },
  ],
  modules: [
    "@pinia/nuxt",
    "@nuxt/eslint",
    "@tresjs/nuxt",
    "unplugin-icons/nuxt",
  ],
  // tres: {
  //   glsl: true,
  // },
  sourcemap: { client: "hidden" },
  vite: {
    build: {
      sourcemap: "hidden",
    },
    plugins: [
      glsl(),
      ViteComponents({
        resolvers: [
          IconsResolver({
            prefix: "i",
            customCollections: ["custom"],
          }),
        ],
      }),
      Icons({
        // compiler: "vue3",
        customCollections: {
          custom: FileSystemIconLoader("assets/custom"),
        },
      }),
    ],
  },
  vue: {},
  app: {
    head: {
      // Update to only apply to dev
      title: "language buddy | ASU Online",
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.png" },
        {
          href: "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap",
          rel: "stylesheet",
          prefetch: "true",
        },
      ],
      meta: [
        {
          name: "description",
          content: "Add desc. here.",
        },
        { name: "viewport", content: "width=device-width,initial-scale=1" },
        { name: "theme-color", content: "#191919" },
        { name: "apple-touch-icon", content: "apple-touch-icon" },
        {
          name: "robots",
          content: "noindex",
        },
        {
          name: "robots",
          content: "nofollow",
        },
      ],
      script: [
        {
          type: "text/javascript",
          innerHTML: `// Google Tag Manager 
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${process.env.APP_GTM_ID}');
`,
        },
      ],
      noscript: [
        {
          innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${process.env.APP_GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
        },
      ],
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
    },
  },
  compatibilityDate: "2024-08-05",
});
