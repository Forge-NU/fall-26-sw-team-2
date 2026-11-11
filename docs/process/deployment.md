# Deployment (AWS staging)

The API runs on AWS in one **staging** environment, which the team's phones and demos
use. Everything is defined with the AWS CDK in [`infra/`](../../infra), and merging to
`main` deploys it. The mobile app isn't covered here; see
[release-process.md](../release-process.md).

## What's running

```
phone / Expo Go ──HTTPS──▶ CloudFront ──HTTP──▶ load balancer ──▶ Fargate task (API)
                                                                      │        │
                                                     S3 media bucket ◀┘        └▶ RDS Postgres
EventBridge Scheduler (hourly) ──▶ Fargate task (stories cleanup) ──▶ same bucket and database
```

The stacks (`infra/lib/`):

| Stack | What's in it | Deployed by |
|---|---|---|
| `YujiStagingData` | VPC, media bucket `yuji-media-<account>`, Postgres (`db.t4g.micro`), the database and Clerk secrets | Hand only. It has termination protection. |
| `YujiStagingApi` | ECS cluster and service, load balancer, CloudFront, the hourly cleanup schedule | CI on every merge to `main` |
| `YujiCi` | `yuji-github-deploy`, the IAM user GitHub Actions deploys as. It can only assume CDK's deploy roles. | Hand only |
| `YujiBudget` (optional) | A monthly cost alert email. Not deployed on staging, where the budget was made in the console. | Hand only, with `-c yuji:budgetEmail=...` |

- **The API URL** is the `ApiUrl` output of `YujiStagingApi`, an `https://….cloudfront.net` address.
  CloudFront gives us HTTPS without owning a domain, and caches nothing.
- **There's no NAT gateway.** The API tasks run in public subnets with public IPs, but
  their security group only accepts traffic from the load balancer, and the load
  balancer only accepts CloudFront. The database is in isolated subnets with no internet
  route, and only the API's security group can reach it.
- **Secrets** come from Secrets Manager into the task as environment variables. Nothing
  secret is in the repo or in plain text in the task definition. The image's entrypoint
  builds `DATABASE_URL` from the `DB_*` values (`apps/api/docker/entrypoint.sh`).
- **Migrations** run when each new API task starts (`apps/api/docker/start.sh`), before the
  server listens. Prisma holds a lock while migrating, so two tasks never apply the same
  one. If a migration fails, the task exits, never gets healthy, and ECS rolls the
  deployment back to the previous version. Review migrations carefully, because a
  migration that half-applied before failing has to be fixed by hand.

## Cost

Rough us-east-2 prices at demo-level traffic:

| Piece | ≈ per month |
|---|---|
| Load balancer | $18–22 |
| Postgres `db.t4g.micro`, 20 GB | $14 |
| Fargate, 0.25 vCPU / 0.5 GB, always on | $8 |
| Public IPv4 addresses (load balancer and task) | $11 |
| Secrets Manager (2 secrets) | $1 |
| CloudFront, S3, ECR, logs, cleanup task | ~$1–2 |
| **Total** | **≈ $50** |

To pause between demos: scale the service to 0
(`aws ecs update-service --cluster <ClusterName> --service <ServiceName> --desired-count 0`)
and stop the database in the RDS console. A stopped database starts itself again after
7 days, and the load balancer and IP addresses keep charging while paused. The next CI
deploy sets the service back to 1 task.

## Day to day

- **Deploying:** merge to `main`. The **Deploy API** workflow (`.github/workflows/deploy-api.yml`)
  builds the image, deploys `YujiStagingApi`, and checks `/api/health`. You can also run it
  from the Actions tab.
- **Logs:** CloudWatch log groups starting with `YujiStagingApi-ApiLogs` and
  `YujiStagingApi-StoriesCleanupLogs` (two weeks of history).
- **A shell in the running API:** ECS Exec is on:
  `aws ecs execute-command --cluster <ClusterName> --task <task id> --container api --interactive --command sh`.
- **Rolling back:** revert the PR. The revert's deploy puts the old code back. A
  migration that already ran stays applied, so a revert that needs the old schema needs
  a new migration.
- **Changing infrastructure:** edit `infra/lib/`, run `npm test -w infra`, then
  `npx cdk diff --profile yuji` from `infra/`. Changes to `YujiStagingApi` deploy on
  merge. Changes to `YujiStagingData` or `YujiCi` need a hand deploy after merging. Renaming a
  construct ID in the data stack replaces that resource (for example, a new empty
  database), so check the diff for `[-]` and `replace` before deploying.

## First-time setup

