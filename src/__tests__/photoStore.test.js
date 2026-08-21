import { describe, it, expect } from "vitest";
import { extFromMime, isInlinePhoto, dataUrlToBlob, storagePathFromUrl, applyWeekPhotoMigration, applyCapsulePhotoMigration } from "../lib/photoStore.js";

describe("extFromMime", () => {
  it("jpeg → jpg", () => expect(extFromMime("image/jpeg")).toBe("jpg"));
  it("png/webp se mantienen", () => {
    expect(extFromMime("image/png")).toBe("png");
    expect(extFromMime("image/webp")).toBe("webp");
  });
  it("vacío/raro → jpg", () => {
    expect(extFromMime("")).toBe("jpg");
    expect(extFromMime(undefined)).toBe("jpg");
  });
});

describe("isInlinePhoto", () => {
  it("true solo para data URLs base64", () => {
    expect(isInlinePhoto("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isInlinePhoto("https://x.supabase.co/storage/.../a.jpg")).toBe(false);
    expect(isInlinePhoto(null)).toBe(false);
    expect(isInlinePhoto(undefined)).toBe(false);
  });
});

describe("dataUrlToBlob", () => {
  it("decodifica un dataURL a Blob con el mime correcto", () => {
    // "hi" en base64 = aGk=
    const blob = dataUrlToBlob("data:image/png;base64,aGk=");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(2);
  });
});

describe("storagePathFromUrl", () => {
  it("extrae el path del objeto de una URL pública del bucket photos", () => {
    const url = "https://proj.supabase.co/storage/v1/object/public/photos/uid123/weeks/2026-W27-abc.jpg";
    expect(storagePathFromUrl(url)).toBe("uid123/weeks/2026-W27-abc.jpg");
  });
  it("ignora query string", () => {
    expect(storagePathFromUrl("https://x/storage/v1/object/public/photos/a/b.jpg?token=1")).toBe("a/b.jpg");
  });
  it("null si no es una URL del bucket (p.ej. base64 o vacío)", () => {
    expect(storagePathFromUrl("data:image/png;base64,aGk=")).toBeNull();
    expect(storagePathFromUrl("")).toBeNull();
    expect(storagePathFromUrl(null)).toBeNull();
  });
});

describe("applyWeekPhotoMigration", () => {
  const weeks = {
    "2026-W27": { missions: [], photo: "data:image/jpeg;base64,AAAA" },
    "2026-W28": { missions: [], photo: "data:image/jpeg;base64,BBBB" },
    "2026-W29": { missions: [], photoUrl: "https://x/y.jpg" }, // ya migrada
  };
  it("reemplaza base64 por URL solo en las keys de urlMap que siguen inline", () => {
    const out = applyWeekPhotoMigration(weeks, { "2026-W27": "https://s/27.jpg" });
    expect(out["2026-W27"]).toEqual({ missions: [], photoUrl: "https://s/27.jpg", photo: null });
    expect(out["2026-W28"].photo).toBe("data:image/jpeg;base64,BBBB"); // intacta (no en urlMap)
    expect(out["2026-W29"].photoUrl).toBe("https://x/y.jpg"); // sin tocar
  });
  it("no pisa una foto que ya no es inline (realtime la cambió)", () => {
    const w = { k: { photoUrl: "https://nueva.jpg" } };
    expect(applyWeekPhotoMigration(w, { k: "https://vieja.jpg" }).k.photoUrl).toBe("https://nueva.jpg");
  });
  it("tolera weeks/urlMap vacíos", () => {
    expect(applyWeekPhotoMigration(undefined, undefined)).toEqual({});
  });
});

describe("applyCapsulePhotoMigration", () => {
  it("migra por id solo las cápsulas inline presentes en urlMap", () => {
    const caps = [
      { id: "a", photo: "data:image/jpeg;base64,AAAA" },
      { id: "b", photo: "data:image/jpeg;base64,BBBB" },
      { id: "c", photoUrl: "https://x/c.jpg" },
    ];
    const out = applyCapsulePhotoMigration(caps, { a: "https://s/a.jpg" });
    expect(out[0]).toEqual({ id: "a", photoUrl: "https://s/a.jpg", photo: null });
    expect(out[1].photo).toBe("data:image/jpeg;base64,BBBB");
    expect(out[2].photoUrl).toBe("https://x/c.jpg");
  });
  it("tolera lista vacía", () => {
    expect(applyCapsulePhotoMigration(undefined, {})).toEqual([]);
  });
});
