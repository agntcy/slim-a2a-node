// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { create, toJson } from '@bufbuild/protobuf';
import * as conv from '../src/conversions.js';
import {
  MessageSchema,
  TaskSchema,
  StreamResponseSchema,
  AgentCardSchema,
  Role,
  TaskState,
  type Message,
  type Task,
  type StreamResponse,
  type AgentCard,
} from '../src/types/v1/a2a_pb.js';

/** Round-trips a protobuf-es message proto -> SDK -> proto and asserts JSON equality. */
function assertRoundTrip<P extends { $typeName: string }>(
  schema: Parameters<typeof toJson>[0],
  proto: P,
  bridge: conv.Bridge<unknown, P>,
): void {
  const back = bridge.toProto(bridge.toSdk(proto));
  expect(toJson(schema as never, back as never)).toEqual(
    toJson(schema as never, proto as never),
  );
}

describe('message conversion', () => {
  it('round-trips a text message', () => {
    const proto = create(MessageSchema, {
      messageId: 'm1',
      contextId: 'c1',
      role: Role.USER,
      parts: [
        { content: { case: 'text', value: 'hello' }, filename: '', mediaType: '' },
      ],
      extensions: ['ext://a'],
    }) as Message;
    assertRoundTrip(MessageSchema, proto, conv.message);
    const sdk = conv.message.toSdk(proto);
    expect(sdk.messageId).toBe('m1');
    expect(sdk.role).toBe(Role.USER); // enum values align between ts-proto and protobuf-es
    expect((sdk.parts[0].content as { $case: string; value: string }).value).toBe(
      'hello',
    );
  });

  it('round-trips a data part (google.protobuf.Value)', () => {
    const proto = create(MessageSchema, {
      messageId: 'm2',
      role: Role.AGENT,
      parts: [
        {
          content: {
            case: 'data',
            value: { kind: { case: 'structValue', value: { fields: {} } } },
          },
          filename: '',
          mediaType: 'application/json',
        },
      ],
    }) as Message;
    // Build via SDK JSON to exercise structured data end-to-end.
    const sdk = conv.message.toSdk(proto);
    const roundTripped = conv.message.toProto(sdk);
    expect(roundTripped.parts[0].content.case).toBe('data');
  });

  it('round-trips a file url part with media type + filename', () => {
    const proto = create(MessageSchema, {
      messageId: 'm3',
      role: Role.AGENT,
      parts: [
        {
          content: { case: 'url', value: 'https://example.com/f.pdf' },
          filename: 'f.pdf',
          mediaType: 'application/pdf',
        },
      ],
    }) as Message;
    assertRoundTrip(MessageSchema, proto, conv.message);
  });
});

describe('task conversion', () => {
  it('round-trips a task with status, history and artifacts', () => {
    const proto = create(TaskSchema, {
      id: 't1',
      contextId: 'c1',
      status: { state: TaskState.COMPLETED },
      history: [
        create(MessageSchema, {
          messageId: 'h1',
          role: Role.USER,
          parts: [
            { content: { case: 'text', value: 'hi' }, filename: '', mediaType: '' },
          ],
        }),
      ],
      artifacts: [
        {
          artifactId: 'a1',
          name: 'result',
          parts: [
            { content: { case: 'text', value: 'done' }, filename: '', mediaType: '' },
          ],
        },
      ],
    }) as Task;
    assertRoundTrip(TaskSchema, proto, conv.task);
    expect(conv.task.toSdk(proto).status?.state).toBe(TaskState.COMPLETED);
  });
});

describe('stream response conversion', () => {
  const cases: Array<[string, StreamResponse]> = [
    [
      'message',
      create(StreamResponseSchema, {
        payload: {
          case: 'message',
          value: create(MessageSchema, { messageId: 's1', role: Role.AGENT }),
        },
      }) as StreamResponse,
    ],
    [
      'task',
      create(StreamResponseSchema, {
        payload: {
          case: 'task',
          value: create(TaskSchema, { id: 's2', contextId: 'c' }),
        },
      }) as StreamResponse,
    ],
    [
      'statusUpdate',
      create(StreamResponseSchema, {
        payload: {
          case: 'statusUpdate',
          value: { taskId: 't', contextId: 'c', status: { state: TaskState.WORKING } },
        },
      }) as StreamResponse,
    ],
    [
      'artifactUpdate',
      create(StreamResponseSchema, {
        payload: {
          case: 'artifactUpdate',
          value: {
            taskId: 't',
            contextId: 'c',
            artifact: { artifactId: 'a', name: 'n', parts: [] },
          },
        },
      }) as StreamResponse,
    ],
  ];
  it.each(cases)('round-trips a %s stream response', (_name, proto) => {
    assertRoundTrip(StreamResponseSchema, proto, conv.streamResponse);
  });
});

describe('SendMessageResult helpers', () => {
  it('extracts and re-wraps a task result', () => {
    const task = conv.task.toSdk(
      create(TaskSchema, { id: 't9', contextId: 'c' }) as Task,
    );
    const wrapped = conv.resultToSendMessageResponse(task);
    expect(wrapped.payload.case).toBe('task');
    const back = conv.sendMessageResponseToResult(wrapped);
    expect((back as { id: string }).id).toBe('t9');
  });

  it('extracts and re-wraps a message result', () => {
    const msg = conv.message.toSdk(
      create(MessageSchema, { messageId: 'm9', role: Role.AGENT }) as Message,
    );
    const wrapped = conv.resultToSendMessageResponse(msg);
    expect(wrapped.payload.case).toBe('message');
    const back = conv.sendMessageResponseToResult(wrapped);
    expect((back as { messageId: string }).messageId).toBe('m9');
  });
});

describe('agent card conversion', () => {
  it('round-trips an agent card', () => {
    const proto = create(AgentCardSchema, {
      name: 'echo',
      description: 'echoes',
      version: '1.0.0',
      capabilities: { streaming: true },
      supportedInterfaces: [
        { url: 'agntcy/demo/echo', protocolBinding: 'slimrpc', protocolVersion: '1.0' },
      ],
      skills: [{ id: 's', name: 'echo', description: 'd', tags: ['t'] }],
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
    }) as AgentCard;
    assertRoundTrip(AgentCardSchema, proto, conv.agentCard);
  });
});
