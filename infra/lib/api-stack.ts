import * as path from 'path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { IgnoreMode } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  API_CONTAINER_PORT,
  CLERK_SECRET_KEYS,
  DEFAULT_CORS_ORIGIN_PATTERN,
  HEALTH_CHECK_PATH,
} from './config';

const REPO_ROOT = path.join(__dirname, '..', '..');

export interface ApiStackProps extends StackProps {
  readonly vpc: ec2.IVpc;
  readonly database: rds.IDatabaseInstance;
  readonly mediaBucket: s3.IBucket;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly clerkSecret: secretsmanager.ISecret;
  readonly corsOriginPattern?: string;
}

// The stateless half of staging: the API on Fargate behind a load balancer and
// CloudFront, plus the hourly stories cleanup. CI deploys this stack on every
// merge to main; each deploy builds the image from apps/api/Dockerfile.
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { vpc, database, mediaBucket, databaseSecret, clerkSecret } = props;

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // Shared by the API service and the cleanup task, and the only thing the
    // database accepts connections from.
    const apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc,
      description: 'Yuji API service and cleanup tasks',
      allowAllOutbound: true,
    });
    // remoteRule puts the rule in this stack, so YujiStagingData doesn't depend
    // on it (that would be a circular reference between the stacks).
    for (const databaseSecurityGroup of database.connections.securityGroups) {
      databaseSecurityGroup.addIngressRule(
        apiSecurityGroup,
        ec2.Port.tcp(5432),
        'Postgres from the API tasks',
        true,
      );
    }

    // One image for the server and the cleanup task. Graviton (ARM) is about 20%
    // cheaper; CI builds on an ARM runner so no emulation is needed.
    const image = ecs.ContainerImage.fromAsset(REPO_ROOT, {
      file: 'apps/api/Dockerfile',
      platform: Platform.LINUX_ARM64,
      ignoreMode: IgnoreMode.DOCKER,
    });

    const databaseEnv = {
      DB_HOST: ecs.Secret.fromSecretsManager(databaseSecret, 'host'),
      DB_PORT: ecs.Secret.fromSecretsManager(databaseSecret, 'port'),
      DB_NAME: ecs.Secret.fromSecretsManager(databaseSecret, 'dbname'),
      DB_USERNAME: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
    };
    const clerkEnv = Object.fromEntries(
      CLERK_SECRET_KEYS.map((key) => [key, ecs.Secret.fromSecretsManager(clerkSecret, key)]),
    );
    const sharedEnvironment = {
      NODE_ENV: 'production',
      AWS_REGION: this.region,
      S3_BUCKET_NAME: mediaBucket.bucketName,
    };
    const runtimePlatform = {
      cpuArchitecture: ecs.CpuArchitecture.ARM64,
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    };

    // ---- API service ----

    const apiLogs = new logs.LogGroup(this, 'ApiLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const apiTask = new ecs.FargateTaskDefinition(this, 'ApiTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform,
    });
    apiTask.addContainer('api', {
      image,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup: apiLogs }),
      environment: {
        ...sharedEnvironment,
        PORT: String(API_CONTAINER_PORT),
        CORS_ORIGIN_PATTERN: props.corsOriginPattern ?? DEFAULT_CORS_ORIGIN_PATTERN,
      },
      secrets: { ...databaseEnv, ...clerkEnv },
      portMappings: [{ containerPort: API_CONTAINER_PORT }],
    });
    // Uploads, reads and account deletion (docs/architecture/media-uploads.md).
    apiTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
        resources: [mediaBucket.arnForObjects('users/*')],
      }),
    );
    apiTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [mediaBucket.bucketArn],
        conditions: { StringLike: { 's3:prefix': ['users/*'] } },
      }),
    );

    // Starts the new task before stopping the old one, and rolls back if the new
    // one never gets healthy (for example, a migration failed).
    const service = new ecs.FargateService(this, 'ApiService', {
      cluster,
      taskDefinition: apiTask,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [apiSecurityGroup],
      circuitBreaker: { enable: true, rollback: true },
      healthCheckGracePeriod: Duration.seconds(90),
      enableExecuteCommand: true,
    });

    // ---- Load balancer, reachable only through CloudFront ----

    const loadBalancerSecurityGroup = new ec2.SecurityGroup(this, 'LoadBalancerSecurityGroup', {
      vpc,
      description: 'Yuji API load balancer, accepts traffic only from CloudFront',
      allowAllOutbound: false,
    });
    // The prefix list ID differs per region, so it's looked up at synth time and
    // cached in cdk.context.json (commit that file).
    const cloudFrontOriginFacing = ec2.PrefixList.fromLookup(this, 'CloudFrontOriginFacing', {
      prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
    });
    loadBalancerSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(cloudFrontOriginFacing.prefixListId),
      ec2.Port.tcp(80),
      'HTTP from CloudFront origin-facing servers',
    );

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
      securityGroup: loadBalancerSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    const listener = loadBalancer.addListener('Http', { port: 80, open: false });
    listener.addTargets('Api', {
      port: API_CONTAINER_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: HEALTH_CHECK_PATH,
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
      },
      deregistrationDelay: Duration.seconds(30),
    });

    // HTTPS for the app without owning a domain. Nothing is cached, and every
    // viewer header except Host (so Authorization and the Clerk webhook's svix-*
    // headers) reaches the API.
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Yuji staging API',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: Duration.seconds(60),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });

    // ---- Hourly stories cleanup (docs/architecture/stories.md) ----

    const cleanupLogs = new logs.LogGroup(this, 'StoriesCleanupLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const cleanupTask = new ecs.FargateTaskDefinition(this, 'StoriesCleanupTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform,
    });
    cleanupTask.addContainer('cleanup', {
      image,
      command: ['node', 'dist/src/stories/cleanup.main.js'],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'cleanup', logGroup: cleanupLogs }),
      environment: sharedEnvironment,
      secrets: databaseEnv,
    });
    cleanupTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:DeleteObject'],
        resources: [mediaBucket.arnForObjects('users/*')],
      }),
    );

    new scheduler.Schedule(this, 'StoriesCleanupSchedule', {
      description: 'Deletes expired stories every hour',
      schedule: scheduler.ScheduleExpression.rate(Duration.hours(1)),
      target: new schedulerTargets.EcsRunFargateTask(cluster, {
        taskDefinition: cleanupTask,
        assignPublicIp: true,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        securityGroups: [apiSecurityGroup],
        retryAttempts: 0,
      }),
    });

    new CfnOutput(this, 'ApiUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'ServiceName', { value: service.serviceName });
    new CfnOutput(this, 'CleanupTaskDefinitionArn', { value: cleanupTask.taskDefinitionArn });
  }
}
