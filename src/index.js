#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { processTexture } from 'molanko-avatar-generator';
import * as z from 'zod/v4';

function createServer() {
  const server = new McpServer({
    name: 'molanko-mcp-avatar-generator',
    version: '0.1.0'
  });

  const imageInput = z.object({
    type: z.literal('image'),
    data: z.string().min(1).describe('Base64-encoded image data, optionally as a data URL.'),
    mimeType: z.string().optional().default('image/png').describe('Input image MIME type.')
  }).describe('The source skin/image to turn into a Molanko Avatar. This is required.');

  server.registerTool(
    'generate_avatar',
    {
      title: 'Generate Molanko Avatar',
      description:
        'Generate a Molanko Avatar from a source image. A source image is required; do not call this tool when no source image has been provided. The source image should be a Minecraft skin or another image supported by Molanko Avatar Generator. Returns the generated PNG as an MCP image result.',
      inputSchema: z.object({
        image: imageInput,
        outlineMode: z.number().int().min(0).optional().default(0).describe('Outline radius in pixels. 0 disables the outline.'),
        outlineColor: z.string().optional().default('#000000').describe('Outline color as #RRGGBB, or an automatic preset such as auto_dark.'),
        bgColor: z.string().optional().default('#ffffff').describe('Background color as #RRGGBB, or an automatic preset such as auto_light.'),
        upscale48: z.boolean().optional().default(false).describe('Render the avatar on a 48x48 canvas with the 32x32 avatar centered.'),
        fillBackground: z.boolean().optional().default(true).describe('Whether to fill the output background.'),
        scale: z.number().positive().optional().default(1).describe('Nearest-neighbor output scale. 1 keeps the generator canvas size.')
      })
    },
    async ({ image, outlineMode, outlineColor, bgColor, upscale48, fillBackground, scale }) => {
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

  return server;
}

serveStdio(createServer);
