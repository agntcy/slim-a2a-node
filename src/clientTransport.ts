// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * SLIM (slimrpc) client transport for the A2A JS SDK.
 *
 * {@link SRPCTransport} implements the SDK's `Transport` interface over the
 * generated slimrpc `A2AServiceClient`, translating between the SDK's ts-proto
 * domain objects and the protobuf-es wire messages via {@link conversions}.
 * {@link SRPCTransportFactory} plugs it into the SDK's `ClientFactory`.
 */
import {
  Channel,
  Name,
  type AppLike,
  type ChannelLike,
  type NameLike,
} from '@agntcy/slim-bindings';
import type {
  RequestOptions,
  ServiceParameters,
  Transport,
  TransportFactory,
} from '@a2a-js/sdk/client';
import type {
  AgentCard,
  CancelTaskRequest,
  DeleteTaskPushNotificationConfigRequest,
  GetExtendedAgentCardRequest,
  GetTaskPushNotificationConfigRequest,
  GetTaskRequest,
  ListTaskPushNotificationConfigsRequest,
  ListTaskPushNotificationConfigsResponse,
  ListTasksRequest,
  ListTasksResponse,
  SendMessageRequest,
  SendMessageResult,
  StreamResponse,
  SubscribeToTaskRequest,
  Task,
  TaskPushNotificationConfig,
} from '@a2a-js/sdk';
import { A2AServiceClient, A2AServiceGroupClient } from './types/v1/index.js';
import * as conv from './conversions.js';

/** The A2A transport/protocol-binding identifier for SLIM. */
export const SLIMRPC_PROTOCOL = 'slimrpc';

/** Per-transport call options. */
export interface SRPCTransportOptions {
  /** Per-call timeout in milliseconds. */
  timeout?: number;
  /** Static metadata sent with every call. */
  metadata?: Map<string, string>;
  /** A2A protocol version advertised by this transport. Defaults to `'1.0'`. */
  protocolVersion?: string;
}

