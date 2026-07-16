// Copyright AGNTCY Contributors (https://github.com/agntcy)
// SPDX-License-Identifier: Apache-2.0

/** The echo agent's business logic: it returns the prompt unchanged. */
export class EchoAgent {
  async invoke(prompt: string): Promise<string> {
    return prompt;
  }
}
