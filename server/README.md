<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Database seed

From the repo root, prefer:

```bash
$ npm run db:seed
```

From this workspace, use the server-local entrypoint:

```bash
$ npm run db:seed
```

The seed expects the local PostgreSQL service to be running and migrations to
be applied. It loads the P0 demo accounts, the `PYTHON-PROG-P0` Python
Programming course, and an unassigned `HIDDEN-ISOLATION` course. All seeded
accounts use the local-only password `MorshidDemoP0!`.

## P0 auth sessions

The P0 auth API returns both the access token and refresh token in JSON. Clients
send the access token as a `Bearer` token and submit the JSON refresh token to
the refresh/logout endpoints. A later hardening pass should migrate refresh
token transport to HttpOnly cookies.

### Auth environment configuration

Configure these values in `server/.env`. NestJS validates them at startup and
also reads `.env` / `../.env` as fallbacks for local development.

| Variable | Required | Default | Purpose |
|---|---:|---:|---|
| `AUTH_ACCESS_TOKEN_SECRET` | Yes | None | Secret used to sign and verify access JWTs. Use a unique random value with at least 32 characters per environment. |
| `AUTH_REFRESH_TOKEN_HASH_SECRET` | Yes | None | Secret used to HMAC refresh tokens before database storage. Use a different unique random value from the access-token secret. |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | No | `900` | Access-token lifetime in seconds. The default is 15 minutes. |
| `AUTH_REFRESH_TOKEN_TTL_DAYS` | No | `7` | Refresh-token lifetime in days. |

Access tokens are JWTs signed by `@nestjs/jwt` / `jsonwebtoken` with the current
HMAC SHA-256 default (`HS256`) and `AUTH_ACCESS_TOKEN_SECRET`. The token payload
contains `sub` for the user id and `typ: "access"`. Changing
`AUTH_ACCESS_TOKEN_SECRET` invalidates existing access tokens.

Refresh tokens are opaque random values returned once to the client. The server
stores only `HMAC-SHA256(refreshToken, AUTH_REFRESH_TOKEN_HASH_SECRET)` in the
`refresh_tokens.token_hash` column, with `expires_at`, `revoked_at`, and
`replaced_by_token_id` tracking expiry, logout/revocation, and rotation history.
Changing `AUTH_REFRESH_TOKEN_HASH_SECRET` prevents existing refresh tokens from
matching stored hashes, effectively forcing users to sign in again.

On refresh, the submitted refresh token is hashed, the matching active database
record is revoked, a new refresh token record is created, and the old record is
linked to the new one. Reusing the prior token after rotation is rejected as an
invalid refresh token.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
