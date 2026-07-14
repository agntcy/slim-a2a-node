// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * slim-a2a: a SLIM (slimrpc) transport for the A2A protocol, plugging into the
 * official `@a2a-js/sdk`.
 *
 * - Client: {@link SRPCTransport} / {@link SRPCTransportFactory} implement the
 *   SDK's `Transport` / `TransportFactory`.
 * - Server: {@link SRPCHandler} bridges an SDK `A2ARequestHandler` onto the
 *   generated slimrpc servicer; register it with {@link registerSlimA2AHandler}.
 * - Bootstrap: {@link setupSlimClient} and friends handle SLIM init/connect.
 */
import { Client, ClientFactory, type ClientConfig } from '@a2a-js/sdk/client';
import type { AgentCard } from '@a2a-js/sdk';
import type { AppLike } from '@agntcy/slim-bindings';
import {
  SRPCTransport,
  SRPCTransportFactory,
  type SRPCTransportOptions,
} from './clientTransport.js';

export * from './slimHelper.js';
export * from './clientTransport.js';
export * from './handler.js';
export { toRpcError } from './errors.js';

/** Low-level protobuf-es message types + slimrpc stubs for A2A v1.0.0. */
export * as v1 from './types/v1/index.js';
/** JSON-bridge conversions between SDK domain objects and protobuf-es messages. */
export * as conversions from './conversions.js';

/** Options for {@link createSlimClient}. */
export interface CreateSlimClientOptions {
  /** Per-transport call options (timeout, metadata, protocol version). */
  transport?: SRPCTransportOptions;
  /** SDK client configuration. */
  clientConfig?: ClientConfig;
}

/**
 * Builds an A2A SDK {@link Client} that talks to a single agent over SLIM.
 *
 * The agent card's slimrpc `AgentInterface.url` must be a SLIM name
 * (`"organization/namespace/app"`). Uses the SDK's `ClientFactory` under the
 * hood so transport selection follows the card's declared interfaces.
 *
 * @example
 * ```ts
 * const { app, connId } = await setupSlimClient('agntcy', 'demo', 'client');
 * const client = await createSlimClient(app, connId, agentCard);
 * const result = await client.sendMessage({ request: message });
 * ```
 */
export async function createSlimClient(
  app: AppLike,
  connId: bigint,
  agentCard: AgentCard,
  options: CreateSlimClientOptions = {},
): Promise<Client> {
  const factory = new ClientFactory({
    transports: [new SRPCTransportFactory(app, connId, options.transport)],
    clientConfig: options.clientConfig,
  });
  return factory.createFromAgentCard(agentCard);
}
