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
  cargo install --locked agntcy-protoc-slimrpc-plugin --bin protoc-gen-slimrpc-node
  ```

## Install & local setup

> **Local linking (temporary).** Until `@agntcy/slim-bindings` publishes the ESM
> named-export fix and a version-matched native platform package, this repo
> consumes the local build at `../slim-bindings/node`. After `npm install`, run
> the bootstrap script once (and again whenever that build is regenerated):

```sh
npm install
./scripts/setup-local-bindings.sh
```

`setup-local-bindings.sh` builds the local native platform tarball and installs
it where the linked build's loader resolves it. Once upstream publishes, replace
the `file:` dependency with the npm package and drop this step.

## Usage

### Server

```ts
import { Server } from '@agntcy/slim-bindings';
import { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { setupSlimClient, SRPCHandler, registerSlimA2AHandler } from '@agntcy/slim-a2a';

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
const server = Server.newWithConnection(app, name, connId);
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

## Proto version scope

Ships **A2A v1.0.0** (`git a2aproject/A2A@v1.0.0`, subdir `specification`).
v0.3 wire compatibility is a planned follow-up (the SDK exposes `@a2a-js/sdk/compat/v0_3`).

## License

Apache-2.0. See [LICENSE](LICENSE).
