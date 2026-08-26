import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface GetItDoneDataStackProps extends cdk.StackProps {
    environmentName: 'beta' | 'prod';
}

export class GetItDoneDataStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: GetItDoneDataStackProps) {
        super(scope, id, props);

        const environmentName = props.environmentName;
        const tableName = `get-it-done-${environmentName}-tasks`;

        const tasksTable = new dynamodb.Table(this, 'TasksTable', {
            tableName,
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'sk',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
            contributorInsightsSpecification: {
                enabled: true,
            },
            removalPolicy: RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });

        tasksTable.addGlobalSecondaryIndex({
            indexName: 'gsi1',
            partitionKey: {
                name: 'gsi1pk',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'gsi1sk',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        new cdk.CfnOutput(this, 'TasksTableName', {
            value: tasksTable.tableName,
        });

        new cdk.CfnOutput(this, 'TasksTableArn', {
            value: tasksTable.tableArn,
        });
    }
}