Done once per AWS account. Commands run from `infra/`.

The Yuji account (`345075859588`, us-east-2) is a project in AWS's new sign-up experience.
Team members don't have IAM users: the project owner invites you from
https://settings.aws.com, you sign in there with your own login, and you get the project's
`AccountFullAccessRole`. The project's spend limit, set in AWS Settings, pauses it when
reached.

1. **Sign in.** Sign in at https://settings.aws.com, open the Yuji project's console, then
   run `aws configure set region us-east-2 --profile yuji` and `aws login --profile yuji`,
   choosing that console session. Sessions last up to 12 hours; run `aws login` again after.
   Check with `aws sts get-caller-identity --profile yuji`.
2. **Account ID.** `yuji:account` in `infra/cdk.json` is the account ID. CDK refuses to
   deploy if your credentials are for a different account.
3. **Bootstrap CDK** (creates the bucket and roles CDK deploys with):
   `npx cdk bootstrap aws://345075859588/us-east-2 --profile yuji`
4. **Check the Postgres version** RDS offers, and update `POSTGRES_FULL_VERSION` in
   `infra/lib/config.ts` (and the docker-compose and CI images) if 18.6 isn't listed:
   `aws rds describe-db-engine-versions --engine postgres --query "DBEngineVersions[?starts_with(EngineVersion,'18')].EngineVersion" --profile yuji`
5. **Synth once and commit `infra/cdk.context.json`**, which caches the CloudFront
   prefix list lookup so CI can synth without AWS credentials: `npx cdk synth --profile yuji`.
6. **Deploy the data and CI stacks:**
   `npx cdk deploy YujiStagingData YujiCi --profile yuji`.
   Then create a monthly cost budget with email alerts. We made ours ($40) from the
   **Explore AWS** widget on Console Home, which also earns a Free Tier credit. Without the
   credit, `npx cdk deploy YujiBudget -c yuji:budgetEmail=<email> --profile yuji` does the same.
7. **Fill in the Clerk secret.** In the Secrets Manager console, open `yuji/staging/clerk`,
   choose **Retrieve secret value → Edit**, and replace the three `replace-me` values with
   the Clerk **development** instance's keys (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`).
   Leave `CLERK_WEBHOOK_SIGNING_SECRET` for step 9.
8. **Deploy the API:** `npx cdk deploy YujiStagingApi --profile yuji`. The first deploy
   builds the image on your machine (Docker must be running) and creates the database
   tables. Note the `ApiUrl` output, then check `<ApiUrl>/api/health`.
9. **Clerk webhook.** In the Clerk dashboard (Webhooks → Add endpoint), add
   `<ApiUrl>/api/webhooks/clerk` with the `user.created`, `user.updated` and
   `user.deleted` events. Copy its signing secret into `CLERK_WEBHOOK_SIGNING_SECRET` in
   the Clerk secret, then restart the API so it reads the new value:
   `aws ecs update-service --cluster <ClusterName> --service <ServiceName> --force-new-deployment --profile yuji`.
10. **Let CI deploy.** GitHub OIDC would avoid a stored key, but the project's AWS-managed
    guardrails deny creating identity providers, so CI uses the `yuji-github-deploy` IAM user.
    In the IAM console, open **Users → yuji-github-deploy → Security credentials → Create
    access key** (use case: "Third-party service"). In the GitHub repo, Settings → Secrets
    and variables → Actions → **Secrets**, add `AWS_DEPLOY_ACCESS_KEY_ID` and
    `AWS_DEPLOY_SECRET_ACCESS_KEY`. Don't save the key anywhere else. Until the secrets are
    set, the Deploy API workflow skips itself.
11. **Point the app at it.** Set `EXPO_PUBLIC_API_URL` to the `ApiUrl` for the `preview`
    environment on expo.dev, and in your own `apps/mobile/.env` to try it locally.

## Secrets

| Secret | Keys | Filled by |
|---|---|---|
| `yuji/staging/database` | `host`, `port`, `dbname`, `username`, `password` | RDS, automatically |
| `yuji/staging/clerk` | `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` | You, in the console (step 7 and 9) |

Running tasks read secrets when they start, so after changing a value, force a new
deployment (step 9's command). Don't put secret values in `infra/`, workflow files or
PRs.

### The CI access key

The `yuji-github-deploy` key is long-lived, so rotate it every few months and whenever
someone with access to the repo secrets leaves: create a second key, update both GitHub
secrets, check that a deploy works, then deactivate and delete the old key in IAM. If it
leaks, deactivate it in IAM right away. All it can do is run CDK deploys, but a CDK deploy
can change anything in the account.

