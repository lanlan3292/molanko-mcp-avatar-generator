#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { processTexture } from 'molanko-avatar-generator';
import * as z from 'zod/v4';

const USER_AGENT = 'MolankoMCPAvatarGenerator/0.1.0 (+https://github.com/lanlan3292/molanko-mcp-avatar-generator)';
const UUID_PATTERN = /^[0-9a-f]{32}$/i;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,16}$/;

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
  if (!value || value.toLowerCase() === 'auto') return undefined;
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

function normalizeUuid(value) {
  return value.trim().replaceAll('-', '').toLowerCase();
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });
  } catch (error) {
    throw new Error(`Mojang network error: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (response.status === 404 || response.status === 204) {
    throw new Error('Minecraft player not found.');
  }
  if (response.status === 429) {
    throw new Error('Mojang API rate limit exceeded. Please try again later.');
  }
  if (response.status >= 500) {
    throw new Error(`Mojang server error: HTTP ${response.status}.`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Mojang API error: HTTP ${response.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Invalid JSON from Mojang API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function resolveMinecraftPlayer(value) {
  const input = value.trim();
  if (!input) throw new Error('minecraftPlayer cannot be empty.');

  const normalized = normalizeUuid(input);
  let uuid;

  if (UUID_PATTERN.test(normalized)) {
    uuid = normalized;
  } else {
    if (!USERNAME_PATTERN.test(input)) {
      throw new Error('minecraftPlayer must be a Minecraft username (1-16 letters, digits, or underscores) or a UUID.');
    }
    const profile = await fetchJson(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(input)}`
    );
    uuid = normalizeUuid(profile.id ?? '');
    if (!UUID_PATTERN.test(uuid)) {
      throw new Error('Mojang returned an invalid player UUID.');
    }
  }

  const profile = await fetchJson(
    `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`
  );
  const properties = Array.isArray(profile.properties) ? profile.properties : [];
  const texturesProperty = properties.find(property => property?.name === 'textures');
  if (!texturesProperty?.value) {
    throw new Error('Minecraft player has no skin texture.');
  }

  let textures;
  try {
    textures = JSON.parse(Buffer.from(texturesProperty.value, 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid Mojang texture data: ${error instanceof Error ? error.message : String(error)}`);
  }

  const skinUrl = textures?.textures?.SKIN?.url;
  if (!skinUrl) {
    throw new Error('Minecraft player has no skin texture.');
  }

  let response;
  try {
    response = await fetch(skinUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/png,image/*;q=0.9,*/*;q=0.8'
      }
    });
  } catch (error) {
    throw new Error(`Skin download failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (response.status === 429) {
    throw new Error('Skin service rate limit exceeded. Please try again later.');
  }
  if (response.status >= 500) {
    throw new Error(`Skin service server error: HTTP ${response.status}.`);
  }
  if (!response.ok) {
    throw new Error(`Skin download failed: HTTP ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error('Skin download returned an empty image.');

  return {
    buffer: bytes,
    uuid,
    resolvedName: typeof profile.name === 'string' ? profile.name : undefined
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
  }).describe('A source Minecraft skin/image.');

  server.registerTool(
    'generate_avatar',
    {
      title: 'Generate Molanko Avatar',
      description:
        'Generate a Molanko Avatar. Provide exactly one source: image or minecraftPlayer. minecraftPlayer accepts a Minecraft username or UUID (with or without hyphens); the server resolves the current skin through Mojang APIs. Returns the generated PNG as an MCP image result.',
      inputSchema: z.object({
        image: imageInput.optional(),
        minecraftPlayer: z.string().min(1).optional().describe('Minecraft username or UUID, with or without hyphens. The server fetches the current skin through Mojang APIs.'),
        scale: z.number().positive().optional().default(1).describe('Nearest-neighbor output scale.'),
        outlineMode: z.number().int().min(0).optional().default(0).describe('Outline radius in pixels. 0 disables the outline.'),
        outlineColor: z.string().optional().default('auto').describe('Outline color: auto, auto_darker, auto_lighter, or a hex color.'),
        bgColor: z.string().optional().default('auto').describe('Background color: auto, auto_lighter, auto_darker, or a hex color.'),
        fillBackground: z.boolean().optional().default(true).describe('Whether to fill the background.'),
        upscale48: z.boolean().optional().default(false).describe('Render the avatar on a 48x48 canvas with the 32x32 avatar centered.'),
        averageColor: z.string().optional().describe('Override the color used by automatic outline/background colors. Use auto (default), #RRGGBB, or #RGB.')
      })
    },
    async ({ image, minecraftPlayer, scale, outlineMode, outlineColor, bgColor, fillBackground, upscale48, averageColor }) => {
      try {
        if ((image ? 1 : 0) + (minecraftPlayer ? 1 : 0) !== 1) {
          throw new Error('Provide exactly one source: image or minecraftPlayer.');
        }

        const sourceBuffer = image
          ? decodeImageData(image)
          : (await resolveMinecraftPlayer(minecraftPlayer)).buffer;
        const sourceImage = await loadImage(sourceBuffer);
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
          content: [{
            type: 'image',
            data: output.toString('base64'),
            mimeType: 'image/png'
          }]
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
