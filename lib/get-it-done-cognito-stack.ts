import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface GetItDoneEnvironmentStackProps extends cdk.StackProps {
    environmentName: 'beta' | 'prod';
}

export class GetItDoneCognitoStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: GetItDoneEnvironmentStackProps) {
        super(scope, id, props);

        const environmentName = props.environmentName;
        const normalizedSuffix = `${environmentName}-${this.account}-${this.region}`
            .replace(/[^a-z0-9-]/g, '')
            .toLowerCase();

        const assetBucket = new s3.Bucket(this, 'AssetBucket', {
            bucketName: `get-it-done-${normalizedSuffix}`.slice(0, 63),
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        const userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: `get-it-done-${environmentName}-user-pool`,
            signInAliases: {
                email: true,
            },
            selfSignUpEnabled: true,
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                givenName: { required: true, mutable: true },
                familyName: { required: true, mutable: true },
                email: { required: true, mutable: true },
            },
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: RemovalPolicy.DESTROY,
            userVerification: {
                emailStyle: cognito.VerificationEmailStyle.CODE,
            },
            mfa: cognito.Mfa.OPTIONAL,
            standardThreatProtectionMode: cognito.StandardThreatProtectionMode.FULL_FUNCTION,
            customThreatProtectionMode: cognito.CustomThreatProtectionMode.FULL_FUNCTION,
        });

        const domainPrefix = `get-it-done-${environmentName}-${this.account}`
            .replace(/[^a-z0-9-]/g, '')
            .toLowerCase()
            .slice(0, 63);

        const domain = userPool.addDomain('CognitoDomain', {
            cognitoDomain: {
                domainPrefix,
            },
        });

        const callbackUrls = environmentName === 'beta'
            ? ['https://beta.getitdone.local/callback', 'http://localhost:3000/callback']
            : ['https://prod.getitdone.local/callback', 'http://localhost:3000/callback'];

        const webClient = new cognito.UserPoolClient(this, 'WebClient', {
            userPool,
            userPoolClientName: `get-it-done-${environmentName}-web-client`,
            authFlows: {
                userPassword: true,
                userSrp: true,
                custom: true,
            },
            preventUserExistenceErrors: true,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls,
                logoutUrls: environmentName === 'beta'
                    ? ['https://beta.getitdone.local', 'http://localhost:3000/']
                    : ['https://prod.getitdone.local', 'http://localhost:3000/'],
            },
        });

        new cdk.CfnOutput(this, 'AssetBucketName', {
            value: assetBucket.bucketName,
        });

        new cdk.CfnOutput(this, 'UserPoolId', {
            value: userPool.userPoolId,
        });

        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: webClient.userPoolClientId,
        });

        new cdk.CfnOutput(this, 'UserPoolDomain', {
            value: domain.baseUrl(),
        });
    }
}
