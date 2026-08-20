#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { processTexture } from 'molanko-avatar-generator';
import * as z from 'zod/v4';

function decodeImageData(image) {
  const data = image.data.startsWith('data:')
    ? image.data.slice(image.data.indexOf(',') + 1)
    : image.data;
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0) {
    throw new Error('The source image is empty.');
  }
  return buffer;
}

function parseAverageColor(value) {
  if (!value || value.toLowerCase() === 'auto') {
    return undefined;
  }

  const hex = value.startsWith('#') ? value.slice(1) : value;
  const normalized = hex.length === 3
    ? hex.split('').map(char => char + char).join('')
    : hex;

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error('averageColor must be "auto", #RRGGBB, or #RGB.');
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function createServer() {
  const server = new McpServer({
    name: 'molanko-mcp-avatar-generator',
    version: '0.1.0'
  });

  const imageInput = z.object({
    type: z.literal('image'),
    data: z.string().min(1).describe('Base64-encoded image data, optionally as a data URL.'),
    mimeType: z.string().optional().default('image/png').describe('Input image MIME type.')
  }).describe('The source skin/image. This is required.');

  server.registerTool(
    'generate_avatar',
    {
      title: 'Generate Molanko Avatar',
      description:
        'Generate a Molanko Avatar from a source image. A source image is required; do not call this tool when no source image has been provided. The source image should be a Minecraft skin or another image supported by Molanko Avatar Generator. Returns the generated PNG as an MCP image result.',
      inputSchema: z.object({
        image: imageInput,
        scale: z.number().positive().optional().default(1).describe('Nearest-neighbor output scale.'),
        outlineMode: z.number().int().min(0).optional().default(0).describe('Outline radius in pixels. 0 disables the outline.'),
        outlineColor: z.string().optional().default('#000000').describe('Outline color: auto_dark, auto_darker, auto_medium_dark, or a hex color.'),
        bgColor: z.string().optional().default('#ffffff').describe('Background color: auto_light, auto_lighter, auto_medium_light, or a hex color.'),
        fillBackground: z.boolean().optional().default(true).describe('Whether to fill the background.'),
        upscale48: z.boolean().optional().default(false).describe('Render the avatar on a 48x48 canvas with the 32x32 avatar centered.'),
        averageColor: z.string().optional().describe('Override the color used by automatic outline/background colors. Use auto (default), #RRGGBB, or #RGB.')
      })
    },
    async ({ image, scale, outlineMode, outlineColor, bgColor, fillBackground, upscale48, averageColor }) => {
      try {
        const sourceImage = await loadImage(decodeImageData(image));
        const outputCanvas = processTexture(sourceImage, {
          createCanvas,
          scale,
          outlineMode,
          outlineColor,
          bgColor,
          fillBackground,
          upscale48,
          averageColor: parseAverageColor(averageColor)
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
          content: [{ type: 'text', text: `Failed to generate Molanko Avatar: ${message}` }]
        };
      }
    }
  );

  return server;
}

serveStdio(createServer);
