# slim-a2a-node

A **SLIM (slimrpc) transport for the [A2A](https://github.com/a2aproject/A2A)
protocol** in TypeScript. It lets A2A agents communicate over the SLIM network
using SLIM identities for addressing and authentication, and plugs directly into
the official [`@a2a-js/sdk`](https://www.npmjs.com/package/@a2a-js/sdk) — it does
**not** reinvent the A2A domain types.

This is the JavaScript/TypeScript peer of `slim-a2a-python` (and the Go, Java,
and .NET SDKs).

- **Client** — `SRPCTransport` / `SRPCTransportFactory` implement the SDK's
  `Transport` / `TransportFactory`.
- **Server** — `SRPCHandler` bridges an SDK `A2ARequestHandler` (e.g.
  `DefaultRequestHandler`) onto the generated slimrpc servicer.
- **Bootstrap** — `setupSlimClient` and friends handle SLIM init + connect.

## How it works

The generated slimrpc stubs speak [protobuf-es](https://github.com/bufbuild/protobuf-es)
messages, while `@a2a-js/sdk` (>= 1.0.0-beta) exposes ts-proto domain objects for
the same A2A v1.0.0 proto. slim-a2a-node bridges the two through the canonical
proto3 JSON representation (see `src/conversions.ts`), so message shapes, enums,
oneofs, and bytes all round-trip faithfully with no hand-written field mapping.

```
@a2a-js/sdk (ts-proto)  <-- proto3 JSON bridge -->  protobuf-es  <-- slimrpc -->  SLIM
```

## Requirements

- Node.js >= 18, native ESM.
- To regenerate stubs only: [`buf`](https://buf.build/docs/cli/installation/) and
  the `protoc-gen-slimrpc-node` plugin on `PATH`:

  ```sh
  cargo install --locked --version 2.0.1 agntcy-protoc-slimrpc-plugin --bin protoc-gen-slimrpc-node
  ```

  The committed stubs under `src/types/v1/` are generated with the 2.0 line of
  the plugin, matching `@agntcy/slim-bindings` 2.0.

## Install

```sh
npm install
```

Pulls `@agntcy/slim-bindings` and the matching native platform package for your
OS/arch from npm automatically.

## Usage

### Server

```ts
import { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import {
  registerSlimA2AHandler,
  setupSlimClient,
  slim,
  SRPCHandler,
} from '@agntcy/slim-a2a';

const agentCard = AgentCard.fromJSON({
  name: 'My Agent',
  version: '1.0.0',
  capabilities: { streaming: true },
  supportedInterfaces: [
    { url: 'agntcy/demo/my_agent', protocolBinding: 'slimrpc', protocolVersion: '1.0' },
  ],
  // ...skills, input/output modes
});

const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new MyAgentExecutor(), // your AgentExecutor
);

const { app, name, connId } = await setupSlimClient('agntcy', 'demo', 'my_agent');
const server = slim.Server.newWithConnection(app, name, connId);
registerSlimA2AHandler(server, new SRPCHandler(agentCard, requestHandler));
await server.serveAsync();
```

### Client

```ts
import { setupSlimClient, createSlimClient } from '@agntcy/slim-a2a';
import { SendMessageRequest } from '@a2a-js/sdk';

const { app, connId } = await setupSlimClient('agntcy', 'demo', 'client');
const client = await createSlimClient(app, connId, agentCard); // A2A SDK Client

const request = SendMessageRequest.fromJSON({
  message: { messageId: crypto.randomUUID(), role: 'ROLE_USER', parts: [{ text: 'hello' }] },
});
const result = await client.sendMessage(request); // Message | Task
```

`createSlimClient` uses the SDK's `ClientFactory` under the hood, selecting the
`slimrpc` transport from the agent card's declared interfaces. For manual wiring,
register `SRPCTransportFactory` yourself:

```ts
import { ClientFactory } from '@a2a-js/sdk/client';
import { SRPCTransportFactory } from '@agntcy/slim-a2a';

const factory = new ClientFactory({ transports: [new SRPCTransportFactory(app, connId)] });
const client = await factory.createFromAgentCard(agentCard);
```

SLIM names are the 3-tuple `organization/namespace/app`; the agent card's slimrpc
`AgentInterface.url` carries that name.

### Multicast

`SRPCMulticastClient` queries several agents over a SLIM group channel, yielding
`{ source, response }` per responding member — see `src/clientTransport.ts`.

### The `slim` namespace

`slim` re-exports the `@agntcy/slim-bindings` 2.0 runtime — `Name`, `Service`,
`App`, `Channel`, `Server`, `RpcError`, the config helpers — for the parts this
SDK does not wrap. Bindings 2.0 split the slimrpc API into a second UniFFI
namespace (`slim_rpc`) that the package's type entry point does not re-export,
so importing `Channel`/`Server`/`ContextLike` straight from
`@agntcy/slim-bindings` does not typecheck; `slim` stitches both namespaces back
together (see `src/slimBindings.ts`).

## Example

A runnable echo agent lives in [`examples/echo-agent`](examples/echo-agent/):

```sh
npm run example:server -- --name echo_agent   # terminal 1
npm run example:client -- --text "hello slim"  # terminal 2
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run generate`  | Regenerate the A2A v1.0.0 protobuf-es + slimrpc stubs (`buf`). |
| `npm run build`     | Type-check and emit the ESM build to `dist/`. |
| `npm run typecheck` | Type-check the whole project. |
| `npm test`          | Run the vitest suite (unit + end-to-end round-trip). |
| `npm run format`    | Format sources with prettier. |

A `Taskfile.yaml` mirrors these (`task generate`, `task build`, `task test`, …).

## Continuous integration

[`.github/workflows/ci.yaml`](.github/workflows/ci.yaml) runs on pushes and PRs to
`main`:

- **format** — Prettier check (standalone; no project install).
- **codegen** — regenerates the stubs with the published slimrpc plugin and fails
  on drift from what's committed.
- **build-and-test** — type-check, build, and test on Node 18/20/22.

## Releasing

[`.github/workflows/release.yaml`](.github/workflows/release.yaml) publishes to
npm on a version tag. Push a tag matching `v<version>`:

```sh
git tag v0.1.0          # -> published as @latest
git tag v0.1.0-alpha.1  # -> published as @alpha
git push origin --tags
```

The package version is taken from the tag; the npm dist-tag is derived from any
prerelease id (`alpha`/`beta`/`rc`/… → that tag, plain version → `latest`).

Publishing uses **npm Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret.
One-time setup on npmjs.com: the `@agntcy/slim-a2a` package → Settings → Trusted
publishing → set Repository to this repo and Workflow filename to `release.yaml`.

## Proto version scope

Ships **A2A v1.0.0** (`git a2aproject/A2A@v1.0.0`, subdir `specification`).
v0.3 wire compatibility is a planned follow-up (the SDK exposes `@a2a-js/sdk/compat/v0_3`).

## License

Apache-2.0. See [LICENSE](LICENSE).
