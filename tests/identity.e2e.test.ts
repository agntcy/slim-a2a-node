// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * End-to-end: an agent bootstrapped through {@link connectAndSubscribe} with a
 * JWT identity (EdDSA / Ed25519) instead of a shared secret serves an A2A
 * message from a JWT-identified client over an in-process SLIM node, and the
 * handler sees the client's verified `sub` / `iss`.
 */
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  IdentityProviderConfig,
  IdentityVerifierConfig,
  JwtAlgorithm,
  JwtKeyData,
  JwtKeyFormat,
  JwtKeyType,
  Name,
  Server,
  type AppLike,
  type ServerLike,
} from '../src/slimBindings.js';
import { AgentCard, SendMessageRequest, type Message } from '@a2a-js/sdk';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  type ExecutionEventBus,
  type RequestContext,
  type User,
} from '@a2a-js/sdk/server';
import {
  connectAndSubscribe,
  createSlimClient,
  initializeSlim,
  registerSlimA2AHandler,
  SlimAuthenticatedUser,
  SRPCHandler,
  startSlimBroker,
  type SlimIdentity,
} from '../src/index.js';
import { EchoAgentExecutor } from '../examples/echo-agent/echoAgentExecutor.js';

const PORT = 46412;
const SLIM_URL = `http://127.0.0.1:${PORT}`;
const ISSUER = 'slim-a2a-node-test';
const AUDIENCE = ['agntcy/demo'];
const REMOTE = 'agntcy/demo/jwt_echo_agent';
const CLIENT = 'agntcy/demo/jwt_client';

/** Echo executor that records the caller the handler saw for each request. */
class RecordingEchoExecutor extends EchoAgentExecutor {
  readonly users: (User | undefined)[] = [];

  override async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    this.users.push(requestContext.context.user);
    return super.execute(requestContext, eventBus);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// One Ed25519 signing key acts as the trust root for this test mesh.
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function jwtIdentity(subject: string, signingKey = privateKey): SlimIdentity {
  const keyConfig = (pem: string) => ({
    algorithm: JwtAlgorithm.EdDsa,
    format: JwtKeyFormat.Pem,
    key: new JwtKeyData.Data({ value: pem }),
  });
  return {
    provider: new IdentityProviderConfig.Jwt({
      config: {
        key: new JwtKeyType.Encoding({ key: keyConfig(signingKey) }),
        issuer: ISSUER,
        audience: AUDIENCE,
        subject,
        duration: 3_600_000,
      },
    }),
    verifier: new IdentityVerifierConfig.Jwt({
      config: {
        key: new JwtKeyType.Decoding({ key: keyConfig(publicKey) }),
        issuer: ISSUER,
        audience: AUDIENCE,
        duration: 3_600_000,
      },
    }),
  };
}

const agentCard = AgentCard.fromJSON({
  name: 'JWT Echo Agent',
  description: 'Echo agent authenticated with a JWT identity.',
  version: '1.0.0',
  capabilities: { streaming: false },
  supportedInterfaces: [
    { url: REMOTE, protocolBinding: 'slimrpc', protocolVersion: '1.0' },
  ],
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [],
});

let server: ServerLike;
const executor = new RecordingEchoExecutor();
let clientApp: AppLike;
let clientConnId: bigint;

beforeAll(async () => {
  startSlimBroker(`127.0.0.1:${PORT}`);
  await sleep(300);
  const service = initializeSlim();

  const serverName = new Name('agntcy', 'demo', 'jwt_echo_agent');
  const srv = await connectAndSubscribe(service, serverName, {
    slimUrl: SLIM_URL,
    identity: jwtIdentity(REMOTE),
  });
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    executor,
  );
  server = Server.newWithConnection(srv.app, serverName, srv.connId);
  registerSlimA2AHandler(server, new SRPCHandler(agentCard, requestHandler));
  server.serveAsync().catch((err) => console.error('serve error', err));

  // The global service holds one connection per node endpoint, so the
  // in-process client app reuses the server's connection (separate processes
  // would each call connectAndSubscribe).
  const clientName = new Name('agntcy', 'demo', 'jwt_client');
  const { provider, verifier } = jwtIdentity(CLIENT);
  clientApp = service.createApp(clientName, provider, verifier);
  clientConnId = srv.connId;
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

describe('JWT identity over SLIM', () => {
  it('round-trips sendMessage between JWT-identified agents', async () => {
    const client = await createSlimClient(clientApp, clientConnId, agentCard);
    const result = await client.sendMessage(
      SendMessageRequest.fromJSON({
        message: {
          messageId: randomUUID(),
          role: 'ROLE_USER',
          parts: [{ text: 'hello with jwt' }],
        },
      }),
    );
    const part = (result as Message).parts[0];
    expect(part?.content?.$case === 'text' ? part.content.value : null).toBe(
      'hello with jwt',
    );

    // The handler sees the client's verified JWT identity, not the agent's own.
    const user = executor.users.at(-1);
    expect(user).toBeInstanceOf(SlimAuthenticatedUser);
    expect(user?.isAuthenticated).toBe(true);
    expect(user?.userName).toBe(CLIENT);
    expect((user as SlimAuthenticatedUser).subject).toBe(CLIENT);
    expect((user as SlimAuthenticatedUser).issuer).toBe(ISSUER);
  }, 30_000);

  it('rejects a caller whose JWT is signed by an untrusted key', async () => {
    const service = initializeSlim();
    const rogueKey = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
    const rogueName = new Name('agntcy', 'demo', 'jwt_rogue');
    const { provider, verifier } = jwtIdentity('agntcy/demo/jwt_rogue', rogueKey);
    const rogueApp = service.createApp(rogueName, provider, verifier);
    await rogueApp.subscribeAsync(rogueName, clientConnId);
    const client = await createSlimClient(rogueApp, clientConnId, agentCard, {
      transport: { timeout: 3_000 },
    });
    await expect(
      client.sendMessage(
        SendMessageRequest.fromJSON({
          message: {
            messageId: randomUUID(),
            role: 'ROLE_USER',
            parts: [{ text: 'x' }],
          },
        }),
      ),
    ).rejects.toThrow();
  }, 30_000);
});
