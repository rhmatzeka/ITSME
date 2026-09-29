# Desa Mapporto: a Portfolio You Can Walk Through

My portfolio as a small 2D pixel-art game. Instead of scrolling a page, you walk a character around a village. Each house, bench, or stall is a stop that opens a section: about me, my CV, my tech stack, my projects, and how to contact me.

**Live site:** https://www.rahmateka.my.id

## How to play

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Walk |
| Click the ground | Walk to that spot |
| Click a house, bench, or stall | Travel there |
| Click the minimap | Open the full map |
| `Esc` | Close a panel or the map |

On phones, a virtual joystick appears: **A** enters the nearest stop and **B** opens the map.

## Tech stack

Astro, Phaser 3, TypeScript, Tailwind CSS v4, and a map drawn in [Tiled](https://www.mapeditor.org/). Deployed on Vercel.

## Quick start

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:4321.

## Repository layout

| Folder | What it is |
| --- | --- |
| `web/` | The website and game. **See [web/README.md](web/README.md) for the full guide**: asset pipeline, collisions, and the admin page. |
| `mapporto/` | The Tiled map (`map.tmx`) and the pixel-art asset packs it uses |
| `plan.md` | The original design plan |

## Editing content

Page text and projects are Markdown files in `web/src/content/`. There is also a password-protected `/admin` page for editing content on the live site, which needs `ADMIN_PASSWORD`, `ADMIN_SECRET`, and a GitHub token (`GITHUB_TOKEN`, `GITHUB_REPO`). Details are in [web/README.md](web/README.md).

## Credits

- Crop sprites in the rice fields and the doormat at the CV house: Assets from [Sprout Lands](https://cupnooble.itch.io/sprout-lands-asset-pack) by Cup Nooble, used under its non-commercial license.

The pixel-art asset packs in `mapporto/` belong to their original authors and are not covered by this repository's MIT License.

## License

Released under the [MIT License](LICENSE).
