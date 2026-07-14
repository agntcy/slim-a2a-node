# slim-a2a-node — implementation prompt

You are implementing **slim-a2a-node** (aka SLIMA2A for JavaScript/TypeScript): a
SLIM transport for the A2A (Agent2Agent) protocol, so agents communicate over the
SLIM network using A2A over slim's RPC protocol (slimrpc). This is the JS/TS peer
of the existing slim-a2a-python / -go / -java / -dotnet SDKs. You are working in
the currently-empty repo at /Users/janossk/WORK/slim-a2a-node (git initialized,
only a README).

## Ground rules
- DO NOT write any implementation code until you have (1) studied the references
  below and (2) produced a short design doc + step plan and had it approved.
- Do not fabricate the A2A or slim-bindings APIs — verify every symbol against the
  actual sources on disk / the real npm packages before relying on it.
- TypeScript, native ESM ("type": "module"), Node >= 18. Mirror the naming,
  layering, and DX of slim-a2a-python as closely as the language allows.

## Primary reference (study first, mirror its structure)
/Users/janossk/WORK/slim-a2a-python — package `slima2a`. Read, in this order:
  - README.md (server + client usage, how buf generate is wired)
  - buf.gen.v1.yaml and buf.gen.v0.yaml (proto source + plugin invocation)
  - slima2a/types/v1/ and v0/ (generated slimrpc stubs from the A2A proto)
  - slima2a/client_transport.py (A2A ClientTransport implemented over the
    generated slimrpc CLIENT stub)
  - slima2a/handler.py (server-side: bridges the A2A request handler to the
    generated SERVICER)
  - slima2a/slim_helper.py (setup_slim_client convenience: init + connect + names)
  - slima2a/compat/ (version compatibility layering)
  - examples/echo_agent/ and examples/travel_planner_agent/ (end-to-end shape)
  - Taskfile.yaml (generate / lint / test / packaging tasks)
Secondary references for cross-checking API shape and example structure:
/Users/janossk/WORK/slim-a2a-go, /slim-a2a-java, /slim-a2a-dotnet.

## The A2A protocol source (verified)
The A2A proto lives in github.com/a2aproject/A2A. slim-a2a-python generates from:
  - v1.0.0: subdir `specification`
  - v0.3.0: subdir `specification/grpc`
The gRPC service is `A2AService`. Decide in your plan whether to ship both
versions (like python) or start with v1.0.0 and treat v0.3 as a follow-up.

## Integration target: the official A2A JS SDK
python's slima2a reuses the official `a2a` python SDK's domain types + client/
server abstractions and only supplies the SLIM transport. Do the equivalent in
JS: FIRST locate and verify the official A2A JavaScript SDK (likely published as
`@a2a-js/sdk` — confirm the exact package name, version, and its
client-transport + request-handler interfaces before designing). Your SDK should
plug a SLIM transport into that SDK, NOT reinvent A2A domain types.

## The foundation you build on (just completed, in /Users/janossk/WORK/slim-bindings)
1. **slimrpc runtime** — npm package `@agntcy/slim-bindings` (native ESM). Provides
   `Channel` (`newWithConnection`, `newGroupWithConnection`), `Server`
   (`newWithConnection`, `serveAsync`, `shutdownAsync`), `Context`, `RpcError`
   (`new RpcError.Rpc({ code, message, details })`), `RpcCode`, the streaming
   primitives, and the four handler interfaces. Read
   /Users/janossk/WORK/slim-bindings/node/SLIMRPC.md and node/README.md.
2. **slimrpc compiler target** — `protoc-gen-slimrpc-node`, source at
   /Users/janossk/WORK/slim-bindings/slimrpc-compiler. Emits `<base>_slimrpc.ts`
   per proto with services, alongside protobuf-es v2 message types from
   `buf.build/bufbuild/es`. Study a concrete generated example at
   /Users/janossk/WORK/slim-bindings/node/examples/slimrpc/simple/ (proto,
   buf.gen.yaml, generated types/, server.ts, client.ts, client_group.ts).

### Generated stub API (what buf will produce for A2AService)
  - `class A2AServiceClient { constructor(channel: ChannelLike); ... }` —
      unary→`Promise<T>`; server-stream→`AsyncGenerator<T>`;
      client-stream→`(reqs: AsyncIterable<Req>) => Promise<T>`;
      bidi→`(reqs: AsyncIterable<Req>) => AsyncGenerator<T>`.
      Every method: `(req|reqs, timeout?: number /*ms*/, metadata?: Map<string,string>)`.
  - `class A2AServiceGroupClient { ... }` — multicast; each method yields
      `{ context, response }` per responding member.
  - `interface A2AServiceServicer { ... }` (you implement) +
      `function registerA2AServiceServicer(server: ServerLike, servicer): void`.
  - Message (de)serialization uses `@bufbuild/protobuf` v2: `create(Schema, {...})`,
      `toBinary`, `fromBinary`, and `<Msg>Schema` consts (wkt from
      `@bufbuild/protobuf/wkt`).

### Runtime facts you must respect (do not guess these)
  - Bytes cross the FFI as `ArrayBuffer` (the generated stubs already bridge to/
    from protobuf-es `Uint8Array`).
  - u64 / connection ids / int64 fields are real `bigint` — never `Number()`.
  - timeout is `number` in milliseconds; metadata is `Map<string,string>`.
  - Enums are real TS enums; `RpcCode.Internal`, `RpcCode.Unimplemented`, etc.

## Release status (why local linking is needed for now)
Two upstream releases are in flight and NOT yet published:
  - The plugin: `agntcy-protoc-slimrpc-plugin` v1.5.0 (adds the node bin) — pending.
    Until it lands, build the plugin from source:
      `cargo install --locked --path /Users/janossk/WORK/slim-bindings/slimrpc-compiler --bin protoc-gen-slimrpc-node`
    (installs to ~/.cargo/bin, which buf's `local: protoc-gen-slimrpc-node` resolves).
  - `@agntcy/slim-bindings` named-export fix ("B") — pending an npm release. Until
    then, consume the LOCAL build of /Users/janossk/WORK/slim-bindings/node:
    run `task generate` there, then `npm link`/`file:` it into this repo. Once the
    named-export fix is present in that local build, generated stubs can use the
    default `bindings_import=@agntcy/slim-bindings`; otherwise pass
    `bindings_import` pointing at the linked package's generated index.
Confirm current status of both before finalizing packaging.

## Deliverables (mirror slima2a, TS/ESM idioms)
  - Repo scaffold: package.json (ESM), tsconfig.json, buf.gen.yaml(s), a Taskfile
    or npm scripts for `generate` / `lint` / `test` / `build`.
  - Generated `types/` (A2AService slimrpc stubs + protobuf-es message types).
  - SLIM transport layer: a client transport + a server request handler that plug
    into the official A2A JS SDK, plus a `setup`/helper for SLIM init+connect.
  - At least an echo-agent example with a runnable server + client.
  - Tests, README, LICENSE/headers matching the sibling repos.

## Verification bar (the real proof)
Don't stop at type-checking. Stand up a SLIM broker (you can reuse the in-process
node broker pattern from
/Users/janossk/WORK/slim-bindings/node/examples/server.ts) and run the echo agent
server + client end-to-end, confirming an A2A message round-trips over SLIM.

## First response
Produce: (1) a concise design doc (layering, chosen A2A JS SDK + version(s),
proto version scope, how message types map between protoc-gen-es output and the
A2A SDK's types), and (2) a numbered step plan. Then STOP and wait for approval
before writing code.
