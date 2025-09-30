// parse-boms.js
const fs = require("fs");
const path = require("path");
const pdf2table = require("pdf2table");

const DEBUG = process.argv.includes("--debug");

const partTypes = {
  "Resistor": "Resistor",
  "Ceramic": "Ceramic Capacitor",
  "Film": "Film Capacitor",
  "Electrolytic": "Electrolytic Capacitor",
  "Capacitor": "Capacitor", 
  "Inductor": "Inductor",
  "Diode": "Diode",
  "Transistor": "Transistor",
  "IC": "IC",
  "LED": "LED",
  "Switch": "Switch",
  "Trimpot": "Trim Pot",
  "Potentiometer": "Potentiometer",
  "Jack": "Jack",
  "Connector": "Connector",
  "Regulator": "Regulator",
};

function debugLog(...args) {
  if (DEBUG) {
    console.debug(...args);
  }
}

/** ---------- Parse Parts List ---------- **/
function parsePartsList(rows) {
  const parts = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    // Skip noise
    if (isNoiseRow(row)) {
      debugLog('Skipping noise row', { row });
      continue;
    }

    const [_, part, ...details] = row;

    let type = normalizeType(row.join("").trim());
    let value = normalizeValue(part, type, row);
    if (!type) {
      debugLog("Could not determine type, skipping row", { row });
      continue;
    }
    if (Array.isArray(details) && details.length > 0) {
      const typeValues = details.map(d => d.trim()).filter(Boolean);
      if (typeValues.some(v => /SPDT|DPDT|SPST|DPST/i.test(v))) {
        type = "Switch";
        value = typeValues.filter(v => /SPDT|DPDT|SPST|DPST/i.test(v)).join(" ") +
          " " +
          typeValues.filter(v => /\(.*\)/.test(v)).join(" ");
        value = value.trim();
      }
    }

    parts.push({ type, value });
  }

  return parts;
}

/** ---------- Parse Shopping List ---------- **/
function parseShoppingList(rows) {
  const parts = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 1) continue;
    if (row[0] === "LED") {
      debugLog("Skipping indicator LED row", { row });
      continue;
    }

    // debugLog("Processing shopping list row", { row });
    const quantity = row[row.length - 1];
    const originalType = row.slice(1, -1).join("").trim();
    let type = originalType ? normalizeType(originalType) : undefined;
    let value = normalizeValue(row[0], type, row);
    if (!type) {
      debugLog("Could not determine type, skipping row", { row });
      continue;
    }

    if (type === "LED" || (row.length > 5 && ["Diode", "IC", "Transistor"].includes(type))) {
      debugLog("Preserving LED or overly complex row", { row });
      value = row.slice(0, -1).join("").trim();
    }

    // debugLog("Parsed shopping list item", { row: row.join("; "), type, value, quantity });
    for (let i = 0; i < quantity; i++) {
      parts.push({ type, value });
    }
  }
  return parts;
}

