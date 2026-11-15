// Clothing record shared by the Worker, the seed script, and (mirrored in) server.py.
// A capo is { id, house, section, name, type?, color?, brand?, notes? }.

export const HOUSES = ["Milano", "Reggio", "Sardegna"];

export const SECTIONS = [
  "sec1-top-rail",
  "sec1-bottom-rail",
  "sec2-top-shelf",
  "sec2-middle-rail",
  "sec2-drawer2-col1",
  "sec2-drawer2-col2",
  "sec2-drawer3-col1",
  "sec2-drawer3-col2",
  "sec2-drawer3-col3",
];

export const TYPES = ["jacket", "shirt", "hoodie", "sweater", "tshirt", "pants", "shorts"];

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * @param {unknown} data
 * @returns {string | null} Italian error message, or null when the list is valid.
 */
export function validateItems(data) {
  if (!Array.isArray(data)) return "Il payload deve essere una lista di capi.";
  const ids = new Set();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return `Elemento ${i}: deve essere un oggetto.`;
    }
    const rec = /** @type {Record<string, unknown>} */ (item);
    for (const key of ["id", "house", "section", "name"]) {
      if (typeof rec[key] !== "string" || rec[key].trim() === "") {
        return `Elemento ${i}: campo ${key} mancante.`;
      }
    }
    const id = rec.id.trim();
    const name = rec.name;
    if (id.length > 80) return `Elemento ${i}: id troppo lungo.`;
    if (name.length > 200) return `Elemento ${i}: nome troppo lungo.`;
    if (!HOUSES.includes(rec.house)) return `Elemento ${i}: casa non valida.`;
    if (!SECTIONS.includes(rec.section)) return `Elemento ${i}: sezione non valida.`;
    if (ids.has(id)) return `Elemento ${i}: id duplicato.`;
    ids.add(id);

    if (rec.type !== undefined) {
      if (typeof rec.type !== "string") return `Elemento ${i}: campo type non valido.`;
      if (rec.type !== "" && !TYPES.includes(rec.type)) return `Elemento ${i}: tipo non valido.`;
    }
    if (rec.color !== undefined) {
      if (typeof rec.color !== "string" || (rec.color !== "" && !HEX.test(rec.color))) {
        return `Elemento ${i}: colore non valido.`;
      }
    }
    for (const key of ["brand", "notes"]) {
      if (rec[key] !== undefined && typeof rec[key] !== "string") {
        return `Elemento ${i}: campo ${key} non valido.`;
      }
      if (typeof rec[key] === "string" && rec[key].length > 500) {
        return `Elemento ${i}: campo ${key} troppo lungo.`;
      }
    }
  }
  return null;
}
