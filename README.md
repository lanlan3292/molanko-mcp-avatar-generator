# molanko-mcp-avatar-generator

MCP server for [molanko-avatar-generator](https://github.com/lanlan3292/molanko-avatar-generator).

The server exposes these tools:

- `generate_avatar` — turn a provided source image / Minecraft skin into a Molanko Avatar and return the generated PNG as an MCP image result.
- `average_color` — calculate the average RGB color of a provided image, ignoring fully transparent pixels, and return both RGB and hex values.

A source image is required for both tools. The server does not invent a source image when one is not provided.

## Run

```bash
npm install
npm start
```

The server uses MCP stdio transport, so it can be launched by MCP clients that support local stdio servers.

## Tools

### `generate_avatar`

Accepts:

- `image` — required MCP-style image object: `{ "type": "image", "data": "<base64>", "mimeType": "image/png" }`
- `outlineMode` — outline radius; `0` disables the outline
- `outlineColor` — `#RRGGBB` or an automatic preset such as `auto_dark`
- `bgColor` — `#RRGGBB` or an automatic preset such as `auto_light`
- `upscale48` — render the 32x32 avatar centered on a 48x48 canvas
- `fillBackground` — fill the output background
- `scale` — nearest-neighbor output scale

Optional parameters use the defaults from the underlying generator when omitted.

The result is returned as an MCP `image` content item containing a PNG.

### `average_color`

Accepts:

- `image` — required MCP-style image object in the same format as `generate_avatar`

Returns a structured result such as:

```json
{
  "r": 128,
  "g": 96,
  "b": 64,
  "hex": "#806040"
}
```

Fully transparent pixels are ignored. If the image contains no non-transparent pixels, the underlying generator's fallback color is returned.

## Architecture

This repository is intentionally a thin MCP adapter. Avatar rendering and color calculation remain in `molanko-avatar-generator`; this project handles MCP input/output and delegates the actual image processing to the existing Node.js implementation.
