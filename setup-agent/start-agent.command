#!/bin/bash
# Double-click this file to start the law-school setup agent.
# Close the Terminal window (or press Ctrl-C) to stop it.

cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo
echo "  law-school setup agent"
echo "  ----------------------"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js is not installed. Get the LTS build from https://nodejs.org, install it,"
  echo "  then double-click this file again."
  echo
  read -r -p "  Press Return to close. "
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First run: installing dependencies (takes about 30 seconds)..."
  if ! npm install --omit=dev --no-audit --no-fund; then
    echo
    echo "  npm install failed. Check your internet connection and try again."
    read -r -p "  Press Return to close. "
    exit 1
  fi
fi

# exec so closing the window sends the hang-up straight to the agent and it exits.
exec node server.mjs
