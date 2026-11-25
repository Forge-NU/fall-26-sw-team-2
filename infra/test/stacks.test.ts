import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { createStacks } from '../lib/app';

// The feature flags from cdk.json, so tests synthesize what `cdk synth` would.
const cdkJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'cdk.json'), 'utf8'));

function synth(extraContext: Record<string, unknown> = {}) {
  const app = new App({
    context: { ...cdkJson.context, 'yuji:account': '123456789012', ...extraContext },
  });
  const stacks = createStacks(app);
  return {
    stacks,
    data: Template.fromStack(stacks.data),
    api: Template.fromStack(stacks.api),
    ci: Template.fromStack(stacks.ci),
  };
}

const { stacks, data, api, ci } = synth();

describe('account guard', () => {
  it('refuses to build without a 12-digit account ID', () => {
    assert.throws(() => synth({ 'yuji:account': '' }), /yuji:account/);
    assert.throws(() => synth({ 'yuji:account': 'not-an-id' }), /yuji:account/);
  });
});

describe('YujiStagingData', () => {
  it('has termination protection', () => {
    assert.equal(stacks.data.terminationProtection, true);
  });

  it('has no NAT gateway', () => {
    data.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  it('keeps the media bucket private and TLS-only', () => {
    data.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'yuji-media-123456789012',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    data.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
    data.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  });

  it('keeps the database private, encrypted and protected', () => {
    data.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      PubliclyAccessible: false,
      StorageEncrypted: true,
      DeletionProtection: true,
      DBInstanceClass: 'db.t4g.micro',
    });
  });
});

describe('YujiStagingApi', () => {
  it('passes credentials as secrets, never as plain environment variables', () => {
    const taskDefinitions = api.findResources('AWS::ECS::TaskDefinition');
    for (const taskDefinition of Object.values(taskDefinitions)) {
      for (const container of taskDefinition.Properties.ContainerDefinitions) {
        const names: string[] = (container.Environment ?? []).map((e: { Name: string }) => e.Name);
        for (const name of names) {
          assert.doesNotMatch(name, /PASSWORD|SECRET|DATABASE_URL|TOKEN/, `${name} is plain text`);
        }
      }
    }
    api.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        Match.objectLike({
          Name: 'api',
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'DB_PASSWORD' }),
            Match.objectLike({ Name: 'CLERK_SECRET_KEY' }),
            Match.objectLike({ Name: 'CLERK_WEBHOOK_SIGNING_SECRET' }),
          ]),
        }),
      ],
    });
  });

  it('opens Postgres only to the API security group', () => {
    data.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: Match.stringLikeRegexp('Postgres'),
      SecurityGroupIngress: Match.absent(),
    });
    const ingress = Object.values(
      api.findResources('AWS::EC2::SecurityGroupIngress', { Properties: { FromPort: 5432 } }),
    );
    assert.equal(ingress.length, 1);
    assert.ok(ingress[0].Properties.SourceSecurityGroupId, 'rule should reference a security group');
    assert.equal(ingress[0].Properties.CidrIp, undefined);
  });

  it('runs on ARM Fargate with rollback on failed deployments', () => {
    api.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RuntimePlatform: { CpuArchitecture: 'ARM64' },
    });
    api.hasResourceProperties('AWS::ECS::Service', {
      DeploymentConfiguration: Match.objectLike({
        DeploymentCircuitBreaker: { Enable: true, Rollback: true },
      }),
    });
  });

  it('health checks /api/health', () => {
    api.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/api/health',
    });
  });

  it('only accepts load balancer traffic from CloudFront', () => {
    api.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      FromPort: 80,
      SourcePrefixListId: Match.anyValue(),
    });
    const openInline = api.findResources('AWS::EC2::SecurityGroup', {
      Properties: { SecurityGroupIngress: Match.arrayWith([Match.objectLike({ CidrIp: '0.0.0.0/0' })]) },
    });
    assert.deepEqual(Object.keys(openInline), []);
    const openIngress = api.findResources('AWS::EC2::SecurityGroupIngress', {
      Properties: { CidrIp: '0.0.0.0/0' },
    });
    assert.deepEqual(Object.keys(openIngress), []);
  });

  it('serves HTTPS only and forwards viewer headers without caching', () => {
    api.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'https-only',
          CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingDisabled
          OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac', // AllViewerExceptHostHeader
        }),
      }),
    });
  });

  it('limits the API task role to the users/ prefix of the bucket', () => {
    api.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['s3:DeleteObject', 's3:GetObject', 's3:PutObject'],
            Resource: Match.objectLike({ 'Fn::Join': Match.arrayWith([Match.arrayWith(['/users/*'])]) }),
          }),
          Match.objectLike({
            Action: 's3:ListBucket',
            Condition: { StringLike: { 's3:prefix': ['users/*'] } },
          }),
        ]),
      },
    });
  });

  it('runs the stories cleanup hourly', () => {
    api.hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: 'rate(1 hour)',
      Target: Match.objectLike({ EcsParameters: Match.objectLike({ LaunchType: 'FARGATE' }) }),
    });
    api.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        Match.objectLike({ Name: 'cleanup', Command: ['node', 'dist/src/stories/cleanup.main.js'] }),
      ],
    });
  });
});

describe('YujiCi', () => {
  it('creates a deploy user without an access key or console login', () => {
    ci.hasResourceProperties('AWS::IAM::User', { UserName: 'yuji-github-deploy' });
    ci.resourceCountIs('AWS::IAM::AccessKey', 0);
    ci.hasResourceProperties('AWS::IAM::User', { LoginProfile: Match.absent() });
  });

  it('can only assume the CDK bootstrap roles', () => {
    ci.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Resource: 'arn:aws:iam::123456789012:role/cdk-hnb659fds-*-123456789012-us-east-2',
          },
        ],
      },
    });
  });
});

describe('YujiBudget', () => {
  it('is only created when an email is given', () => {
    assert.equal(stacks.budget, undefined);
    const withEmail = synth({ 'yuji:budgetEmail': 'team@example.com' });
    assert.ok(withEmail.stacks.budget);
    Template.fromStack(withEmail.stacks.budget!).hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 40, Unit: 'USD' } }),
    });
  });
});
