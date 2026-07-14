// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Echo agent server: stands up an A2A agent reachable over SLIM.
 *
 * For a self-contained demo it starts an in-process SLIM node (broker) too; in
 * production the broker runs separately and you would drop `startSlimBroker()`.
 *
 * Run: `npm run example:server -- --name echo_agent`
 */
import { Server } from '@agntcy/slim-bindings';
import { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import {
  registerSlimA2AHandler,
  setupSlimClient,
  SRPCHandler,
  startSlimBroker,
} from '../../src/index.js';
import { EchoAgentExecutor } from './echoAgentExecutor.js';

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

/** Derives a broker bind endpoint (`host:port`) from a SLIM client URL. */
function brokerEndpoint(url: string): string {
  const { hostname, port } = new URL(url);
  return `${hostname}:${port || '46357'}`;
}

async function main(): Promise<void> {
  const name = arg('name', 'echo_agent');
  const slimUrl = arg('url', 'http://127.0.0.1:46357');
  const namespace = 'agntcy';
  const group = 'demo';

  const agentCard = AgentCard.fromJSON({
    name: 'Echo Agent',
    description: 'Echoes back the received message over SLIM.',
    version: '1.0.0',
    capabilities: { streaming: true },
    supportedInterfaces: [
      {
        url: `${namespace}/${group}/${name}`,
        protocolBinding: 'slimrpc',
        protocolVersion: '1.0',
      },
    ],
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      {
        id: 'echo',
        name: 'Echo',
        description: 'Echoes the input text back.',
        tags: ['echo'],
      },
    ],
  });

  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    new EchoAgentExecutor(),
  );

  // Self-contained demo: run an in-process SLIM node, then connect to it. Pass
  // `--no-broker` when a standalone SLIM node is already running.
  if (!process.argv.includes('--no-broker')) {
    startSlimBroker(brokerEndpoint(slimUrl));
  }
  const {
    app,
    name: localName,
    connId,
  } = await setupSlimClient(namespace, group, name, {
    slimUrl,
  });

  const server = Server.newWithConnection(app, localName, connId);
  registerSlimA2AHandler(server, new SRPCHandler(agentCard, requestHandler));

  console.log(`Echo agent serving as ${namespace}/${group}/${name} (Ctrl+C to stop)`);
  await server.serveAsync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
