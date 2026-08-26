import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const tableName = process.env.TABLE_NAME || 'get-it-done-beta-tasks';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export interface TaskRecord {
    pk: string;
    sk: string;
    type: 'TASK';
    gsi1pk: string;
    gsi1sk: string;
    taskId: string;
    userId: string;
    title: string;
    done: boolean;
    taskType: string;
    createdAt: string;
    updatedAt: string;
}

export type TaskInput = {
    title?: string;
    done?: boolean;
    taskType?: string;
};

export function getUserIdFromEvent(event: any): string | undefined {
    const authorizer = event?.requestContext?.authorizer ?? {};
    const jwtClaims = authorizer.jwt?.claims ?? authorizer.claims ?? {};
    const userId = jwtClaims.sub ?? jwtClaims['cognito:username'] ?? event?.headers?.['x-user-id'];
    return typeof userId === 'string' && userId.length > 0 ? userId : undefined;
}

export function parseBody(event: any): any {
    if (!event || !event.body) {
        return {};
    }

    try {
        return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
        return {};
    }
}

export function normalizeTaskInput(input: TaskInput = {}): Required<Pick<TaskInput, 'title' | 'taskType' | 'done'>> {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const taskType = typeof input.taskType === 'string' && input.taskType.trim().length > 0 ? input.taskType.trim() : 'general';
    const done = Boolean(input.done);

    return {
        title,
        taskType,
        done,
    };
}

export function buildTaskRecord(userId: string, input: TaskInput = {}): TaskRecord {
    const now = new Date().toISOString();
    const normalized = normalizeTaskInput(input);
    const taskId = randomUUID();

    return {
        pk: `USER#${userId}`,
        sk: `TASK#${taskId}`,
        type: 'TASK',
        gsi1pk: `USER#${userId}`,
        gsi1sk: `TASK#${taskId}`,
        taskId,
        userId,
        title: normalized.title,
        done: normalized.done,
        taskType: normalized.taskType,
        createdAt: now,
        updatedAt: now,
    };
}

function jsonResponse(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
        },
        body: JSON.stringify(body),
    };
}

async function getUserTasks(userId: string): Promise<TaskRecord[]> {
    const result = await ddb.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :taskPrefix)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':taskPrefix': 'TASK#',
        },
    }));

    return (result.Items as TaskRecord[] | undefined) ?? [];
}

export async function listTasksHandler(event: any) {
    const userId = getUserIdFromEvent(event);
    if (!userId) {
        console.warn('listTasksHandler: missing userId', { event });
        return jsonResponse(401, { message: 'Unauthorized' });
    }

    console.info('listTasksHandler: request received', { userId, path: event?.rawPath, method: event?.requestContext?.http?.method });

    try {
        const tasks = await getUserTasks(userId);
        console.info('listTasksHandler: tasks found', { userId, itemCount: tasks.length, taskIds: tasks.map((task) => task.taskId) });
        return jsonResponse(200, tasks.map((task) => ({
            id: task.taskId,
            title: task.title,
            done: task.done,
            taskType: task.taskType,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        })));
    } catch (error) {
        const message = (error as Error).message;
        console.error('listTasksHandler: failed', { userId, error: message });
        return jsonResponse(500, { message: 'Unable to fetch tasks', error: message });
    }
}

export async function createTaskHandler(event: any) {
    const userId = getUserIdFromEvent(event);
    if (!userId) {
        console.warn('createTaskHandler: missing userId', { event });
        return jsonResponse(401, { message: 'Unauthorized' });
    }

    const body = parseBody(event);
    const input = normalizeTaskInput(body);

    console.info('createTaskHandler: request received', { userId, requestBody: body, normalizedInput: input });

    if (!input.title) {
        console.warn('createTaskHandler: missing title', { userId, body });
        return jsonResponse(400, { message: 'Task title is required' });
    }

    try {
        const task = buildTaskRecord(userId, input);
        await ddb.send(new PutCommand({
            TableName: tableName,
            Item: task,
        }));

        console.info('createTaskHandler: task created', { userId, taskId: task.taskId, title: task.title, taskType: task.taskType, done: task.done });

        return jsonResponse(201, {
            id: task.taskId,
            title: task.title,
            done: task.done,
            taskType: task.taskType,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        });
    } catch (error) {
        const message = (error as Error).message;
        console.error('createTaskHandler: failed', { userId, body, error: message });
        return jsonResponse(500, { message: 'Unable to create task', error: message });
    }
}

export async function updateTaskHandler(event: any) {
    const userId = getUserIdFromEvent(event);
    if (!userId) {
        console.warn('updateTaskHandler: missing userId', { event });
        return jsonResponse(401, { message: 'Unauthorized' });
    }

    const taskId = event?.pathParameters?.taskId;
    if (!taskId) {
        console.warn('updateTaskHandler: missing taskId', { userId, event });
        return jsonResponse(400, { message: 'Task id is required' });
    }

    const body = parseBody(event);
    const allowedFields = ['title', 'done', 'taskType'];
    const updates = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowedFields.includes(key) && body[key] !== undefined)
    );

    console.info('updateTaskHandler: request received', { userId, taskId, requestBody: body, updates });

    if (Object.keys(updates).length === 0) {
        console.warn('updateTaskHandler: no valid fields', { userId, taskId, body });
        return jsonResponse(400, { message: 'No valid task fields were provided' });
    }

    try {
        const existing = await ddb.send(new GetCommand({
            TableName: tableName,
            Key: {
                pk: `USER#${userId}`,
                sk: `TASK#${taskId}`,
            },
        }));

        if (!existing.Item) {
            console.warn('updateTaskHandler: task not found', { userId, taskId });
            return jsonResponse(404, { message: 'Task not found' });
        }

        const updateExpressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {
            ':updatedAt': new Date().toISOString(),
        };
        const expressionAttributeNames: Record<string, string> = {
            '#updatedAt': 'updatedAt',
        };

        for (const [key, value] of Object.entries(updates)) {
            const attributeName = `#${key}`;
            expressionAttributeNames[attributeName] = key;
            updateExpressions.push(`${attributeName} = :${key}`);
            expressionAttributeValues[`:${key}`] = key === 'done' ? Boolean(value) : value;
        }

        updateExpressions.push('#updatedAt = :updatedAt');

        const result = await ddb.send(new UpdateCommand({
            TableName: tableName,
            Key: {
                pk: `USER#${userId}`,
                sk: `TASK#${taskId}`,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW',
        }));

        const updatedTask = result.Attributes as TaskRecord | undefined;
        console.info('updateTaskHandler: task updated', {
            userId,
            taskId,
            updatedTitle: updatedTask?.title,
            updatedDone: updatedTask?.done,
            updatedTaskType: updatedTask?.taskType,
            updatedAt: updatedTask?.updatedAt,
        });

        return jsonResponse(200, {
            id: updatedTask?.taskId,
            title: updatedTask?.title,
            done: updatedTask?.done,
            taskType: updatedTask?.taskType,
            createdAt: updatedTask?.createdAt,
            updatedAt: updatedTask?.updatedAt,
        });
    } catch (error) {
        const message = (error as Error).message;
        console.error('updateTaskHandler: failed', { userId, taskId, error: message });
        return jsonResponse(500, { message: 'Unable to update task', error: message });
    }
}
