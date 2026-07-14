// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Conversion layer between the A2A JS SDK's domain objects and the protobuf-es
 * messages consumed by the generated slimrpc stubs.
 *
 * The `@a2a-js/sdk` (>= 1.0.0-beta) domain types are ts-proto-generated objects
 * for the A2A v1.0.0 proto, exposing `fromJSON` / `toJSON` codecs. The slimrpc
 * stubs use `@bufbuild/protobuf` (protobuf-es v2) messages created from the same
 * proto. Both agree on the canonical proto3 JSON representation, so we bridge
 * through JSON — this is faithful (enum values, oneofs, bytes, WKTs all round
 * trip) and needs no hand-written field mapping.
 *
 * NOTE: the SDK's published runtime only ships the JSON codecs (`fromJSON` /
 * `toJSON`), not the binary `encode` / `decode`, which is why we bridge through
 * JSON rather than protobuf wire bytes.
 */
import {
  create,
  fromJson,
  toJson,
  type JsonValue,
  type Message as ProtoMessage,
} from '@bufbuild/protobuf';
import type { GenMessage } from '@bufbuild/protobuf/codegenv2';
import * as sdk from '@a2a-js/sdk';
import * as pb from './types/v1/a2a_pb.js';

/** The subset of a ts-proto message namespace we rely on. */
interface SdkCodec<T> {
  fromJSON(json: unknown): T;
  toJSON(message: T): unknown;
}

/** A bidirectional bridge between an SDK codec and a protobuf-es schema. */
export interface Bridge<S, P> {
  toProto(value: S): P;
  toSdk(value: P): S;
}

function defineBridge<S, P extends ProtoMessage>(
  codec: SdkCodec<S>,
  schema: GenMessage<P>,
): Bridge<S, P> {
  return {
    toProto: (value: S): P =>
      fromJson(schema, codec.toJSON(value) as JsonValue, { ignoreUnknownFields: true }),
    toSdk: (value: P): S => codec.fromJSON(toJson(schema, value)),
  };
}

// Domain messages.
export const message = defineBridge<sdk.Message, pb.Message>(
  sdk.Message,
  pb.MessageSchema,
);
export const task = defineBridge<sdk.Task, pb.Task>(sdk.Task, pb.TaskSchema);
export const streamResponse = defineBridge<sdk.StreamResponse, pb.StreamResponse>(
  sdk.StreamResponse,
  pb.StreamResponseSchema,
);
export const agentCard = defineBridge<sdk.AgentCard, pb.AgentCard>(
  sdk.AgentCard,
  pb.AgentCardSchema,
);

// Requests / responses.
export const sendMessageRequest = defineBridge<
  sdk.SendMessageRequest,
  pb.SendMessageRequest
>(sdk.SendMessageRequest, pb.SendMessageRequestSchema);
export const sendMessageResponse = defineBridge<
  sdk.SendMessageResponse,
  pb.SendMessageResponse
>(sdk.SendMessageResponse, pb.SendMessageResponseSchema);
export const getTaskRequest = defineBridge<sdk.GetTaskRequest, pb.GetTaskRequest>(
  sdk.GetTaskRequest,
  pb.GetTaskRequestSchema,
);
export const listTasksRequest = defineBridge<sdk.ListTasksRequest, pb.ListTasksRequest>(
  sdk.ListTasksRequest,
  pb.ListTasksRequestSchema,
);
export const listTasksResponse = defineBridge<
  sdk.ListTasksResponse,
  pb.ListTasksResponse
>(sdk.ListTasksResponse, pb.ListTasksResponseSchema);
export const cancelTaskRequest = defineBridge<
  sdk.CancelTaskRequest,
  pb.CancelTaskRequest
>(sdk.CancelTaskRequest, pb.CancelTaskRequestSchema);
export const subscribeToTaskRequest = defineBridge<
  sdk.SubscribeToTaskRequest,
  pb.SubscribeToTaskRequest
>(sdk.SubscribeToTaskRequest, pb.SubscribeToTaskRequestSchema);
export const taskPushNotificationConfig = defineBridge<
  sdk.TaskPushNotificationConfig,
  pb.TaskPushNotificationConfig
>(sdk.TaskPushNotificationConfig, pb.TaskPushNotificationConfigSchema);
export const getTaskPushNotificationConfigRequest = defineBridge<
  sdk.GetTaskPushNotificationConfigRequest,
  pb.GetTaskPushNotificationConfigRequest
>(
  sdk.GetTaskPushNotificationConfigRequest,
  pb.GetTaskPushNotificationConfigRequestSchema,
);
export const listTaskPushNotificationConfigsRequest = defineBridge<
  sdk.ListTaskPushNotificationConfigsRequest,
  pb.ListTaskPushNotificationConfigsRequest
>(
  sdk.ListTaskPushNotificationConfigsRequest,
  pb.ListTaskPushNotificationConfigsRequestSchema,
);
export const listTaskPushNotificationConfigsResponse = defineBridge<
  sdk.ListTaskPushNotificationConfigsResponse,
  pb.ListTaskPushNotificationConfigsResponse
>(
  sdk.ListTaskPushNotificationConfigsResponse,
  pb.ListTaskPushNotificationConfigsResponseSchema,
);
export const deleteTaskPushNotificationConfigRequest = defineBridge<
  sdk.DeleteTaskPushNotificationConfigRequest,
  pb.DeleteTaskPushNotificationConfigRequest
>(
  sdk.DeleteTaskPushNotificationConfigRequest,
  pb.DeleteTaskPushNotificationConfigRequestSchema,
);
export const getExtendedAgentCardRequest = defineBridge<
  sdk.GetExtendedAgentCardRequest,
  pb.GetExtendedAgentCardRequest
>(sdk.GetExtendedAgentCardRequest, pb.GetExtendedAgentCardRequestSchema);

/**
 * A non-streaming send result is the inner `Message` or `Task` of a
 * `SendMessageResponse` oneof.
 */
export type SendMessageResult = sdk.Message | sdk.Task;

/** Extracts the SDK `Message`/`Task` from a protobuf-es `SendMessageResponse`. */
export function sendMessageResponseToResult(
  resp: pb.SendMessageResponse,
): SendMessageResult {
  switch (resp.payload.case) {
    case 'task':
      return task.toSdk(resp.payload.value);
    case 'message':
      return message.toSdk(resp.payload.value);
    default:
      throw new Error('SendMessageResponse contained no payload');
  }
}

/** Wraps an SDK `Message`/`Task` into a protobuf-es `SendMessageResponse`. */
export function resultToSendMessageResponse(
  result: SendMessageResult,
): pb.SendMessageResponse {
  // A `Message` always carries `messageId`; a `Task` carries `id` + `status`.
  if ('messageId' in result && typeof (result as sdk.Message).messageId === 'string') {
    return create(pb.SendMessageResponseSchema, {
      payload: { case: 'message', value: message.toProto(result as sdk.Message) },
    });
  }
  return create(pb.SendMessageResponseSchema, {
    payload: { case: 'task', value: task.toProto(result as sdk.Task) },
  });
}
