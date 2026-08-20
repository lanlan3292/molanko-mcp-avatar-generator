# molanko-mcp-avatar-generator

MCP server for [molanko-avatar-generator](https://github.com/lanlan3292/molanko-avatar-generator).

The server exposes one tool:

- `generate_avatar` — generate a Molanko Avatar from a provided image or a Minecraft player name/UUID, then return the generated PNG as an MCP image result.

A source is required: provide exactly one of `image` or `minecraftPlayer`.

## Run

```bash
npm install
npm start
```

The server uses MCP stdio transport, so it can be launched by MCP clients that support local stdio servers.

## Tool: `generate_avatar`

### Source

Provide exactly one:

- `image` — MCP-style image object: `{ "type": "image", "data": "<base64>", "mimeType": "image/png" }`
- `minecraftPlayer` — Minecraft username or UUID, with or without UUID hyphens. The server resolves the current skin using Mojang's profile and session APIs, then downloads the skin directly from the texture URL supplied by Mojang.

Examples:

```json
{ "minecraftPlayer": "Notch" }
```

```json
{ "minecraftPlayer": "069a79f4-44e9-4726-a5be-fca90e38aaf5" }
```

If both `image` and `minecraftPlayer` are supplied, the request is rejected rather than silently choosing one.

### Options

- `scale` — nearest-neighbor output scale
- `outlineMode` — outline radius; `0` disables the outline
- `outlineColor` — `auto_dark`, `auto_darker`, `auto_medium_dark`, or a hex color
- `bgColor` — `auto_light`, `auto_lighter`, `auto_medium_light`, or a hex color
- `fillBackground` — whether to fill the output background
- `upscale48` — render the 32x32 avatar centered on a 48x48 canvas
- `averageColor` — optional override for the color used by automatic outline/background colors; use `auto`, `#RRGGBB`, or `#RGB`

`averageColor` is **not a separate tool**. It overrides the generator's automatically calculated average color. If omitted or set to `auto`, the underlying generator calculates the average color from the source skin. A hex value is parsed into `{ r, g, b }` and passed to `molanko-avatar-generator` as `averageColor`.

The result is returned as an MCP `image` content item containing a PNG.

## Minecraft player resolution

`minecraftPlayer` follows the same basic approach as the Android avatar generator: a UUID is normalized directly; a username is resolved through `api.mojang.com/users/profiles/minecraft/{name}`; the UUID is then resolved through Mojang's session profile API to obtain the player's `textures` property and skin URL. No third-party skin-rendering or skin-mirroring service is required.

The server reports useful failures such as invalid player identifiers, player not found, missing skin texture, Mojang rate limits, Mojang server errors, and network/download errors.

## Architecture

This repository is intentionally a thin MCP adapter. Minecraft player resolution and avatar rendering happen server-side, while the actual avatar rendering remains in `molanko-avatar-generator`.
