#!/bin/bash
set -e

current_directory="$PWD"

cd $(dirname $0)

if [ "$SKIP_INSTALL" = true ] || [ "$SKIP_INSTALL" = 1 ]
then
  echo SKIP_INSTALL is set, skipping dependency installation...
else
  yarn install --immutable
fi

yarn build

cd "$current_directory"
