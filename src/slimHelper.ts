// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Helpers for initialising and connecting to SLIM, mirroring the DX of
 * slim-a2a-python's `slim_helper.py`.
 */
import {
  getGlobalService,
  initializeWithDefaults,
  Name,
  newInsecureClientConfig,
  newInsecureServerConfig,
  type AppLike,
  type NameLike,
  type ServiceLike,
} from './slimBindings.js';

/** Default SLIM node endpoint used by clients. */
export const DEFAULT_SLIM_URL = 'http://localhost:46357';

/**
 * Default shared secret for app creation. Matches the placeholder used by the
 * sibling SDKs so agents across languages interoperate out of the box. It is a
 * development default only — supply your own in production. Must be >= 32 chars.
 */
export const DEFAULT_SECRET = 'secretsecretsecretsecretsecretsecret';

/** Options for {@link connectAndSubscribe} / {@link setupSlimClient}. */
export interface ConnectOptions {
  /** SLIM node URL to connect to. Defaults to {@link DEFAULT_SLIM_URL}. */
  slimUrl?: string;
  /** Shared secret for app creation. Defaults to {@link DEFAULT_SECRET}. */
  secret?: string;
}

/** The result of a full {@link setupSlimClient} bootstrap. */
export interface SlimClient {
  service: ServiceLike;
  app: AppLike;
  name: NameLike;
  connId: bigint;
}

let initialized = false;

/** Runs the one-time global SLIM initialisation at most once per process. */
function ensureInitialized(): void {
  if (!initialized) {
    initializeWithDefaults();
    initialized = true;
  }
}

/**
 * Initialises the global SLIM service with default tracing/runtime/service
 * configuration and returns it. Idempotent — safe to call more than once.
 */
export function initializeSlim(): ServiceLike {
  ensureInitialized();
  return getGlobalService();
}

/**
 * Connects to a SLIM node, creates a shared-secret app for `localName`, and
 * subscribes it to its own name so it can receive traffic.
 *
 * @returns the created app and the connection id (a `bigint`).
 */
export async function connectAndSubscribe(
  service: ServiceLike,
  localName: NameLike,
  options: ConnectOptions = {},
): Promise<{ app: AppLike; connId: bigint }> {
  const { slimUrl = DEFAULT_SLIM_URL, secret = DEFAULT_SECRET } = options;
  const connId = BigInt(await service.connectAsync(newInsecureClientConfig(slimUrl)));
  const app = service.createAppWithSecret(localName, secret);
  await app.subscribeAsync(localName, connId);
  return { app, connId };
}

/**
 * Complete SLIM client setup in one call: initialise the service, build the
 * `namespace/group/name` identity, connect and subscribe.
 *
 * @example
 * ```ts
 * const { app, name, connId } = await setupSlimClient('agntcy', 'demo', 'echo_agent');
 * ```
 */
export async function setupSlimClient(
  namespace: string,
  group: string,
  name: string,
  options: ConnectOptions = {},
): Promise<SlimClient> {
  const service = initializeSlim();
  const localName = new Name(namespace, group, name);
  const { app, connId } = await connectAndSubscribe(service, localName, options);
  return { service, app, name: localName, connId };
}

/**
 * Starts an in-process SLIM node (broker) bound to `endpoint`. Intended for
 * local development and tests — production deployments run a standalone SLIM
 * node. Non-blocking: the node runs on a background task.
 */
export function startSlimBroker(endpoint = '0.0.0.0:46357'): void {
  ensureInitialized();
  getGlobalService().runServer(newInsecureServerConfig(endpoint));
}
