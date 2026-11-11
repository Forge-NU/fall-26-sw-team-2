import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import {
  CLERK_SECRET_KEYS,
  DATABASE_NAME,
  DATABASE_USER,
  POSTGRES_FULL_VERSION,
  POSTGRES_MAJOR_VERSION,
  SECRET_NAMES,
} from './config';

// The stateful half of staging: network, media bucket, database and secrets.
// It changes rarely and is only deployed by hand (CI deploys YujiStagingApi),
// with termination protection on. Renaming a construct ID here replaces the
// resource, so always run `cdk diff` first.
export class DataStack extends Stack {
  readonly vpc: ec2.Vpc;
  readonly mediaBucket: s3.Bucket;
  readonly database: rds.DatabaseInstance;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly clerkSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { terminationProtection: true, ...props });

    // No NAT gateway (about $33/month): the API tasks run in public subnets with
    // public IPs, and the database sits in isolated subnets with no internet route.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Private. The app only reaches objects through presigned URLs the API signs
    // (docs/architecture/media-uploads.md). Kept if the stack is ever deleted.
    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `yuji-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(1) }],
    });

    // No inbound rules here. YujiStagingApi adds the one rule letting its tasks
    // in, so this stack doesn't depend on that one.
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Yuji Postgres, reachable only from the API tasks',
      allowAllOutbound: false,
    });

    // The master user can CREATE EXTENSION, which the search migrations need
    // (pg_trgm, cube, earthdistance). RDS forces TLS on Postgres 15 and later.
    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of(POSTGRES_FULL_VERSION, POSTGRES_MAJOR_VERSION),
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [databaseSecurityGroup],
      publiclyAccessible: false,
      multiAz: false,
      databaseName: DATABASE_NAME,
      credentials: rds.Credentials.fromGeneratedSecret(DATABASE_USER, {
        secretName: SECRET_NAMES.database,
      }),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      backupRetention: Duration.days(1),
      autoMinorVersionUpgrade: true,
      enablePerformanceInsights: false,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });
    this.databaseSecret = this.database.secret!;

    // Created with placeholders; fill in the real values in the Secrets Manager
    // console (docs/process/deployment.md), so they never go through the repo.
    // CloudFormation only rewrites the value if this template changes, so later
    // deploys leave the real values alone.
    this.clerkSecret = new secretsmanager.Secret(this, 'ClerkSecret', {
      secretName: SECRET_NAMES.clerk,
      description: 'Clerk keys for the Yuji staging API. Fill in the values in the console.',
      secretObjectValue: Object.fromEntries(
        CLERK_SECRET_KEYS.map((key) => [key, SecretValue.unsafePlainText('replace-me')]),
      ),
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName });
    new CfnOutput(this, 'DatabaseEndpoint', { value: this.database.dbInstanceEndpointAddress });
    new CfnOutput(this, 'ClerkSecretName', { value: SECRET_NAMES.clerk });
  }
}
