import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTaskRecord, getUserIdFromEvent, normalizeTaskInput } from '../lambda/task-api/tasks';

test('extracts user id from Cognito JWT claims', () => {
    const event = {
        requestContext: {
            authorizer: {
                jwt: {
                    claims: {
                        sub: 'user-123',
                    },
                },
            },
        },
    };

    assert.equal(getUserIdFromEvent(event), 'user-123');
});

test('normalizes task input and defaults task type', () => {
    const normalized = normalizeTaskInput({ title: '  Take out the trash  ', done: true });

    assert.equal(normalized.title, 'Take out the trash');
    assert.equal(normalized.taskType, 'general');
    assert.equal(normalized.done, true);
});

test('builds a task record with user-based keys', () => {
    const task = buildTaskRecord('user-123', {
        title: 'Wash dishes',
        done: false,
        taskType: 'chore',
    });

    assert.equal(task.pk, 'USER#user-123');
    assert.equal(task.sk.startsWith('TASK#'), true);
    assert.equal(task.taskId.length > 0, true);
    assert.equal(task.title, 'Wash dishes');
    assert.equal(task.done, false);
    assert.equal(task.taskType, 'chore');
    assert.equal(task.type, 'TASK');
});
