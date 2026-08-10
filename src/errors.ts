// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Maps A2A SDK server errors onto slimrpc {@link RpcError}s, mirroring the
 * error handling in slim-a2a-python's `handler.py`.
 */
import { RpcCode, RpcError } from './slimBindings.js';
import {
  ContentTypeNotSupportedError,
  ExtendedAgentCardNotConfiguredError,
  InvalidAgentResponseError,
  PushNotificationNotSupportedError,
  RequestMalformedError,
  TaskNotCancelableError,
  TaskNotFoundError,
  UnsupportedOperationError,
  VersionNotSupportedError,
} from '@a2a-js/sdk/server';

type ErrorCtor = new (...args: never[]) => Error;

/** A2A SDK error class -> slimrpc status code. */
const ERROR_CODE_MAP: Array<[ErrorCtor, RpcCode]> = [
  [RequestMalformedError, RpcCode.InvalidArgument],
  [ContentTypeNotSupportedError, RpcCode.InvalidArgument],
  [TaskNotFoundError, RpcCode.NotFound],
  [TaskNotCancelableError, RpcCode.FailedPrecondition],
  [ExtendedAgentCardNotConfiguredError, RpcCode.FailedPrecondition],
  [PushNotificationNotSupportedError, RpcCode.Unimplemented],
  [UnsupportedOperationError, RpcCode.Unimplemented],
  [VersionNotSupportedError, RpcCode.Unimplemented],
  [InvalidAgentResponseError, RpcCode.Internal],
];

/** True if the value is already a slimrpc RpcError. */
function isRpcError(value: unknown): boolean {
  const anyRpc = RpcError as unknown as { instanceOf?: (v: unknown) => boolean };
  return typeof anyRpc.instanceOf === 'function' ? anyRpc.instanceOf(value) : false;
}

/**
 * Converts an arbitrary thrown value into an {@link RpcError} suitable for
 * returning to a slimrpc caller. Existing `RpcError`s pass through unchanged;
 * known A2A SDK errors map to their gRPC-style status code; anything else
 * becomes `Internal`.
 */
export function toRpcError(error: unknown): RpcError {
  if (isRpcError(error)) {
    return error as RpcError;
  }

  let code = RpcCode.Internal;
  for (const [ctor, mapped] of ERROR_CODE_MAP) {
    if (error instanceof ctor) {
      code = mapped;
      break;
    }
  }

  const name = error instanceof Error ? error.constructor.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  return new RpcError.Rpc({ code, message: `${name}: ${message}`, details: undefined });
}
