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

## Tool: `generate_avatar`

Accepts:

- `image` — required MCP-style image object: `{ "type": "image", "data": "<base64>", "mimeType": "image/png" }`
- `scale` — nearest-neighbor output scale
- `outlineMode` — outline radius; `0` disables the outline
- `outlineColor` — `auto_dark`, `auto_darker`, `auto_medium_dark`, or a hex color
- `bgColor` — `auto_light`, `auto_lighter`, `auto_medium_light`, or a hex color
- `fillBackground` — whether to fill the output background
- `upscale48` — render the 32x32 avatar centered on a 48x48 canvas
- `averageColor` — optional override for the color used by automatic outline/background colors; use `auto`, `#RRGGBB`, or `#RGB`

`averageColor` is **not a separate image-processing tool**. It is an override for the generator's automatically calculated average color. If omitted or set to `auto`, the underlying generator calculates the average color from the source skin. A hex value is parsed into `{ r, g, b }` and passed to `molanko-avatar-generator` as `averageColor`.

The result is returned as an MCP `image` content item containing a PNG.

## Architecture

This repository is intentionally a thin MCP adapter. Avatar rendering and color calculation remain in `molanko-avatar-generator`; this project handles MCP input/output and delegates the actual image processing to the existing Node.js implementation.
