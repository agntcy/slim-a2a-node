# Echo agent example

A minimal A2A agent that echoes text back to the caller, communicating over the
SLIM network via slimrpc. It mirrors `slim-a2a-python`'s `echo_agent` example.

## Run

The server starts an **in-process SLIM node** for a self-contained demo, so no
separate broker is needed. In two terminals, from the repo root:

```sh
# Terminal 1 — start the echo agent (and an in-process SLIM node)
npm run example:server -- --name echo_agent

# Terminal 2 — send a message
npm run example:client -- --text "hello slim"
```

Flags (both server and client):

- `--url <http://host:port>` — SLIM node URL (default `http://127.0.0.1:46357`).
- `--name <agent>` — agent name (default `echo_agent`).
- server `--no-broker` — do not start the in-process node (use one already running).
- client `--text <message>` — text to send.

If a standalone SLIM node is already running (e.g. on `46357`), start the server
with `--no-broker`, or point everything at a spare port with `--url`.

Expected client output:

```
Sending to agntcy/demo/echo_agent: "hello slim"
Received: "hello slim"
```

## What it shows

- `server.ts` — builds an `AgentCard` advertising a `slimrpc` interface, wraps a
  `DefaultRequestHandler` + `EchoAgentExecutor` in an `SRPCHandler`, and serves
  it on a slimrpc `Server`.
- `client.ts` — connects over SLIM and uses `createSlimClient` (the A2A SDK
  `ClientFactory` + `SRPCTransport`) to `sendMessage`.
- `echoAgentExecutor.ts` — the A2A `AgentExecutor` that publishes the echoed
  agent `Message`.

In production the SLIM node runs separately; drop `startSlimBroker()` from
`server.ts` and point both sides at your node's URL.
