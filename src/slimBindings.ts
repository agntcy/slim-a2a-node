// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Combined view of the `@agntcy/slim-bindings` 2.0 API.
 *
 * As of bindings 2.0.0 the slimrpc API (`Channel`, `Server`, `RpcError`, the
 * handler interfaces, ...) lives in a second UniFFI namespace, `slim_rpc`.
 * Its *values* are re-exported from the package root at runtime, but the
 * package's type entry point only re-exports the core `slim_bindings`
 * namespace, so TypeScript cannot see them under
 * `import { Channel } from '@agntcy/slim-bindings'`.
 *
 * This module restores the single surface the generated slimrpc stubs and the
 * rest of this SDK are written against: runtime values come from the package
 * root, slimrpc types from `@agntcy/slim-bindings/types/slim_rpc`. Once the
 * bindings package re-exports `types/slim_rpc` from its root, this module can
 * collapse to a plain `export * from '@agntcy/slim-bindings'`.
 */
import * as slim from '@agntcy/slim-bindings';
import type * as slimRpc from '@agntcy/slim-bindings/types/slim_rpc.js';

/** The core `slim_bindings` namespace (`Name`, `Service`, `App`, config helpers, ...). */
export * from '@agntcy/slim-bindings';
/**
 * The same core namespace, types only, taken from the declaration file the
 * package root points at. Both re-exports resolve to one set of declarations,
 * so this adds no ambiguity — it keeps the core types reachable for consumers
 * on `node16`/`nodenext` resolution, which rejects the extensionless relative
 * re-export in the package's own `index.d.ts`.
 */
export type * from '@agntcy/slim-bindings/types/slim_bindings.js';
/** The `slim_rpc` namespace, types only — its values are re-exported below. */
export type * from '@agntcy/slim-bindings/types/slim_rpc.js';

/**
 * The slimrpc values as they exist on the package root at runtime. The cast
 * supplies the types that the package's own root declaration file omits; it is
 * checked against the real `slim_rpc` declarations, so a drift in either
 * namespace surfaces here.
 */
const rpc = slim as unknown as typeof slimRpc;

// Each slimrpc name carries both a value and a type meaning, and a local value
// export shadows the `export type *` above for that name — so both sides are
// re-stated here. The value annotations are `typeof` queries rather than
// inferred types so that declaration emit can name them without reaching for
// the runtime's internal `@ubjs/core` symbols.
export const BidiStreamHandler: typeof slimRpc.BidiStreamHandler =
  rpc.BidiStreamHandler;
export type BidiStreamHandler = slimRpc.BidiStreamHandler;

export const Channel: typeof slimRpc.Channel = rpc.Channel;
export type Channel = slimRpc.Channel;

export const Context: typeof slimRpc.Context = rpc.Context;
export type Context = slimRpc.Context;

export const MulticastBidiStreamHandler: typeof slimRpc.MulticastBidiStreamHandler =
  rpc.MulticastBidiStreamHandler;
export type MulticastBidiStreamHandler = slimRpc.MulticastBidiStreamHandler;

export const MulticastResponseReader: typeof slimRpc.MulticastResponseReader =
  rpc.MulticastResponseReader;
export type MulticastResponseReader = slimRpc.MulticastResponseReader;

export const MulticastStreamMessage: typeof slimRpc.MulticastStreamMessage =
  rpc.MulticastStreamMessage;
export type MulticastStreamMessage = slimRpc.MulticastStreamMessage;

export const MulticastStreamMessage_Tags: typeof slimRpc.MulticastStreamMessage_Tags =
  rpc.MulticastStreamMessage_Tags;
export type MulticastStreamMessage_Tags = slimRpc.MulticastStreamMessage_Tags;

export const RequestStream: typeof slimRpc.RequestStream = rpc.RequestStream;
export type RequestStream = slimRpc.RequestStream;

export const RequestStreamWriter: typeof slimRpc.RequestStreamWriter =
  rpc.RequestStreamWriter;
export type RequestStreamWriter = slimRpc.RequestStreamWriter;

export const ResponseSink: typeof slimRpc.ResponseSink = rpc.ResponseSink;
export type ResponseSink = slimRpc.ResponseSink;

export const ResponseStreamReader: typeof slimRpc.ResponseStreamReader =
  rpc.ResponseStreamReader;
export type ResponseStreamReader = slimRpc.ResponseStreamReader;

export const RpcCode: typeof slimRpc.RpcCode = rpc.RpcCode;
export type RpcCode = slimRpc.RpcCode;

export const RpcError: typeof slimRpc.RpcError = rpc.RpcError;
export type RpcError = slimRpc.RpcError;

export const RpcError_Tags: typeof slimRpc.RpcError_Tags = rpc.RpcError_Tags;
export type RpcError_Tags = slimRpc.RpcError_Tags;

export const RpcMessageContext: typeof slimRpc.RpcMessageContext =
  rpc.RpcMessageContext;
export type RpcMessageContext = slimRpc.RpcMessageContext;

export const RpcMulticastItem: typeof slimRpc.RpcMulticastItem = rpc.RpcMulticastItem;
export type RpcMulticastItem = slimRpc.RpcMulticastItem;

export const Server: typeof slimRpc.Server = rpc.Server;
export type Server = slimRpc.Server;

export const StreamMessage: typeof slimRpc.StreamMessage = rpc.StreamMessage;
export type StreamMessage = slimRpc.StreamMessage;

export const StreamMessage_Tags: typeof slimRpc.StreamMessage_Tags =
  rpc.StreamMessage_Tags;
export type StreamMessage_Tags = slimRpc.StreamMessage_Tags;

export const StreamStreamHandlerImpl: typeof slimRpc.StreamStreamHandlerImpl =
  rpc.StreamStreamHandlerImpl;
export type StreamStreamHandlerImpl = slimRpc.StreamStreamHandlerImpl;

export const StreamUnaryHandlerImpl: typeof slimRpc.StreamUnaryHandlerImpl =
  rpc.StreamUnaryHandlerImpl;
export type StreamUnaryHandlerImpl = slimRpc.StreamUnaryHandlerImpl;

export const UnaryStreamHandlerImpl: typeof slimRpc.UnaryStreamHandlerImpl =
  rpc.UnaryStreamHandlerImpl;
export type UnaryStreamHandlerImpl = slimRpc.UnaryStreamHandlerImpl;

export const UnaryUnaryHandlerImpl: typeof slimRpc.UnaryUnaryHandlerImpl =
  rpc.UnaryUnaryHandlerImpl;
export type UnaryUnaryHandlerImpl = slimRpc.UnaryUnaryHandlerImpl;
