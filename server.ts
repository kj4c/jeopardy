import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";

if (existsSync(".env")) process.loadEnvFile(".env");

const { default: next } = await import("next");
const { Server } = await import("socket.io");
const { handleApi, serveUpload } = await import("./server/api");
const { attachRooms } = await import("./server/rooms");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname.startsWith("/api/")) return void handleApi(req, res, pathname);
  if (pathname.startsWith("/uploads/")) return serveUpload(req, res, pathname);
  handle(req, res);
});

const io = new Server(httpServer, { path: "/socket.io", maxHttpBufferSize: 1e5 });
attachRooms(io);

httpServer.listen(port, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i!.address}:${port}`);
  console.log(`> Jeopardy ready on http://localhost:${port} (${dev ? "dev" : "production"})`);
  if (lan.length) console.log(`> Phones on the same Wi-Fi: ${lan.join("  ")}`);
});
