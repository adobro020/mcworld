# McWorld HTML Server

This folder can be served as a static site, but the original McWorld client also expects old backend services.

Run the included Node server to provide:

- the static HTML/SWF/XML/audio files
- `/healthz` for a simple JSON health check and room/user counts
- `/virtualworld/RemoteService` for remoting requests
- local account creation/login backed by `data/accounts.json`
- live in-memory room multiplayer: users can join rooms, see room counts, receive enter/leave events, receive chat messages, and receive user-variable/avatar-position updates
- `/socket` as a Ruffle WebSocket socket proxy for the old SmartFox port `9339`
- optional raw TCP SmartFox stub on port `9339`

Start locally:

```sh
npm start
```

Then open:

```text
http://localhost:8080/
```

Useful environment variables:

```text
PORT=8080
BASE_PATH=/mcworld
DATA_DIR=./data
ENABLE_TCP=1
SFS_PORT=9339
MAX_BODY_BYTES=1048576
MAX_SOCKET_BUFFER_BYTES=1048576
```

Account data is stored in `DATA_DIR/accounts.json`. On hosted services, use a persistent disk if you want accounts to survive redeploys/restarts.

Multiplayer room state is currently in memory. Everyone connected to the same running Node process can see each other, but room presence resets if the process restarts. If you scale to multiple instances, use sticky sessions or add a shared state layer first.

For a hosted site, deploy this as a Node app rather than GitHub Pages. GitHub Pages can host the files, but it cannot run `/virtualworld/RemoteService` or `/socket`.