function normalizeValue(value, type, fullRow) {
  if (!value) return "";

  let normalized = value.trim();
  const combinedRow = fullRow.join("").toUpperCase();
  switch (type) {
    case partTypes["Resistor"]:
      normalized = value.replace("Ω", "R").toUpperCase().replace("OHM", "R").replace("OHMS", "R").replace("KΩ", "K").replace("M", "M").replace("MΩ", "M");
      if (/^\d+$/.test(normalized)) {
        normalized += "R";
      }
      break;
    case partTypes["Ceramic"]:
      normalized = value.toLowerCase().replace("pf", "p");
      if (/^\d+$/.test(normalized)) normalized += "p";
      break;
    case partTypes["Film"]:
      normalized = value.replace("nf", "n").replace("µ", "u").replace("μ", "u").replace("uf", "u").replace("mf", "u");
      // debugLog("Normalized film capacitor value", { original: value, normalized });
      if (/^\d+$/.test(normalized)) normalized += "n";
      break;
    case partTypes["Electrolytic"]:
      normalized = value.toLowerCase().replace("µ", "u").replace("μ", "u").replace("uf", "u");
      if (/^\d+$/.test(normalized)) normalized += "u";
      break;
    case partTypes["Capacitor"]:
      normalized = value.toLowerCase().replace("µ", "u").replace("μ", "u").replace("mf", "u").replace("uf", "u").replace("μμ", "u");
      break;
    case partTypes["Inductor"]:
      normalized = value.toLowerCase().replace("mh", "mH").replace("uh", "uH").replace("μh", "uH");
      break;
    case partTypes["Trimpot"]:
      normalized = value.toUpperCase().match(/\d{1,3}K/)?.[0] || value.toUpperCase();
      break;
    case partTypes["Transistor"]:
      // Normalize common transistor part numbers
      if (/^J201/i.test(value)) normalized = "J201";
      else if (/^2N3904/i.test(value)) normalized = "2N3904";
      else if (/^2N3906/i.test(value)) normalized = "2N3906";
      else if (/^2N5088/i.test(value)) normalized = "2N5088";
      else if (/^2N5089/i.test(value)) normalized = "2N5089";
      else if (/^2N5087/i.test(value)) normalized = "2N5087";
      else if (/^BC549C?/i.test(value)) normalized = "BC549C";
      else if (/^BC550C?/i.test(value)) normalized = "BC550C";
      else if (/^BC560C?/i.test(value)) normalized = "BC560C";
      else if (/^2N2222A?/i.test(value)) normalized = "2N2222A";
      else if (/^PN2222A?/i.test(value)) normalized = "PN2222A";
      else if (/^PN2907A?/i.test(value)) normalized = "PN2907A";
      else if (/^2N2907A?/i.test(value)) normalized = "2N2907A";
      else if (/^2N5457/i.test(value)) normalized = "2N5457";
      else if (/^2N5484/i.test(value)) normalized = "2N5484";
      else if (/^J113/i.test(value)) normalized = "J113";
      else if (/^MPF102/i.test(value)) normalized = "MPF102";
      else if (/^BS170/i.test(value)) normalized = "BS170";
      else if (/^2N7000/i.test(value)) normalized = "2N7000";
      else if (/^2N5550/i.test(value)) normalized = "2N5550";
      else if (/^MPSA18/i.test(value)) normalized = "MPSA18";
      else if (/^MP38A/i.test(value)) normalized = "MP38A";
      else if (/^(?=.*GERMANIUM)(?=.*NPN).*$/i.test(combinedRow)) normalized = "NPN Germanium";
      else if (/^(?=.*GERMANIUM)(?=.*PNP).*$/i.test(combinedRow)) normalized = "PNP Germanium";
      else if (/^(?=.*SILICON)(?=.*NPN).*$/i.test(combinedRow)) normalized = "NPN Silicon";
      else if (/^(?=.*SILICON)(?=.*PNP).*$/i.test(combinedRow)) normalized = "PNP Silicon";
      // Try to extract transistor part numbers from garbled rows
      else if (!/^[A-Z]{2,3}\d{2,4}$/i.test(value)) {
        const m = combinedRow.match(/(?<!\w)(2N\d+[A-C]?)/i);

        if (m) {
          normalized = m[0];
        } else {
          debugLog("Could not extract transistor value from row", { fullRow, combinedRow });
          normalized = combinedRow.toUpperCase();
        }
      }
      break;
    case partTypes["IC"]:
      if (/4558/i.test(value)) normalized = "4558";
      if (/TL071/i.test(value)) normalized = "TL071";
      if (/TL072/i.test(value)) normalized = "TL072";
      if (/TL074/i.test(value)) normalized = "TL074";
      if (/LM741/i.test(value)) normalized = "LM741";
      if (/LM1458/i.test(value)) normalized = "LM1458";
      if (/LM308/i.test(value)) normalized = "LM308";
      if (/LM324/i.test(value)) normalized = "LM324";
      if (/NE5532/i.test(value)) normalized = "NE5532";
      if (/OP275/i.test(value)) normalized = "OP275";
      if (/OP07/i.test(value)) normalized = "OP07";
      break;
  }

  const strictNotationTypes = [partTypes["Resistor"], partTypes["Electrolytic"], partTypes["Inductor"], partTypes["Ceramic"], partTypes["Film"]];

  // Convert values like 10K5 or 4K7 to 10.5K or 4.7K
  if (strictNotationTypes.includes(type)) {
    const rcValueRegex = /^(\d{1,3})([RKMUNP])(\d{1,2})$/i;
    if (rcValueRegex.test(normalized)) {
      normalized = normalized.replace(rcValueRegex, (_, intPart, unit, fracPart) => {
        return `${intPart}.${fracPart}${unit}`;
      });
    }
  }
  return normalized;
}

