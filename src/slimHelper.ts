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
  type ClientConfig,
  type IdentityProviderConfig,
  type IdentityVerifierConfig,
  type NameLike,
  type ServiceLike,
} from './slimBindings.js';

/** Default SLIM node endpoint used by clients. */
export const DEFAULT_SLIM_URL = 'http://localhost:46357';

/**
 * A SLIM app identity: how this app proves who it is to others (`provider`) and
 * how it verifies the identity of its peers (`verifier`). Passed straight to
 * `Service.createApp`, so any provider/verifier the bindings support works —
 * shared secret, static or signed JWT (incl. EdDSA), JWKS-based verification or
 * SPIRE.
 */
export interface SlimIdentity {
  provider: IdentityProviderConfig;
  verifier: IdentityVerifierConfig;
}

/**
 * Options for {@link connectAndSubscribe} / {@link setupSlimClient}.
 *
 * Exactly one of `secret` or `identity` is required; there is no default
 * credential. At most one of `slimUrl` or `clientConfig` may be given.
 */
export interface ConnectOptions {
  /**
   * SLIM node URL to connect to over an insecure (plaintext, unauthenticated)
   * connection. Defaults to {@link DEFAULT_SLIM_URL} when `clientConfig` is not
   * set.
   */
  slimUrl?: string;
  /**
   * Full client configuration for the node connection (TLS, bearer/JWT/basic
   * auth, headers, timeouts, ...), e.g. built with `newSecureClientConfig` or
   * `ClientConfig.create`. Takes the place of `slimUrl`.
   */
  clientConfig?: ClientConfig;
  /** Shared secret for app creation (>= 32 chars). Mutually exclusive with `identity`. */
  secret?: string;
  /** Identity provider/verifier for app creation. Mutually exclusive with `secret`. */
  identity?: SlimIdentity;
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
 * Validates {@link ConnectOptions} and resolves the client config to dial.
 * Throws before any connection is opened when the options are ambiguous or no
 * credential was supplied.
 */
function resolveConnectOptions(options: ConnectOptions | undefined): {
  clientConfig: ClientConfig;
  createApp: (service: ServiceLike, name: NameLike) => AppLike;
} {
  // `?? {}` so untyped (JS) callers that omit the options get the clear error below.
  const { slimUrl, clientConfig, secret, identity } = options ?? {};
  if (slimUrl !== undefined && clientConfig !== undefined) {
    throw new Error(
      'ConnectOptions: pass either `slimUrl` or `clientConfig`, not both ' +
        '(`clientConfig.endpoint` sets the node URL).',
    );
  }
  if (secret !== undefined && identity !== undefined) {
    throw new Error('ConnectOptions: pass either `secret` or `identity`, not both.');
  }
  let createApp: (service: ServiceLike, name: NameLike) => AppLike;
  if (identity !== undefined) {
    createApp = (service, name) =>
      service.createApp(name, identity.provider, identity.verifier);
  } else if (secret) {
    createApp = (service, name) => service.createAppWithSecret(name, secret);
  } else {
    throw new Error(
      'ConnectOptions: a SLIM credential is required. Pass `secret` (shared ' +
        'secret, >= 32 chars) or `identity` ({ provider, verifier }). There is ' +
        'no default secret.',
    );
  }
  return {
    clientConfig: clientConfig ?? newInsecureClientConfig(slimUrl ?? DEFAULT_SLIM_URL),
    createApp,
  };
}

/**
 * Connects to a SLIM node, creates an app for `localName` with the configured
 * identity (shared secret or provider/verifier), and subscribes it to its own
 * name so it can receive traffic.
 *
 * @throws if neither `secret` nor `identity` is given, or if conflicting
 *   options are passed (see {@link ConnectOptions}).
 * @returns the created app and the connection id (a `bigint`).
 */
export async function connectAndSubscribe(
  service: ServiceLike,
  localName: NameLike,
  options: ConnectOptions,
): Promise<{ app: AppLike; connId: bigint }> {
  const { clientConfig, createApp } = resolveConnectOptions(options);
  const connId = BigInt(await service.connectAsync(clientConfig));
  const app = createApp(service, localName);
  await app.subscribeAsync(localName, connId);
  return { app, connId };
}

/**
 * Complete SLIM client setup in one call: initialise the service, build the
 * `namespace/group/name` identity, connect and subscribe.
 *
 * @example
 * ```ts
 * const { app, name, connId } = await setupSlimClient('agntcy', 'demo', 'echo_agent', {
 *   secret: process.env.SLIM_SHARED_SECRET,
 * });
 * ```
 */
export async function setupSlimClient(
  namespace: string,
  group: string,
  name: string,
  options: ConnectOptions,
): Promise<SlimClient> {
  // Validate before touching the global service so misconfiguration fails fast.
  resolveConnectOptions(options);
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
