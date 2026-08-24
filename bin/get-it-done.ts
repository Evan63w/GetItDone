#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GetItDoneCognitoStack } from '../lib/get-it-done-cognito-stack';
import { GitHubActionsOidcStack } from '../lib/github-actions-oidc-stack';

const app = new cdk.App();

const environmentName = app.node.tryGetContext('environment') ?? 'beta';
const account = app.node.tryGetContext('account') ?? '341853291300';
const region = app.node.tryGetContext('region') ?? 'us-west-2';

new GitHubActionsOidcStack(app, 'GitHubActionsOidcStack', {
    env: {
        account,
        region,
    },
});

const stackId = environmentName === 'prod'
    ? 'GetItDoneCognitoStackProd'
    : 'GetItDoneCognitoStackBeta';

new GetItDoneCognitoStack(app, stackId, {
    env: {
        account,
        region,
    },
    environmentName,
});
