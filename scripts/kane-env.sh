# Local setup for running Kane on a headless Linux server (sourced by npm scripts when present).
export PATH="$HOME/.local/opt/node-v26.13.1-linux-x64/bin:$PATH"
[ -d "$HOME/.cache/chrome-libs" ] && export LD_LIBRARY_PATH="$HOME/.cache/chrome-libs/root/usr/lib/x86_64-linux-gnu"
[ -z "$KANE_CLI_CHROME_PATH" ] && [ -x "$HOME/.cache/ms-playwright/chromium_headless_shell-1193/chrome-linux/headless_shell" ] && export KANE_CLI_CHROME_PATH="$HOME/.cache/ms-playwright/chromium_headless_shell-1193/chrome-linux/headless_shell"
[ -f "$HOME/.config/fontconfig/fonts.conf" ] && [ ! -f /etc/fonts/fonts.conf ] && export FONTCONFIG_FILE="$HOME/.config/fontconfig/fonts.conf"
