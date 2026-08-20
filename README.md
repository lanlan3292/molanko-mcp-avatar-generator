# molanko-mcp-avatar-generator

MCP server for [molanko-avatar-generator](https://github.com/lanlan3292/molanko-avatar-generator).

The server exposes one tool:

- `generate_avatar` — turn a provided source image / Minecraft skin into a Molanko Avatar and return the generated PNG as an MCP image result.

A source image is required. The server does not invent a source image when one is not provided.

## Run

```bash
npm install
npm start
```

The server uses MCP stdio transport, so it can be launched by MCP clients that support local stdio servers.

## Tool input

`generate_avatar` accepts:

- `image` — required MCP-style image object: `{ "type": "image", "data": "<base64>", "mimeType": "image/png" }`
- `outlineMode` — outline radius; `0` disables the outline
- `outlineColor` — `#RRGGBB` or an automatic preset such as `auto_dark`
- `bgColor` — `#RRGGBB` or an automatic preset such as `auto_light`
- `upscale48` — render the 32x32 avatar centered on a 48x48 canvas
- `fillBackground` — fill the output background
- `scale` — nearest-neighbor output scale

Optional parameters use the defaults from the underlying generator when omitted.

## Architecture

This repository is intentionally a thin MCP adapter. Avatar rendering remains in `molanko-avatar-generator`; this project handles MCP input/output and delegates rendering to the existing Node.js implementation.
