# gnome-shell-extension-caffeine (CONSTRUCT fork)

Caffeine adds a Quick Settings toggle that keeps the session from going idle
and the machine from suspending, by hand, on a timer, while chosen apps run,
while a window is fullscreen or while media plays.

This is the fork CONSTRUCT ships. It follows upstream's `master` on the
`gnome-51` branch and targets GNOME Shell 51 only.

## Changes from upstream

- **The screen can blank while the session is locked** (upstream #366). The
  extension stays enabled on the lock screen, where its idle inhibitor kept
  the monitors on. While locked it now inhibits suspend only, and switches
  back when the session unlocks.
- **GNOME Shell 51 only**: `metadata.json` lists 51, and the fallbacks for
  older shells are gone.
- **Repository trimmed** to what the package is built from: no GitHub
  workflows, screenshots, extensions.gnome.org zip Makefile, ESLint or Nix
  configuration.

## Building

spin-desktop's `recipes/gnome-shell-extension-caffeine.yaml` installs it by
hand: the extension's JavaScript, `metadata.json`, `preferences/` and `icons/`
into `/usr/share/gnome-shell/extensions/caffeine@patapon.info`, the schema into
`/usr/share/glib-2.0/schemas`, and each `locale/*.po` compiled with `msgfmt`
into `/usr/share/locale/<lang>/LC_MESSAGES/gnome-shell-extension-caffeine.mo`.

`update-locale.sh` refreshes the catalogs from the sources.

The state can be toggled from a shell:

```sh
gsettings set org.gnome.shell.extensions.caffeine cli-toggle true
```

## Attribution and license

Caffeine is by Jean-Philippe Braun (eonpatapon), Stuart Hayhurst,
pakaoraki and its other contributors:
<https://github.com/eonpatapon/gnome-shell-extension-caffeine>.

GPL-2.0-or-later; see `COPYING`.
