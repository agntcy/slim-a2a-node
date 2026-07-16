// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';
import { Message, Role } from '@a2a-js/sdk';
import {
  AgentEvent,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from '@a2a-js/sdk/server';
import { EchoAgent } from './echoAgent.js';

/**
 * Bridges the {@link EchoAgent} to the A2A SDK executor contract. It publishes a
 * single agent `Message` (the echoed text) and finishes — the simplest flow
 * that exercises an end-to-end A2A round-trip.
 */
export class EchoAgentExecutor implements AgentExecutor {
  private readonly agent = new EchoAgent();

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const firstPart = userMessage.parts[0];
    if (firstPart?.content?.$case !== 'text') {
      throw new Error('only text parts are supported');
    }

    const result = await this.agent.invoke(firstPart.content.value);

    const response = Message.fromJSON({
      messageId: randomUUID(),
      contextId: userMessage.contextId,
      taskId: userMessage.taskId,
      role: Role.ROLE_AGENT,
      parts: [{ text: result }],
    });

    eventBus.publish(AgentEvent.message(response));
    eventBus.finished();
  }

  async cancelTask(): Promise<void> {
    throw new Error('cancel not supported');
  }
}
