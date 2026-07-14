// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/**
 * Echo agent client: connects over SLIM and sends a message to the echo agent.
 *
 * Run (after the server is up): `npm run example:client -- --text "hello slim"`
 */
import { randomUUID } from 'node:crypto';
import { AgentCard, SendMessageRequest } from '@a2a-js/sdk';
import { createSlimClient, setupSlimClient } from '../../src/index.js';

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

async function main(): Promise<void> {
  const agentName = arg('name', 'echo_agent');
  const text = arg('text', 'hello slim');
  const slimUrl = arg('url', 'http://127.0.0.1:46357');
  const namespace = 'agntcy';
  const group = 'demo';
  const remote = `${namespace}/${group}/${agentName}`;

  const { app, connId } = await setupSlimClient(namespace, group, 'client', {
    slimUrl,
  });

  // A minimal card describing how to reach the remote agent over slimrpc.
  const card = AgentCard.fromJSON({
    name: agentName,
    description: 'Echo agent (remote).',
    version: '1.0.0',
    capabilities: { streaming: true },
    supportedInterfaces: [
      { url: remote, protocolBinding: 'slimrpc', protocolVersion: '1.0' },
    ],
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [],
  });

  const client = await createSlimClient(app, connId, card);

  const request = SendMessageRequest.fromJSON({
    message: { messageId: randomUUID(), role: 'ROLE_USER', parts: [{ text }] },
  });

  console.log(`Sending to ${remote}: "${text}"`);
  const result = await client.sendMessage(request);

  // The echo agent replies with a Message.
  if ('parts' in result && Array.isArray(result.parts)) {
    const part = result.parts[0];
    const reply = part?.content?.$case === 'text' ? part.content.value : '<non-text>';
    console.log(`Received: "${reply}"`);
  } else {
    console.log('Received:', JSON.stringify(result));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