function parseGenericRow(location, value, row) {
  location = location.trim();
  value = value.trim();
  let type = "Unknown";
  let normalizedValue;

  // Identify component by location
  if (/^R\d{1,3}$/i.test(location)) {
    type = "Resistor";
  } else if (/^C\d{1,3}$/i.test(location)) {
    const lowerValue = value.toLowerCase();
    if (/[0-9]+p/.test(lowerValue) || /(?:ceramic|disk)/i.test(lowerValue)) type = partTypes["Ceramic"];
    else if (/[0-9]+n/.test(lowerValue) || /(?:film|mylar)/i.test(lowerValue)) type = partTypes["Film"];
    else if (/[0-9]+u/.test(lowerValue) || /(?:electrolytic|alu|aluminum)/i.test(lowerValue)) type = partTypes["Electrolytic"];
    else type = partTypes["Capacitor"];
  } else if (/^L\d{1,3}$/i.test(location)) type = partTypes["Inductor"];
  else if (/^D\d{1,3}$/i.test(location)) type = partTypes["Diode"];
  else if (/^Q\d{1,3}$/i.test(location)) type = partTypes["Transistor"];
  else if (/^IC\d{1,3}$/i.test(location)) type = partTypes["IC"];
  else if (/^LED\d{0,3}$/i.test(location)) {
    type = partTypes["LED"];
    normalizedValue = value;
  } else if (/^SW/i.test(location)) type = partTypes["Switch"];
  else if (/^VR\d{0,3}$|^TPOT\d{0,3}$|^TRIM\d{0,3}$/i.test(location)) type = partTypes["Trimpot"];
  else if (/^POT\d{0,3}$|^16MM\d{0,3}$/i.test(location)) type = partTypes["Potentiometer"];
  else if (/^J\d{0,3}$/i.test(location)) type = partTypes["Jack"];
  else if (/^REG\d{0,3}$/i.test(location)) type = partTypes["Regulator"];

  // fallback for switches/pots
  if (/^(?:[1-9]PDT|S?PDT)(?:\s*\([^)]+\))?$/i.test(value) || /PDT/i.test(location) ) {
    type = partTypes["Switch"];
    normalizedValue = normalizeValue(value, partTypes["Switch"], row);;
  } else if (/^DIP\d{0,3}$/i.test(location)) {
    type = partTypes["Switch"];
    normalizedValue = value += " DIP";
  } else if (/\b[ABCW]\d{1,3}[MK]\b/i.test(value)) {
    type = partTypes["Potentiometer"];
    normalizedValue = value;
  }

  normalizedValue = normalizedValue ?? normalizeValue(value, type, row);
  return { type, value: normalizedValue };
}

function parseGenericBom(rows) {
  const parts = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;
    const isGarbled = row.every(cell => typeof cell === "string" && cell.trim().length <= 2);
    if (isGarbled) continue;
    const isHeader = row.every(cell => typeof cell === "string" && /^[A-Za-z\s]+$/.test(cell) && cell.trim().length > 2);
    if (isHeader) continue;

    for (let i = 0; i < row.length; i += 2) {
      if (isNoiseRow(row)) continue;
      const location = row[i]?.trim();
      const value = row[i + 1]?.trim();

      if (!location || !value) continue;

      // debugLog("Processing generic row segment", { location, value });
      const parsed = parseGenericRow(location, value, row);
      if (parsed.type === "Unknown") {
        console.log("⚠️ Could not classify part", { location, value });
        continue;
      }
      parts.push(parsed);
    }
  }
  return parts;
}

function isNoiseRow(row) {
  if (!row) return true;
  if (Array.isArray(row) && row.length === 4 && 
    row.every((cell, i) => cell === ['LOCATION', 'VALUE', 'TYPE', 'NOTES'][i])) return true;
  
  const stringsToCheck = Array.isArray(row) ? row : [row];
  const noisePatterns = [
    /COPYRIGHT/i, /©/, /PEDALPCB\.COM/i,
    /RESISTORS|CAPACITORS|TRANSISTORS|INTEGRATED CIRCUITS/i,
    /CONTINUED/i, /PAGE \d+/i,
    /^•$/, /^\d+$/, /NEXT PAGE(\.\.\.|…)/i, /TYPE NOTE/i, /DIAGRAM/i
  ];
  return stringsToCheck.some(str => noisePatterns.some(regex => regex.test(str)));
}

/** ---------- Extract BOM ---------- **/
function extractBOM(partsList) {
  const bomMap = {};
  for (const part of partsList) {
    const type = part.type;
    const value = part.value.toUpperCase().replace("µ", "U").replace("Ω", "R").trim();
    const key = `${type}|${value}`;
    if (!bomMap[key]) bomMap[key] = { type, value, quantity: 0 };
    bomMap[key].quantity++;
  }
  const sortedKeys = Object.keys(bomMap).sort((a, b) => {
    const [typeA, valueA] = a.split("|");
    const [typeB, valueB] = b.split("|");
    const typeCompare = typeA.localeCompare(typeB);
    if (typeCompare !== 0) return typeCompare;
    return valueA.localeCompare(valueB);
  });
  return sortedKeys.map(k => bomMap[k]);
}

