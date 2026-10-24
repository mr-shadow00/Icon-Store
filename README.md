## About

Icon Store is a self hosted icon app for zimaos and casaos

You uplode your icon in it and caop the link to use in dashboard

## How to install

1. make a folder call icon-store
2. move public, package.json, package-lock.json, server.js to it
3. use the [icon-store compose.yaml] on App Store → "Install a Customized App" → Docker Compose tab
4. w8
5. enjoy

## Offline use

Fonts are bundled locally (public/fonts), so the UI loads with no internet.
Internet is only needed once, on first start, to pull the node image and run npm install.
After that, everything works on your LAN without internet.
