import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface GetItDoneTaskApiStackProps extends cdk.StackProps {
    environmentName: 'beta' | 'prod';
    taskTable: dynamodb.Table;
    userPoolId: string;
    userPoolClientId: string;
}

export class GetItDoneTaskApiStack extends cdk.Stack {
    public readonly httpApi: apigwv2.HttpApi;

    constructor(scope: Construct, id: string, props: GetItDoneTaskApiStackProps) {
        super(scope, id, props);

        const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPoolId}`;

        const jwtAuthorizer = new authorizers.HttpJwtAuthorizer('CognitoAuthorizer', issuer, {
            jwtAudience: [props.userPoolClientId],
        });

        const listTasksFn = new nodeLambda.NodejsFunction(this, 'ListTasksFunction', {
            functionName: `get-it-done-${props.environmentName}-list-tasks`,
            entry: 'lambda/task-api/tasks.ts',
            handler: 'listTasksHandler',
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: {
                TABLE_NAME: props.taskTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
        });

        const createTaskFn = new nodeLambda.NodejsFunction(this, 'CreateTaskFunction', {
            functionName: `get-it-done-${props.environmentName}-create-task`,
            entry: 'lambda/task-api/tasks.ts',
            handler: 'createTaskHandler',
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: {
                TABLE_NAME: props.taskTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
        });

        const updateTaskFn = new nodeLambda.NodejsFunction(this, 'UpdateTaskFunction', {
            functionName: `get-it-done-${props.environmentName}-update-task`,
            entry: 'lambda/task-api/tasks.ts',
            handler: 'updateTaskHandler',
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: {
                TABLE_NAME: props.taskTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
        });

        props.taskTable.grantReadWriteData(listTasksFn);
        props.taskTable.grantReadWriteData(createTaskFn);
        props.taskTable.grantReadWriteData(updateTaskFn);

        this.httpApi = new apigwv2.HttpApi(this, 'TaskApi', {
            apiName: `get-it-done-${props.environmentName}-tasks-api`,
            corsPreflight: {
                allowOrigins: ['*'],
                allowMethods: [
                    apigwv2.CorsHttpMethod.GET,
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.PATCH,
                    apigwv2.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });

        this.httpApi.addRoutes({
            path: '/tasks',
            methods: [apigwv2.HttpMethod.GET],
            integration: new integrations.HttpLambdaIntegration('ListTasksIntegration', listTasksFn),
            authorizer: jwtAuthorizer,
        });

        this.httpApi.addRoutes({
            path: '/tasks',
            methods: [apigwv2.HttpMethod.POST],
            integration: new integrations.HttpLambdaIntegration('CreateTaskIntegration', createTaskFn),
            authorizer: jwtAuthorizer,
        });

        this.httpApi.addRoutes({
            path: '/tasks/{taskId}',
            methods: [apigwv2.HttpMethod.PATCH],
            integration: new integrations.HttpLambdaIntegration('UpdateTaskIntegration', updateTaskFn),
            authorizer: jwtAuthorizer,
        });

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.httpApi.url ?? 'unknown',
        });
    }
}
