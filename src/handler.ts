// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Server-side SLIM (slimrpc) bridge for the A2A JS SDK.
 *
 * {@link SRPCHandler} implements the generated `A2AServiceServicer`, translating
 * inbound protobuf-es requests into the SDK's ts-proto domain objects, invoking
 * an `A2ARequestHandler` (e.g. the SDK's `DefaultRequestHandler`), and encoding
 * results back. Register it on a slimrpc `Server` with
 * {@link registerSlimA2AHandler}.
 */
import { create } from '@bufbuild/protobuf';
import { EmptySchema, type Empty } from '@bufbuild/protobuf/wkt';
import type { ContextLike, ServerLike } from './slimBindings.js';
import { HTTP_EXTENSION_HEADER } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';
import {
  type A2ARequestHandler,
  ServerCallContext,
  UnauthenticatedUser,
} from '@a2a-js/sdk/server';
import {
  type A2AServiceServicer,
  registerA2AServiceServicer,
  type AgentCard as PbAgentCard,
  type CancelTaskRequest,
  type DeleteTaskPushNotificationConfigRequest,
  type GetExtendedAgentCardRequest,
  type GetTaskPushNotificationConfigRequest,
  type GetTaskRequest,
  type ListTaskPushNotificationConfigsRequest,
  type ListTaskPushNotificationConfigsResponse,
  type ListTasksRequest,
  type ListTasksResponse,
  type SendMessageRequest,
  type SendMessageResponse,
  type StreamResponse,
  type SubscribeToTaskRequest,
  type Task,
  type TaskPushNotificationConfig,
} from './types/v1/index.js';
import * as conv from './conversions.js';
import { toRpcError } from './errors.js';

/** Builds an SDK `ServerCallContext` from an inbound slimrpc {@link ContextLike}. */
export interface CallContextBuilder {
  build(context: ContextLike, tenant?: string): ServerCallContext;
}

/** Default builder: unauthenticated user + requested extensions from metadata. */
export class DefaultCallContextBuilder implements CallContextBuilder {
  build(context: ContextLike, tenant?: string): ServerCallContext {
    const header = context.metadata().get(HTTP_EXTENSION_HEADER) ?? '';
    const requestedExtensions = header
      ? header
          .split(',')
          .map((uri) => uri.trim())
          .filter(Boolean)
      : undefined;
    return new ServerCallContext({
      user: new UnauthenticatedUser(),
      tenant: tenant || undefined,
      requestedExtensions,
    });
  }
}

/** Options for {@link SRPCHandler}. */
export interface SRPCHandlerOptions {
  /** Builds the per-call `ServerCallContext`. Defaults to {@link DefaultCallContextBuilder}. */
  contextBuilder?: CallContextBuilder;
  /** Optional hook to transform the extended agent card before it is served. */
  cardModifier?: (card: AgentCard) => AgentCard;
}

export class SRPCHandler implements A2AServiceServicer {
  private readonly contextBuilder: CallContextBuilder;
  private readonly cardModifier?: (card: AgentCard) => AgentCard;

  constructor(
    private readonly agentCard: AgentCard,
    private readonly requestHandler: A2ARequestHandler,
    options: SRPCHandlerOptions = {},
  ) {
    this.contextBuilder = options.contextBuilder ?? new DefaultCallContextBuilder();
    this.cardModifier = options.cardModifier;
  }

  private buildContext(
    context: ContextLike,
    request?: { tenant?: string },
  ): ServerCallContext {
    return this.contextBuilder.build(context, request?.tenant);
  }

  async SendMessage(
    request: SendMessageRequest,
    context: ContextLike,
  ): Promise<SendMessageResponse> {
    try {
      const params = conv.sendMessageRequest.toSdk(request);
      const result = await this.requestHandler.sendMessage(
        params,
        this.buildContext(context, params),
      );
      return conv.resultToSendMessageResponse(result);
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async *SendStreamingMessage(
    request: SendMessageRequest,
    context: ContextLike,
  ): AsyncIterable<StreamResponse> {
    const params = conv.sendMessageRequest.toSdk(request);
    try {
      for await (const event of this.requestHandler.sendMessageStream(
        params,
        this.buildContext(context, params),
      )) {
        yield conv.streamResponse.toProto(event);
      }
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async GetTask(request: GetTaskRequest, context: ContextLike): Promise<Task> {
    try {
      const params = conv.getTaskRequest.toSdk(request);
      return conv.task.toProto(
        await this.requestHandler.getTask(params, this.buildContext(context, params)),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async ListTasks(
    request: ListTasksRequest,
    context: ContextLike,
  ): Promise<ListTasksResponse> {
    try {
      const params = conv.listTasksRequest.toSdk(request);
      return conv.listTasksResponse.toProto(
        await this.requestHandler.listTasks(params, this.buildContext(context, params)),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async CancelTask(request: CancelTaskRequest, context: ContextLike): Promise<Task> {
    try {
      const params = conv.cancelTaskRequest.toSdk(request);
      return conv.task.toProto(
        await this.requestHandler.cancelTask(
          params,
          this.buildContext(context, params),
        ),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async *SubscribeToTask(
    request: SubscribeToTaskRequest,
    context: ContextLike,
  ): AsyncIterable<StreamResponse> {
    const params = conv.subscribeToTaskRequest.toSdk(request);
    try {
      for await (const event of this.requestHandler.resubscribe(
        params,
        this.buildContext(context, params),
      )) {
        yield conv.streamResponse.toProto(event);
      }
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async CreateTaskPushNotificationConfig(
    request: TaskPushNotificationConfig,
    context: ContextLike,
  ): Promise<TaskPushNotificationConfig> {
    try {
      const params = conv.taskPushNotificationConfig.toSdk(request);
      return conv.taskPushNotificationConfig.toProto(
        await this.requestHandler.createTaskPushNotificationConfig(
          params,
          this.buildContext(context, params),
        ),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async GetTaskPushNotificationConfig(
    request: GetTaskPushNotificationConfigRequest,
    context: ContextLike,
  ): Promise<TaskPushNotificationConfig> {
    try {
      const params = conv.getTaskPushNotificationConfigRequest.toSdk(request);
      return conv.taskPushNotificationConfig.toProto(
        await this.requestHandler.getTaskPushNotificationConfig(
          params,
          this.buildContext(context, params),
        ),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async ListTaskPushNotificationConfigs(
    request: ListTaskPushNotificationConfigsRequest,
    context: ContextLike,
  ): Promise<ListTaskPushNotificationConfigsResponse> {
    try {
      const params = conv.listTaskPushNotificationConfigsRequest.toSdk(request);
      return conv.listTaskPushNotificationConfigsResponse.toProto(
        await this.requestHandler.listTaskPushNotificationConfigs(
          params,
          this.buildContext(context, params),
        ),
      );
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async DeleteTaskPushNotificationConfig(
    request: DeleteTaskPushNotificationConfigRequest,
    context: ContextLike,
  ): Promise<Empty> {
    try {
      const params = conv.deleteTaskPushNotificationConfigRequest.toSdk(request);
      await this.requestHandler.deleteTaskPushNotificationConfig(
        params,
        this.buildContext(context, params),
      );
      return create(EmptySchema, {});
    } catch (error) {
      throw toRpcError(error);
    }
  }

  async GetExtendedAgentCard(
    request: GetExtendedAgentCardRequest,
    context: ContextLike,
  ): Promise<PbAgentCard> {
    try {
      // Only fetch the (richer) extended card from the handler when the base
      // card advertises one; otherwise serve the base card locally, mirroring
      // slim-a2a-python.
      let card = this.agentCard;
      if (this.agentCard.capabilities?.extendedAgentCard) {
        const params = conv.getExtendedAgentCardRequest.toSdk(request);
        card = await this.requestHandler.getAuthenticatedExtendedAgentCard(
          params,
          this.buildContext(context, params),
        );
      }
      return conv.agentCard.toProto(this.cardModifier ? this.cardModifier(card) : card);
    } catch (error) {
      throw toRpcError(error);
    }
  }
}

/** Registers an {@link SRPCHandler} (or any servicer) on a slimrpc server. */
export function registerSlimA2AHandler(
  server: ServerLike,
  handler: A2AServiceServicer,
): void {
  registerA2AServiceServicer(server, handler);
}
