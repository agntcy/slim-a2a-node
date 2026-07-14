// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * End-to-end proof: an A2A message round-trips over SLIM. Stands up an
 * in-process SLIM node, an echo agent served through {@link SRPCHandler}, and a
 * client built with {@link createSlimClient}, then asserts the echoed reply.
 *
 * The server and client apps share a single broker connection here because
 * everything runs in one process on the global SLIM service; separate processes
 * (as in the example) each connect independently via `setupSlimClient`.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Name,
  newInsecureClientConfig,
  Server,
  type AppLike,
  type ServerLike,
} from '@agntcy/slim-bindings';
import {
  AgentCard,
  SendMessageRequest,
  type Message,
  type StreamResponse,
} from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import {
  createSlimClient,
  DEFAULT_SECRET,
  initializeSlim,
  registerSlimA2AHandler,
  SRPCHandler,
  startSlimBroker,
} from '../src/index.js';
import { EchoAgentExecutor } from '../examples/echo-agent/echoAgentExecutor.js';

const PORT = 46411;
const SLIM_URL = `http://127.0.0.1:${PORT}`;
const AGENT = 'echo_agent';
const REMOTE = `agntcy/demo/${AGENT}`;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const agentCard = AgentCard.fromJSON({
  name: 'Echo Agent',
  description: 'Echoes back the received message over SLIM.',
  version: '1.0.0',
  capabilities: { streaming: true },
  supportedInterfaces: [
    { url: REMOTE, protocolBinding: 'slimrpc', protocolVersion: '1.0' },
  ],
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [{ id: 'echo', name: 'Echo', description: 'Echoes text.', tags: ['echo'] }],
});

let server: ServerLike;
let clientApp: AppLike;
let clientConnId: bigint;

function makeRequest(text: string): SendMessageRequest {
  return SendMessageRequest.fromJSON({
    message: { messageId: randomUUID(), role: 'ROLE_USER', parts: [{ text }] },
  });
}

beforeAll(async () => {
  startSlimBroker(`127.0.0.1:${PORT}`);
  await sleep(300);

  const service = initializeSlim();
  // A single connection shared by both in-process apps.
  clientConnId = BigInt(await service.connectAsync(newInsecureClientConfig(SLIM_URL)));

  // Server app + slimrpc service.
  const serverName = new Name('agntcy', 'demo', AGENT);
  const serverApp = service.createAppWithSecret(serverName, DEFAULT_SECRET);
  await serverApp.subscribeAsync(serverName, clientConnId);
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    new EchoAgentExecutor(),
  );
  server = Server.newWithConnection(serverApp, serverName, clientConnId);
  registerSlimA2AHandler(server, new SRPCHandler(agentCard, requestHandler));
  server.serveAsync().catch((err) => console.error('serve error', err));

  // Client app on the same connection.
  const clientName = new Name('agntcy', 'demo', 'client');
  clientApp = service.createAppWithSecret(clientName, DEFAULT_SECRET);
  await clientApp.subscribeAsync(clientName, clientConnId);

  await sleep(300);
}, 30_000);

afterAll(async () => {
  try {
    await server?.shutdownAsync();
  } catch {
    // ignore shutdown races
  }
});

describe('echo agent over SLIM', () => {
  it('round-trips a non-streaming sendMessage', async () => {
    const client = await createSlimClient(clientApp, clientConnId, agentCard);

    const result = await client.sendMessage(makeRequest('hello over slim'));

    expect('parts' in result).toBe(true);
    const part = (result as Message).parts[0];
    expect(part?.content?.$case).toBe('text');
    expect(part?.content?.$case === 'text' ? part.content.value : null).toBe(
      'hello over slim',
    );
  }, 30_000);

  it('round-trips a streaming sendMessageStream', async () => {
    const client = await createSlimClient(clientApp, clientConnId, agentCard);

    const events: StreamResponse[] = [];
    for await (const event of client.sendMessageStream(makeRequest('streamed hi'))) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    const texts = events
      .map((e) => (e.payload?.$case === 'message' ? e.payload.value : undefined))
      .filter((m): m is Message => m !== undefined)
      .flatMap((m) => m.parts)
      .map((p) => (p.content?.$case === 'text' ? p.content.value : ''));
    expect(texts).toContain('streamed hi');
  }, 30_000);
});
