#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GetItDoneCognitoStack } from '../lib/get-it-done-cognito-stack';
import { GetItDoneDataStack } from '../lib/get-it-done-data-stack';
import { GetItDoneTaskApiStack } from '../lib/get-it-done-task-api-stack';
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

const cognitoStackId = environmentName === 'prod'
    ? 'GetItDoneCognitoStackProd'
    : 'GetItDoneCognitoStackBeta';

const cognitoStack = new GetItDoneCognitoStack(app, cognitoStackId, {
    env: {
        account,
        region,
    },
    environmentName,
});

const dataStackId = environmentName === 'prod'
    ? 'GetItDoneDataStackProd'
    : 'GetItDoneDataStackBeta';

const dataStack = new GetItDoneDataStack(app, dataStackId, {
    env: {
        account,
        region,
    },
    environmentName,
});

const taskApiStackId = environmentName === 'prod'
    ? 'GetItDoneTaskApiStackProd'
    : 'GetItDoneTaskApiStackBeta';

new GetItDoneTaskApiStack(app, taskApiStackId, {
    env: {
        account,
        region,
    },
    environmentName,
    taskTable: dataStack.tasksTable,
    userPoolId: cognitoStack.userPool.userPoolId,
    userPoolClientId: cognitoStack.webClient.userPoolClientId,
});
