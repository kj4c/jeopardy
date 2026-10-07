# Jeopardy

Build Jeopardy boards (images, YouTube clips, any number of rows and columns), then run them on a big screen. Players can join a named room on their phones, pick a team and buzz in, or you can run the game in person without phones.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The terminal also prints a `http://192.168.x.x:3000` address; phones on the same Wi-Fi use that one (the QR code on the host screen points there automatically).

## How a game works

1. **Boards** → **Create a board** with a name and a password. The name becomes the board's permanent link, `/b/your-board-name`. On any other device, open that link (or type the name under **Open a board**) and enter the password to edit or host. A device stays unlocked for 30 days, or until you press **Lock**. In the editor, name categories, add/remove rows and columns, click a tile to write the clue, answer, image or YouTube link, and mark Daily Doubles. Set the Final Jeopardy clue from the toolbar.
2. **Start game** on a board. Give the room any name (it becomes `/play/your-room-name` and never changes), choose **Live room** or **In person**, and set up teams. A board can have many rooms; each room keeps its own scores and resumes where you left off.
3. **Live room**: players scan the QR code, enter a name and pick a team (any number per team). Open a clue, press **Countdown** (or C). After 3-2-1 every phone lights up; the first buzz shows on screen with the team and player, plus the full buzz order. Buzzing early gives a short penalty. Mark ✓ or ✕ per team; a wrong answer locks out the whole team.
4. **In person**: same board, no phones. Tap the team that answered, then ✓ or ✕. The countdown still shows on screen for hand or bell buzzing.
5. **Daily Double**: pick the team, then they wager on their phone (or you type it). **Final Jeopardy**: teams with a positive score wager and answer on their phones; you reveal and judge each one.

Shortcuts on the clue screen: `Space` reveal answer, `C` countdown, `Q` show/hide question. Right-click a used tile to restore it.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs board login cookies. Required in production (the server won't start without it); generate one with `openssl rand -hex 32`. |
| `DATA_DIR` | SQLite database and uploaded images. Use a persistent volume in production. |
| `PORT` | Defaults to 3000. |

Requires Node 22.13+ (uses the built-in `node:sqlite`).

## Deploy

The app is a single Node process (Next.js + Socket.IO), so it needs a host that keeps a server running and has persistent disk. It does not work on Vercel.

**Railway**: create a service from this repo, add a volume mounted at `/data`, set `DATA_DIR=/data` and `SESSION_SECRET`. Railway builds the `Dockerfile` automatically.

**Fly.io**: `fly launch` (uses the `Dockerfile`), then `fly volumes create data --size 1` and add to `fly.toml`:

```toml
[mounts]
  source = "data"
  destination = "/data"
```

Set secrets with `fly secrets set SESSION_SECRET=...`.

**Render**: create a Web Service with the Docker runtime, attach a disk at `/data`, and set the same environment variables.

Without Docker: `npm ci && npm run build && npm start`.
