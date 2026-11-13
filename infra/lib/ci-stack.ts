import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

// The identity the Deploy API workflow (.github/workflows/deploy-api.yml) uses.
//
// GitHub OIDC would avoid a stored key, but the AWS-managed guardrails on
// new-experience projects deny creating identity providers (iam:*Provider*), so
// this is an IAM user instead. It can do one thing: assume the CDK bootstrap roles
// that `cdk deploy` uses. Its access key is created by hand in the IAM console and
// stored only in GitHub secrets, never in this repo or in CloudFormation.
// See docs/process/deployment.md.
export class CiStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const user = new iam.User(this, 'GithubDeployUser', {
      userName: 'yuji-github-deploy',
    });
    user.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
      }),
    );

    new CfnOutput(this, 'DeployUserName', { value: user.userName });
  }
}
