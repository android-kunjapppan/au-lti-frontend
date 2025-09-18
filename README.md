# GSV 2025 demo

## General info

Frontend for language buddy, backend is hosted in another repo.

### Libraries

- Pinia: used for state management
- rds-vue-ui: ASUO design system used for the base theme and some asuo components [docs](https://rds-vue-ui.edpl.us/)
- Vueuse: library of with a bunch of super useful composables
- TresJs / three.js: Used for the models

## Setup

### Site

Copy `sample.env` to `.env` then populate the secrets in those files.

Then make sure to install the dependencies:

```bash
# pnpm
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# pnpm
pnpm dev
```

Start the development server and point it to a local server:

```bash
# pnpm
pnpm dev:local
```

## Production

Build the application for production:

```bash
# pnpm
pnpm build
```

## Deployment Variables

### Set in Bitbucket Pipelines

- AWS_OIDC_ROLE_ARN
  - arn of IAM role used for OIDC Authentication
- S3_BUCKET
  - Name of S3 bucket
- DISTRIBUTION_ID
  - Cloudfront distribution ID
- AWS_DEFAULT_REGION
  - us-west-2
- BACKEND_URL
  - Url for the backend service no `https://` or `/` (e.g. nonprod-lb-service.let.edpl.us)
- APP_URL
  - Url for the frontend. no `https://` or `/` (e.g. dev.languagebuddy.asu.edu)
- VITE_CANVAS_URL
  - The URL of Canvas instance where app is running (e.g. https://asu-dev.instructure.com)
- VITE_CLIENT_ID
  - The API Developer Key Client ID (will need to receive from LMS team once they have setup API Developer Key)

## Contribution guidelines

Repo uses conventional commits for commit messages, please install and use [commitizen](https://commitizen.github.io/cz-cli/) for any commits. When working on a new feature, please branch out of develop.

Thanks to husky you should just need to run `git commit` and it should lint your code then open the commitizen cli to enter your commit message.

### Branching

- main - Prod branch
  - nonprod - Staging branch
    - nonprod-qa - dev branch
      - feature/ - new feature, branch out of nonprod-qa
      - fix/ - fix branch out of nonprod-qa

### CSS/ Style

Try to use the rds-vue-ui classes as much as possible for padding, margin, text, etc... It's based on boostrap 6 and the docs are located [here](https://rds-vue-ui.edpl.us/?path=/docs/introduction-contributing--docs).

## Credits

- **Patrick Byrn** - _Lead Engineer_ - [Patrick Byrn](pbyrn@asu.edu)
