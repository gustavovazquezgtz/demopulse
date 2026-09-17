import { describe, it, expect } from "vitest";
import { sortRows } from "@/lib/sort";

const rows = [
  { name: "Kirk Santiago", score: 72, joined: new Date("2026-09-03") },
  { name: "Mariano", score: 88, joined: new Date("2026-09-01") },
  { name: "Emanuell", score: 92, joined: new Date("2026-09-10") },
];

describe("sortRows", () => {
  it("sorts numerically descending by default when no explicit dir is given", () => {
    const result = sortRows(rows, "score", undefined, "score", "desc");
    expect(result.map((r) => r.name)).toEqual(["Emanuell", "Mariano", "Kirk Santiago"]);
  });

  it("sorts numerically ascending when dir=asc", () => {
    const result = sortRows(rows, "score", "asc", "score", "desc");
    expect(result.map((r) => r.name)).toEqual(["Kirk Santiago", "Mariano", "Emanuell"]);
  });

  it("sorts strings alphabetically (locale-aware) for asc/desc", () => {
    const asc = sortRows(rows, "name", "asc", "score", "desc");
    expect(asc.map((r) => r.name)).toEqual(["Emanuell", "Kirk Santiago", "Mariano"]);
  });

  it("sorts Date fields chronologically", () => {
    const result = sortRows(rows, "joined", "asc", "score", "desc");
    expect(result.map((r) => r.name)).toEqual(["Mariano", "Kirk Santiago", "Emanuell"]);
  });

  it("falls back to the default column and direction when sort is unspecified", () => {
    const result = sortRows(rows, undefined, undefined, "score", "desc");
    expect(result.map((r) => r.name)).toEqual(["Emanuell", "Mariano", "Kirk Santiago"]);
  });

  it("does not mutate the input array", () => {
    const original = [...rows];
    sortRows(rows, "score", "asc", "score", "desc");
    expect(rows).toEqual(original);
  });

  it("sorts null values last regardless of direction", () => {
    const withNulls = [{ name: "a", score: 50 }, { name: "b", score: null }, { name: "c", score: 90 }];
    const desc = sortRows(withNulls, "score", "desc", "score", "desc");
    expect(desc.map((r) => r.name)).toEqual(["c", "a", "b"]);
    const asc = sortRows(withNulls, "score", "asc", "score", "desc");
    expect(asc.map((r) => r.name)).toEqual(["a", "c", "b"]);
  });
});
