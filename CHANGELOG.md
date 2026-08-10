# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Upgraded to `@agntcy/slim-bindings` 2.0.0 (from 2.0.0-alpha.3) and the 2.0 line
  of the slimrpc compiler (`agntcy-protoc-slimrpc-plugin`, node generator).
  Bindings 2.0 moved the slimrpc API (`Channel`, `Server`, `RpcError`, the
  handler interfaces, ...) into a second UniFFI namespace, `slim_rpc`. Its
  values are still re-exported from the package root at runtime, but the
  package's type entry point only re-exports the core `slim_bindings` namespace,
  so those names no longer typecheck when imported from `@agntcy/slim-bindings`
  directly. Added `src/slimBindings.ts`, which merges both namespaces into a
  single typed surface; the SDK and the generated slimrpc stubs
  (`bindings_import` in `buf.gen.v1.yaml`) are written against it, and it is
  re-exported to consumers as the `slim` namespace. It can collapse to a plain
  re-export once the bindings package exposes `slim_rpc` from its root
  declaration file.

### Added

- Initial release of **slim-a2a-node**: a SLIM (slimrpc) transport for the A2A
  protocol, plugging into `@a2a-js/sdk` (>= 1.0.0-beta).
  - `SRPCTransport` / `SRPCTransportFactory` — client transport implementing the
    SDK `Transport` / `TransportFactory`.
  - `SRPCHandler` / `registerSlimA2AHandler` — server bridge from an SDK
    `A2ARequestHandler` onto the generated slimrpc servicer.
  - `SRPCMulticastClient` — multicast client over a SLIM group channel.
  - `setupSlimClient`, `initializeSlim`, `connectAndSubscribe`, `startSlimBroker`
    — SLIM bootstrap helpers.
  - `createSlimClient` — convenience that wires the SDK `ClientFactory` to SLIM.
  - Proto3-JSON conversion layer between the SDK's ts-proto domain objects and
    the protobuf-es wire messages.
  - Generated A2A v1.0.0 protobuf-es message types + slimrpc stubs.
  - Runnable echo-agent example and an end-to-end round-trip test.
