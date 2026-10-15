// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for {@link DefaultCallContextBuilder}'s caller identity, against a
 * fake slimrpc `Context` so no SLIM node is needed.
 */
import { describe, expect, it } from 'vitest';
import { HTTP_EXTENSION_HEADER } from '@a2a-js/sdk';
import { UnauthenticatedUser } from '@a2a-js/sdk/server';
import type { ContextLike } from '../src/slimBindings.js';
import {
  callerUser,
  DefaultCallContextBuilder,
  SlimAuthenticatedUser,
} from '../src/index.js';

function fakeContext(
  peer: { subject?: string; issuer?: string },
  metadata: Record<string, string> = {},
): ContextLike {
  return {
    peerSubject: () => peer.subject,
    peerIssuer: () => peer.issuer,
    metadata: () => new Map(Object.entries(metadata)),
  } as unknown as ContextLike;
}

describe('DefaultCallContextBuilder caller identity', () => {
  const builder = new DefaultCallContextBuilder();

  it('authenticates the caller from the verified subject and issuer', () => {
    const ctx = builder.build(
      fakeContext({ subject: 'agntcy/demo/client', issuer: 'agntcy' }),
    );
    expect(ctx.user).toBeInstanceOf(SlimAuthenticatedUser);
    expect(ctx.user?.isAuthenticated).toBe(true);
    expect(ctx.user?.userName).toBe('agntcy/demo/client');
    const user = ctx.user as SlimAuthenticatedUser;
    expect(user.subject).toBe('agntcy/demo/client');
    expect(user.issuer).toBe('agntcy');
  });

  it('leaves the issuer unset when the token has none', () => {
    const user = callerUser(fakeContext({ subject: 'agntcy/demo/client', issuer: '' }));
    expect(user).toBeInstanceOf(SlimAuthenticatedUser);
    expect((user as SlimAuthenticatedUser).issuer).toBeUndefined();
  });

  it('falls back to UnauthenticatedUser without a verified subject', () => {
    for (const peer of [{}, { subject: '' }, { issuer: 'agntcy' }]) {
      const ctx = builder.build(fakeContext(peer));
      expect(ctx.user).toBeInstanceOf(UnauthenticatedUser);
      expect(ctx.user?.isAuthenticated).toBe(false);
    }
  });

  it('never takes the identity from caller-supplied metadata', () => {
    const ctx = builder.build(
      fakeContext(
        {},
        { sub: 'mallory', iss: 'evil', user: 'mallory', authorization: 'Bearer x' },
      ),
    );
    expect(ctx.user).toBeInstanceOf(UnauthenticatedUser);
  });

  it('still parses requested extensions and tenant', () => {
    const ctx = builder.build(
      fakeContext(
        { subject: 'agntcy/demo/client' },
        { [HTTP_EXTENSION_HEADER]: ' urn:a , urn:b ,' },
      ),
      'tenant-1',
    );
    expect(ctx.requestedExtensions).toEqual(['urn:a', 'urn:b']);
    expect(ctx.tenant).toBe('tenant-1');
  });
});
