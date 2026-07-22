import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workbookPath = path.resolve(
  projectRoot,
  "..",
  "client-resources",
  "report-templates",
  "Grandessa_Report_Card_Template.xlsx"
);
const outputPath = path.resolve(projectRoot, "src", "data", "reportTemplates.json");

function cleanCellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("").trim();
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }

    if ("result" in value && value.result !== undefined) {
      return String(value.result).trim();
    }

    if ("formula" in value && value.formula !== undefined) {
      return String(value.formula).trim();
    }

    return String(value).trim();
  }

  return String(value).trim();
}

function getUsedRangeFromCells(cells) {
  let maxRow = 0;
  let maxCol = 0;

  cells.forEach((cellAddress) => {
    const decoded = XLSX.utils.decode_cell(cellAddress);
    maxRow = Math.max(maxRow, decoded.r + 1);
    maxCol = Math.max(maxCol, decoded.c + 1);
  });

  return { maxRow, maxCol };
}

function detectTemplateLevel(sheetName) {
  const normalized = sheetName.toLowerCase();

  if (normalized.includes("nursery")) return "Nursery";
  if (normalized.includes("primary")) return "Primary";
  if (normalized.includes("junior") || normalized.includes("jss")) return "Junior Secondary";
  if (normalized.includes("senior") || normalized.includes("sss")) return "Senior Secondary";

  return "General";
}

function buildTemplateDescriptor(sheetName, sheet) {
  const cells = Object.keys(sheet).filter((key) => !key.startsWith("!"));
  const { maxRow, maxCol } = getUsedRangeFromCells(cells);
  const labels = [];

  cells.forEach((cellAddress) => {
    const cell = sheet[cellAddress];
    const text = cleanCellValue(cell.v ?? cell.w);

    if (!text) {
      return;
    }

    const decoded = XLSX.utils.decode_cell(cellAddress);
    const style = {
      bold: Boolean(cell.s?.font?.bold),
      italic: Boolean(cell.s?.font?.italic),
      align: cell.s?.alignment?.horizontal ?? null,
    };

    labels.push({
      row: decoded.r + 1,
      col: decoded.c + 1,
      text,
      style,
    });
  });

  const mergedRanges = (sheet["!merges"] ?? []).map((merge) => XLSX.utils.encode_range(merge));

  return {
    id: sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name: sheetName,
    level: detectTemplateLevel(sheetName),
    usedRange: {
      rows: maxRow,
      cols: maxCol,
    },
    mergedRanges,
    labels,
  };
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, {
    cellStyles: true,
    cellNF: false,
    cellHTML: false,
    dense: false,
  });

  const templates = workbook.SheetNames
    .filter((sheetName) => sheetName && !sheetName.toLowerCase().includes("legend"))
    .map((sheetName) => buildTemplateDescriptor(sheetName, workbook.Sheets[sheetName]));

  const payload = {
    source: {
      workbook: "client-resources/report-templates/Grandessa_Report_Card_Template.xlsx",
      generatedAt: new Date().toISOString(),
      notes: "Layout metadata extracted from official workbook. No student/business data stored here.",
    },
    templates,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Extracted ${templates.length} report template(s) to ${outputPath}`);
}

main().catch((error) => {
  console.error("Failed to extract report templates:", error);
  process.exitCode = 1;
});
