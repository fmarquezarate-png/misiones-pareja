import { describe, it, expect } from "vitest";
import { summarizeEvents } from "../lib/diagnostics.js";

const rows = [
  { name: "save_ok", props: { blob_size: 58000 }, ts: "2026-08-24T10:00:00Z" },
  { name: "save_ok", props: { blob_size: 60000 }, ts: "2026-08-24T12:00:00Z" }, // más reciente
  { name: "save_error", props: { message: "timeout", code: "57014", blob_size: 4000000 }, ts: "2026-08-23T09:00:00Z" },
  { name: "cas_rpc_error", props: { msg: "RLS" }, ts: "2026-08-24T11:00:00Z" },
  { name: "app_open", props: { version: "5.21.0" }, ts: "2026-08-24T08:00:00Z" },
];

describe("summarizeEvents", () => {
  it("cuenta por tipo y ordena por frecuencia", () => {
    const s = summarizeEvents(rows);
    expect(s.total).toBe(5);
    expect(s.byName.save_ok).toBe(2);
    expect(s.names[0]).toBe("save_ok"); // el más frecuente primero
  });

  it("último blob = el del save más reciente; máximo = el mayor", () => {
    const s = summarizeEvents(rows);
    expect(s.latestBlob).toBe(60000); // save_ok de las 12:00
    expect(s.maxBlob).toBe(4000000);  // el save_error viejo de 4MB
  });

  it("aísla los fallos accionables con su detalle, más recientes primero", () => {
    const s = summarizeEvents(rows);
    expect(s.errorCount).toBe(2); // save_error + cas_rpc_error (app_open/save_ok no cuentan)
    expect(s.errorsRecent[0].name).toBe("cas_rpc_error"); // 11:00 > 09:00
    const se = s.errorsRecent.find(e => e.name === "save_error");
    expect(se.code).toBe("57014");
    expect(se.blob_size).toBe(4000000);
    expect(se.message).toBe("timeout");
  });

  it("toma message de props.message | msg | error", () => {
    const s = summarizeEvents([{ name: "cas_rpc_error", props: { msg: "hola" }, ts: "2026-08-24T11:00:00Z" }]);
    expect(s.errorsRecent[0].message).toBe("hola");
  });

  it("tolera lista vacía / entradas inválidas", () => {
    const s = summarizeEvents([null, { props: {} }, undefined]);
    expect(s.total).toBe(3);
    expect(s.errorCount).toBe(0);
    expect(s.latestBlob).toBeNull();
    expect(summarizeEvents(undefined).total).toBe(0);
  });
});
