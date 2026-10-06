# Jeopardy

Build Jeopardy boards (images, YouTube clips, any number of rows and columns), then run them on a big screen. Players can join a named room on their phones, pick a team and buzz in, or you can run the game in person without phones.

## Run locally

```bash
npm install
cp .env.example .env   # optional: set HOST_PASSWORD
npm run dev
```

Open http://localhost:3000. The terminal also prints a `http://192.168.x.x:3000` address; phones on the same Wi-Fi use that one (the QR code on the host screen points there automatically).

## How a game works

1. **Boards** → **New board**. Name categories, add/remove rows and columns, click a tile to write the clue, answer, image or YouTube link, and mark Daily Doubles. Set the Final Jeopardy clue from the toolbar.
2. **Start game** on a board. Give the room any name (it becomes `/play/your-room-name` and never changes), choose **Live room** or **In person**, and set up teams. A board can have many rooms; each room keeps its own scores and resumes where you left off.
3. **Live room**: players scan the QR code, enter a name and pick a team (any number per team). Open a clue, press **Countdown** (or Space). After 3-2-1 every phone lights up; the first buzz shows on screen with the team and player, plus the full buzz order. Buzzing early gives a short penalty. Mark ✓ or ✕ per team; a wrong answer locks out the whole team.
4. **In person**: same board, no phones. Tap the team that answered, then ✓ or ✕. The countdown still shows on screen for hand or bell buzzing.
5. **Daily Double**: pick the team, then they wager on their phone (or you type it). **Final Jeopardy**: teams with a positive score wager and answer on their phones; you reveal and judge each one.

Shortcuts on the clue screen: `Space` countdown, `A` reveal answer. Right-click a used tile to restore it.

## Configuration

| Variable | Purpose |
| --- | --- |
| `HOST_PASSWORD` | Required to edit boards and host. Leave empty for local use. |
| `SESSION_SECRET` | Signs the host login cookie. |
| `DATA_DIR` | SQLite database and uploaded images. Use a persistent volume in production. |
| `PORT` | Defaults to 3000. |

Requires Node 22.13+ (uses the built-in `node:sqlite`).

## Deploy

The app is a single Node process (Next.js + Socket.IO), so it needs a host that keeps a server running and has persistent disk. It does not work on Vercel.

**Railway**: create a service from this repo, add a volume mounted at `/data`, set `DATA_DIR=/data`, `HOST_PASSWORD` and `SESSION_SECRET`. Railway builds the `Dockerfile` automatically.

**Fly.io**: `fly launch` (uses the `Dockerfile`), then `fly volumes create data --size 1` and add to `fly.toml`:

```toml
[mounts]
  source = "data"
  destination = "/data"
```

Set secrets with `fly secrets set HOST_PASSWORD=... SESSION_SECRET=...`.

**Render**: create a Web Service with the Docker runtime, attach a disk at `/data`, and set the same environment variables.

Without Docker: `npm ci && npm run build && npm start`.
