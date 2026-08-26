import assert from 'node:assert/strict';
import test from 'node:test';
import {
    AdminCreateUserCommand,
    AdminDeleteUserCommand,
    AdminSetUserPasswordCommand,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const shouldRun = Boolean(process.env.RUN_INTEGRATION_TESTS === 'true' || process.env.GITHUB_ACTIONS === 'true');
const region = process.env.AWS_REGION || 'us-west-2';
const userPoolId = process.env.GETITDONE_BETA_USER_POOL_ID;
const appClientId = process.env.GETITDONE_BETA_APP_CLIENT_ID;
const apiUrl = process.env.GETITDONE_BETA_API_URL;
const tasksTableName = process.env.GETITDONE_BETA_TASKS_TABLE_NAME || 'get-it-done-beta-tasks';

const integrationTestOptions = {
    skip: !shouldRun || !userPoolId || !appClientId || !apiUrl,
    timeout: 120_000,
};

test('beta integration: create user, create task, and update task', integrationTestOptions, async () => {
    const now = Date.now();
    const username = `beta-user-${now}`;
    const email = `beta-user-${now}@example.com`;
    const password = 'TestPassword123!';

    const cognito = new CognitoIdentityProviderClient({ region });
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
    let createdTaskId: string | undefined;
    let userId: string | undefined;

    try {
        await cognito.send(new AdminCreateUserCommand({
            UserPoolId: userPoolId!,
            Username: username,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
            ],
            MessageAction: 'SUPPRESS',
        }));

        await cognito.send(new AdminSetUserPasswordCommand({
            UserPoolId: userPoolId!,
            Username: username,
            Password: password,
            Permanent: true,
        }));

        const authResult = await cognito.send(new InitiateAuthCommand({
            ClientId: appClientId!,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password,
            },
        }));

        const idToken = authResult.AuthenticationResult?.IdToken;
        assert.ok(idToken, 'Expected Cognito ID token to be returned for the created beta user');

        const tokenPayload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString()) as { sub?: string };
        userId = tokenPayload.sub;
        assert.ok(userId, 'Expected Cognito user id to be present in the ID token');

        const apiBaseUrl = apiUrl!.replace(/\/$/, '');

        const createResponse = await fetch(`${apiBaseUrl}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                title: 'Integration task',
                done: false,
                taskType: 'integration',
            }),
        });

        assert.equal(createResponse.status, 201, `Expected task creation to succeed, got ${createResponse.status}`);
        const createdTask = (await createResponse.json()) as { id?: string; title?: string; done?: boolean };
        assert.ok(createdTask.id, 'Expected created task to return an id');
        createdTaskId = createdTask.id;
        assert.equal(createdTask.title, 'Integration task');

        const updateResponse = await fetch(`${apiBaseUrl}/tasks/${createdTaskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                title: 'Integration task updated',
                done: true,
            }),
        });

        assert.equal(updateResponse.status, 200, `Expected task update to succeed, got ${updateResponse.status}`);
        const updatedTask = (await updateResponse.json()) as { title?: string; done?: boolean };
        assert.equal(updatedTask.title, 'Integration task updated');
        assert.equal(updatedTask.done, true);
    } finally {
        if (userId && createdTaskId) {
            try {
                await ddb.send(new DeleteCommand({
                    TableName: tasksTableName,
                    Key: {
                        pk: `USER#${userId}`,
                        sk: `TASK#${createdTaskId}`,
                    },
                }));
            } catch {
                // best effort cleanup for the created task row
            }
        }

        try {
            await cognito.send(new AdminDeleteUserCommand({
                UserPoolId: userPoolId!,
                Username: username,
            }));
        } catch {
            // best effort cleanup for the created Cognito user
        }
    }
});
