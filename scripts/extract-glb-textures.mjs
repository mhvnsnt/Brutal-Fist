import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const files = process.argv.slice(2);
mkdirSync("public/models/textures", { recursive: true });

function extract(path) {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const jsonPad = jsonLen % 4 === 0 ? 0 : 4 - (jsonLen % 4);
  const binOffset = 20 + jsonLen + jsonPad + 8;
  const bin = buf.subarray(binOffset);
  const stem = basename(path, ".glb").replace(/_skinned$/i, "");
  const images = json.images ?? [];
  images.forEach((img, i) => {
    let bytes;
    let ext = "png";
    if (img.uri && img.uri.startsWith("data:")) {
      const match = img.uri.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return;
      ext = match[1].includes("jpeg") ? "jpg" : "png";
      bytes = Buffer.from(match[2], "base64");
    } else if (img.bufferView != null) {
      const view = json.bufferViews[img.bufferView];
      bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const mime = img.mimeType ?? "";
      ext = mime.includes("jpeg") ? "jpg" : "png";
    } else {
      return;
    }
    const out = join("public/models/textures", `${stem}_${i}.${ext}`);
    writeFileSync(out, bytes);
    console.log("wrote", out, bytes.length);
  });
}

for (const f of files) extract(f);