/** Parses a SLIM name string `"organization/namespace/app"` into a {@link Name}. */
export function parseSlimName(remote: string): NameLike {
  const parts = remote.split('/');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid SLIM name '${remote}'. Expected 'organization/namespace/app'.`,
    );
  }
  return new Name(parts[0], parts[1], parts[2]);
}

/** Builds a unicast channel to a single remote agent. */
export function slimChannel(app: AppLike, remote: string, connId: bigint): ChannelLike {
  return Channel.newWithConnection(app, parseSlimName(remote), connId);
}

/** Builds a multicast (group) channel spanning several remote agents. */
export function slimGroupChannel(
  app: AppLike,
  remotes: string[],
  connId: bigint,
): ChannelLike {
  return Channel.newGroupWithConnection(app, remotes.map(parseSlimName), connId);
}

export class SRPCTransport implements Transport {
  private readonly client: A2AServiceClient;

  constructor(
    private readonly channel: ChannelLike,
    private readonly agentCard?: AgentCard,
    private readonly options: SRPCTransportOptions = {},
  ) {
    this.client = new A2AServiceClient(channel);
  }

  /** Convenience constructor from an app + remote SLIM name. */
  static fromName(
    app: AppLike,
    connId: bigint,
    remote: string,
    agentCard?: AgentCard,
    options?: SRPCTransportOptions,
  ): SRPCTransport {
    return new SRPCTransport(slimChannel(app, remote, connId), agentCard, options);
  }

  get protocolName(): string {
    return SLIMRPC_PROTOCOL;
  }

  get protocolVersion(): string {
    return this.options.protocolVersion ?? '1.0';
  }

  private get timeout(): number | undefined {
    return this.options.timeout;
  }

  private metadata(options?: RequestOptions): Map<string, string> | undefined {
    const merged = new Map<string, string>(this.options.metadata ?? []);
    const params = options?.serviceParameters as ServiceParameters | undefined;
    if (params) {
      for (const [key, value] of Object.entries(params)) merged.set(key, value);
    }
    return merged.size > 0 ? merged : undefined;
  }

  async sendMessage(
    params: SendMessageRequest,
    options?: RequestOptions,
  ): Promise<SendMessageResult> {
    const response = await this.client.SendMessage(
      conv.sendMessageRequest.toProto(params),
      this.timeout,
      this.metadata(options),
    );
    return conv.sendMessageResponseToResult(response);
  }

  async *sendMessageStream(
    params: SendMessageRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamResponse, void, undefined> {
    const stream = this.client.SendStreamingMessage(
      conv.sendMessageRequest.toProto(params),
      this.timeout,
      this.metadata(options),
    );
    for await (const response of stream) {
      yield conv.streamResponse.toSdk(response);
    }
  }

  async getTask(params: GetTaskRequest, options?: RequestOptions): Promise<Task> {
    return conv.task.toSdk(
      await this.client.GetTask(
        conv.getTaskRequest.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }

  async listTasks(
    params: ListTasksRequest,
    options?: RequestOptions,
  ): Promise<ListTasksResponse> {
    return conv.listTasksResponse.toSdk(
      await this.client.ListTasks(
        conv.listTasksRequest.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }

  async cancelTask(params: CancelTaskRequest, options?: RequestOptions): Promise<Task> {
    return conv.task.toSdk(
      await this.client.CancelTask(
        conv.cancelTaskRequest.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }

  async *resubscribeTask(
    params: SubscribeToTaskRequest,
    options?: RequestOptions,
  ): AsyncGenerator<StreamResponse, void, undefined> {
    const stream = this.client.SubscribeToTask(
      conv.subscribeToTaskRequest.toProto(params),
      this.timeout,
      this.metadata(options),
    );
    for await (const response of stream) {
      yield conv.streamResponse.toSdk(response);
    }
  }

  async createTaskPushNotificationConfig(
    params: TaskPushNotificationConfig,
    options?: RequestOptions,
  ): Promise<TaskPushNotificationConfig> {
    return conv.taskPushNotificationConfig.toSdk(
      await this.client.CreateTaskPushNotificationConfig(
        conv.taskPushNotificationConfig.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }

  async getTaskPushNotificationConfig(
    params: GetTaskPushNotificationConfigRequest,
    options?: RequestOptions,
  ): Promise<TaskPushNotificationConfig> {
    return conv.taskPushNotificationConfig.toSdk(
      await this.client.GetTaskPushNotificationConfig(
        conv.getTaskPushNotificationConfigRequest.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }

  async listTaskPushNotificationConfig(
    params: ListTaskPushNotificationConfigsRequest,
    options?: RequestOptions,
  ): Promise<ListTaskPushNotificationConfigsResponse> {
    return conv.listTaskPushNotificationConfigsResponse.toSdk(
      await this.client.ListTaskPushNotificationConfigs(
        conv.listTaskPushNotificationConfigsRequest.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }

  async deleteTaskPushNotificationConfig(
    params: DeleteTaskPushNotificationConfigRequest,
    options?: RequestOptions,
  ): Promise<void> {
    await this.client.DeleteTaskPushNotificationConfig(
      conv.deleteTaskPushNotificationConfigRequest.toProto(params),
      this.timeout,
      this.metadata(options),
    );
  }

  async getExtendedAgentCard(
    params: GetExtendedAgentCardRequest,
    options?: RequestOptions,
  ): Promise<AgentCard> {
    // If we already hold a card that does not advertise an extended card,
    // serve it locally rather than round-tripping (mirrors slim-a2a-python).
    if (this.agentCard && !this.agentCard.capabilities?.extendedAgentCard) {
      return this.agentCard;
    }
    return conv.agentCard.toSdk(
      await this.client.GetExtendedAgentCard(
        conv.getExtendedAgentCardRequest.toProto(params),
        this.timeout,
        this.metadata(options),
      ),
    );
  }
}

/**
 * A {@link TransportFactory} that produces {@link SRPCTransport}s. Register it
 * with the SDK's `ClientFactory`:
 *
 * ```ts
 * const factory = new ClientFactory({ transports: [new SRPCTransportFactory(app, connId)] });
 * const client = await factory.createFromAgentCard(card);
 * ```
 *
 * The agent card's slimrpc `AgentInterface.url` must be a SLIM name
 * (`"organization/namespace/app"`).
 */
export class SRPCTransportFactory implements TransportFactory {
  constructor(
    private readonly app: AppLike,
    private readonly connId: bigint,
    private readonly options: SRPCTransportOptions = {},
  ) {}

  get protocolName(): string {
    return SLIMRPC_PROTOCOL;
  }

  async create(url: string, agentCard: AgentCard): Promise<Transport> {
    return new SRPCTransport(
      slimChannel(this.app, url, this.connId),
      agentCard,
      this.options,
    );
  }
}

/** A response from one member of a multicast group. */
export interface MulticastResponse<T> {
  /** The SLIM name of the responding agent. */
  source: string;
  response: T;
}

/**
 * A multicast client for querying several A2A agents simultaneously over a
 * SLIM group channel, mirroring slim-a2a-python's `MulticastClient`. Each
 * method yields one `{ source, response }` per responding member.
 */
export class SRPCMulticastClient {
  private readonly group: A2AServiceGroupClient;

  constructor(
    channel: ChannelLike,
    private readonly options: SRPCTransportOptions = {},
  ) {
    this.group = new A2AServiceGroupClient(channel);
  }

  /** Builds a multicast client targeting the given SLIM agent names. */
  static create(
    app: AppLike,
    connId: bigint,
    remotes: string[],
    options?: SRPCTransportOptions,
  ): SRPCMulticastClient {
    return new SRPCMulticastClient(slimGroupChannel(app, remotes, connId), options);
  }

  async *sendMessage(
    params: SendMessageRequest,
  ): AsyncGenerator<MulticastResponse<SendMessageResult>, void, undefined> {
    const stream = this.group.SendMessage(
      conv.sendMessageRequest.toProto(params),
      this.options.timeout,
      this.options.metadata,
    );
    for await (const { context, response } of stream) {
      yield {
        source: String(context.source),
        response: conv.sendMessageResponseToResult(response),
      };
    }
  }

  async *sendMessageStream(
    params: SendMessageRequest,
  ): AsyncGenerator<MulticastResponse<StreamResponse>, void, undefined> {
    const stream = this.group.SendStreamingMessage(
      conv.sendMessageRequest.toProto(params),
      this.options.timeout,
      this.options.metadata,
    );
    for await (const { context, response } of stream) {
      yield {
        source: String(context.source),
        response: conv.streamResponse.toSdk(response),
      };
    }
  }
}
