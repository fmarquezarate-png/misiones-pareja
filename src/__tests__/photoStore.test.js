import { describe, it, expect } from "vitest";
import { extFromMime, isInlinePhoto, dataUrlToBlob } from "../lib/photoStore.js";

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