/** ---------- Normalize type string ---------- **/
function normalizeType(type) {
  if (!type) return;
  const t = (type || "").toLowerCase();
  if (t.includes("resistor") || t.includes("¼")) return partTypes["Resistor"];
  if (t.includes("film")) return partTypes["Film"];
  if (t.includes("elec")) return partTypes["Electrolytic"];
  if (t.includes("ceramic")) return partTypes["Ceramic"];
  if (t.includes("capacitor")) return partTypes["Capacitor"];
  if (t.includes("inductor")) return partTypes["Inductor"];
  if (t.includes("led") || t.includes("3mm") || t.includes("5mm") || t.includes("diffused")) return partTypes["LED"];
  if (t.includes("diode") || t.includes("zener")) return partTypes["Diode"];
  if (t.includes("switch") || t.includes("toggle") || /^(?:[1-9]PDT|S?PDT)(?:\s*\([^)]+\))?$/i.test(type)) return partTypes["Switch"];
  if (t.includes("trim") || t.includes("trimmer") || /^(VR|TPOT)\d{0,3}$/i.test(type)) return partTypes["Trimpot"];
  if (t.includes("potentiometer") || t.includes("pot") || t.includes("16mm") || t.includes("16 mm")) return partTypes["Potentiometer"];
  if (t.includes("jack")) return partTypes["Jack"];
  if (t.includes("connector")) return partTypes["Connector"];
  if (t.includes("transistor") || t.includes("bjt") || t.includes("fet") || t.includes("pnp") || t.includes("npn")) return partTypes["Transistor"];
  if (t.includes("ic") || t.includes("op amp") || t.includes("op-amp") || t.includes("opamp")) return partTypes["IC"];

  return;
}

/** ---------- Main: parse PDFs ---------- **/
async function extractFileBOM(filePath) {
  const buffer = fs.readFileSync(filePath);

  const parsers = [
    {
      name: "Shopping List", header: "SHOPPING", parser: parseShoppingList
    },
    {
      name: "Parts List", header: "LOCATIONVALUE", parser: parsePartsList
    }
  ];

  return new Promise((resolve) => {
    pdf2table.parse(buffer, function (err, rows) {
      if (err) {
        console.error(`❌ Error parsing ${filePath}: ${err}`);
        return resolve([]);
      }

      let headerIndex = -1;
      let bomType = "Generic";
      let parser = parseGenericBom;
      for (const p of parsers) {
        headerIndex = rows.findIndex(row => row.join("").toUpperCase().includes(p.header));
        if (headerIndex !== -1) {
          parser = p.parser;
          bomType = p.name;
          break;
        }
      }
      
      const startIndex = headerIndex !== -1 ? headerIndex + 1 : 0;
      const parts = parser(rows.slice(startIndex));
      const bom = extractBOM(parts);
      console.log(`Processed file ${path.basename(filePath)} - Detected BOM Type: ${bomType}, Parts Found: ${parts.length}, Unique Items: ${bom.length}`);      
      if (DEBUG === true) console.table(bom);
      resolve(parts);
    });
  });
}

async function extractFolderBOM(folder) {
  const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith(".pdf"));
  let accumulatedParts = [];
  for (const file of files) {
    const filePath = path.join(folder, file);
    const parts = await extractFileBOM(filePath);
    accumulatedParts.push(...parts);
  }
  return accumulatedParts;
}

/** ---------- CLI Entry Point ---------- **/
async function main() {
  const inputPath = process.argv[2] || "./subset";
  let accumulatedParts = [];

  if (fs.existsSync(inputPath)) {
    const stats = fs.statSync(inputPath);
    if (stats.isFile()) {
      accumulatedParts = await extractFileBOM(inputPath);
    } else if (stats.isDirectory()) {
      accumulatedParts = await extractFolderBOM(inputPath);
    } else {
      console.error("❌ Input path must be a file or folder");
      process.exit(1);
    }
  } else {
    console.error("❌ Input path not found:", inputPath);
    process.exit(1);
  }

  console.log(`\n=== Final Consolidated BOM ===`);
  console.table(extractBOM(accumulatedParts));
}

main().catch(err => console.error(err));

module.exports = { extractFileBOM, extractFolderBOM };
