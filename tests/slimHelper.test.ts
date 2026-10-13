// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for {@link connectAndSubscribe}'s option handling, against a fake
 * `ServiceLike` so no SLIM node is needed.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  IdentityProviderConfig,
  IdentityVerifierConfig,
  Name,
  newSecureClientConfig,
  type ClientConfig,
  type ServiceLike,
} from '../src/slimBindings.js';
import {
  connectAndSubscribe,
  DEFAULT_SLIM_URL,
  type ConnectOptions,
} from '../src/index.js';
import * as helper from '../src/slimHelper.js';

const SECRET = 'unit-test-secret-unit-test-secret-0123';

function fakeService() {
  const app = { subscribeAsync: vi.fn(async () => {}) };
  const service = {
    connectAsync: vi.fn(async (_cfg: ClientConfig) => 7n),
    createApp: vi.fn(() => app),
    createAppWithSecret: vi.fn(() => app),
  };
  return { service, app, asService: service as unknown as ServiceLike };
}

const name = new Name('agntcy', 'test', 'unit');

describe('connectAndSubscribe options', () => {
  it('rejects a call with no credential, before connecting', async () => {
    const { service, asService } = fakeService();
    await expect(connectAndSubscribe(asService, name, {})).rejects.toThrow(
      /credential is required/,
    );
    // Untyped callers that omit the options entirely get the same error.
    await expect(
      connectAndSubscribe(asService, name, undefined as unknown as ConnectOptions),
    ).rejects.toThrow(/credential is required/);
    await expect(connectAndSubscribe(asService, name, { secret: '' })).rejects.toThrow(
      /credential is required/,
    );
    expect(service.connectAsync).not.toHaveBeenCalled();
  });

  it('rejects conflicting options', async () => {
    const { service, asService } = fakeService();
    const identity = {
      provider: new IdentityProviderConfig.SharedSecret({ id: 'a', data: SECRET }),
      verifier: new IdentityVerifierConfig.SharedSecret({ id: 'a', data: SECRET }),
    };
    await expect(
      connectAndSubscribe(asService, name, { secret: SECRET, identity }),
    ).rejects.toThrow(/either `secret` or `identity`/);
    await expect(
      connectAndSubscribe(asService, name, {
        secret: SECRET,
        slimUrl: 'http://x:1',
        clientConfig: newSecureClientConfig('https://x:1'),
      }),
    ).rejects.toThrow(/either `slimUrl` or `clientConfig`/);
    expect(service.connectAsync).not.toHaveBeenCalled();
  });

  it('uses a shared secret over an insecure connection to the default URL', async () => {
    const { service, app, asService } = fakeService();
    const { connId } = await connectAndSubscribe(asService, name, { secret: SECRET });
    expect(connId).toBe(7n);
    expect(service.connectAsync.mock.calls[0][0].endpoint).toBe(DEFAULT_SLIM_URL);
    expect(service.connectAsync.mock.calls[0][0].tls.insecure).toBe(true);
    expect(service.createAppWithSecret).toHaveBeenCalledWith(name, SECRET);
    expect(service.createApp).not.toHaveBeenCalled();
    expect(app.subscribeAsync).toHaveBeenCalledWith(name, 7n);
  });

  it('passes an identity and a full client config through', async () => {
    const { service, asService } = fakeService();
    const provider = new IdentityProviderConfig.SharedSecret({ id: 'a', data: SECRET });
    const verifier = new IdentityVerifierConfig.SharedSecret({ id: 'a', data: SECRET });
    const clientConfig = newSecureClientConfig('https://slim.example:443');
    await connectAndSubscribe(asService, name, {
      clientConfig,
      identity: { provider, verifier },
    });
    expect(service.connectAsync).toHaveBeenCalledWith(clientConfig);
    expect(service.createApp).toHaveBeenCalledWith(name, provider, verifier);
    expect(service.createAppWithSecret).not.toHaveBeenCalled();
  });

  it('no longer exports a default secret', () => {
    expect('DEFAULT_SECRET' in helper).toBe(false);
  });
});
