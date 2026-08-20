#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { processTexture } from 'molanko-avatar-generator';
import { z } from 'zod';

const server = new McpServer({
  name: 'molanko-mcp-avatar-generator',
  version: '0.1.0'
});

const imageInput = z.object({
  type: z.literal('image'),
  data: z.string().min(1).describe('Base64-encoded image data, optionally as a data URL.'),
  mimeType: z.string().optional().default('image/png').describe('Input image MIME type.')
}).describe('The source skin/image to turn into a Molanko Avatar. This is required.');

const optionsInput = {
  image: imageInput,
  outlineMode: z.number().int().min(0).describe('Outline radius in pixels. 0 disables the outline.'),
  outlineColor: z.string().describe('Outline color as #RRGGBB, or an automatic preset such as auto_dark.'),
  bgColor: z.string().describe('Background color as #RRGGBB, or an automatic preset such as auto_light.'),
  upscale48: z.boolean().describe('Render the avatar on a 48x48 canvas with the 32x32 avatar centered.'),
  fillBackground: z.boolean().describe('Whether to fill the output background.'),
  scale: z.number().positive().describe('Nearest-neighbor output scale. 1 keeps the generator canvas size.')
};

server.registerTool(
  'generate_avatar',
  {
    title: 'Generate Molanko Avatar',
    description:
      'Generate a Molanko Avatar from a source image. A source image is required; do not call this tool when no source image has been provided. The source image should be a Minecraft skin or another image supported by Molanko Avatar Generator. Returns the generated PNG as an MCP image result.',
    inputSchema: optionsInput
  },
  async ({ image, outlineMode = 0, outlineColor = '#000000', bgColor = '#ffffff', upscale48 = false, fillBackground = true, scale = 1 }) => {
    try {
      const data = image.data.startsWith('data:')
        ? image.data.slice(image.data.indexOf(',') + 1)
        : image.data;

      const sourceBuffer = Buffer.from(data, 'base64');
      if (sourceBuffer.length === 0) {
        throw new Error('The source image is empty.');
      }

      const sourceImage = await loadImage(sourceBuffer);
      const outputCanvas = processTexture(sourceImage, {
        createCanvas,
        outlineMode,
        outlineColor,
        bgColor,
        upscale48,
        fillBackground,
        scale
      });

      const output = outputCanvas.toBuffer('image/png');

      return {
        content: [
          {
            type: 'image',
            data: output.toString('base64'),
            mimeType: 'image/png'
          }
        ]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to generate Molanko Avatar: ${message}`
          }
        ]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
