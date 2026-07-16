# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
