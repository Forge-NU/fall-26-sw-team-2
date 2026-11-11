import { App, Tags } from 'aws-cdk-lib';
import { ApiStack } from './api-stack';
import { BudgetStack } from './budget-stack';
import { CiStack } from './ci-stack';
import { DataStack } from './data-stack';

// Builds every Yuji stack. The account comes from cdk.json (yuji:account), and
// CDK refuses to deploy when your credentials are for a different account, so
// nothing lands in another project's account by mistake.
export function createStacks(app: App) {
  const account = app.node.tryGetContext('yuji:account') as string | undefined;
  if (!account || !/^\d{12}$/.test(account)) {
    throw new Error(
      'Set "yuji:account" in infra/cdk.json to the 12-digit Yuji AWS account ID (see docs/process/deployment.md).',
    );
  }
  const region = (app.node.tryGetContext('yuji:region') as string | undefined) ?? 'us-east-2';
  const env = { account, region };

  Tags.of(app).add('project', 'yuji');
  Tags.of(app).add('environment', 'staging');

  const data = new DataStack(app, 'YujiStagingData', {
    env,
    description: 'Yuji staging network, media bucket, database and secrets',
  });
  const api = new ApiStack(app, 'YujiStagingApi', {
    env,
    description: 'Yuji staging API on Fargate behind CloudFront, and the stories cleanup schedule',
    vpc: data.vpc,
    database: data.database,
    mediaBucket: data.mediaBucket,
    databaseSecret: data.databaseSecret,
    clerkSecret: data.clerkSecret,
    corsOriginPattern: app.node.tryGetContext('yuji:corsOriginPattern') as string | undefined,
  });
  const ci = new CiStack(app, 'YujiCi', {
    env,
    description: 'GitHub Actions deploy user for the Yuji staging API',
  });

  const budgetEmail = app.node.tryGetContext('yuji:budgetEmail') as string | undefined;
  const budget = budgetEmail
    ? new BudgetStack(app, 'YujiBudget', {
        env,
        description: 'Monthly cost alert for the Yuji account',
        email: budgetEmail,
        monthlyLimitUsd: Number(app.node.tryGetContext('yuji:budgetUsd') ?? 40),
      })
    : undefined;

  return { data, api, ci, budget };
}
