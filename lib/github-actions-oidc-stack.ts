import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class GitHubActionsOidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repo = 'Evan63w/GetItDone';

    const githubOidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubActionsOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const allowCdkDeploy = new iam.PolicyStatement({
      sid: 'AllowCdkDeploy',
      effect: iam.Effect.ALLOW,
      actions: ['*'],
      resources: ['*'],
    });

    const betaRole = new iam.Role(this, 'GitHubActionsBetaRole', {
      roleName: 'GetItDoneGitHubActionsDeployRoleBeta',
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': `repo:${repo}:environment:beta`,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    betaRole.addToPolicy(allowCdkDeploy);

    const prodRole = new iam.Role(this, 'GitHubActionsProdRole', {
      roleName: 'GetItDoneGitHubActionsDeployRoleProd',
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': `repo:${repo}:environment:prod`,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    prodRole.addToPolicy(allowCdkDeploy);

    new cdk.CfnOutput(this, 'BetaRoleArn', {
      value: betaRole.roleArn,
    });

    new cdk.CfnOutput(this, 'ProdRoleArn', {
      value: prodRole.roleArn,
    });
  }
}
