import React, { useEffect, useMemo, useState } from "react";
import readExcelFile from "read-excel-file/browser";
import {
  DEFAULT_COPAY_DASHBOARD_CONFIG,
  DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
  DEFAULT_MATERNITY_DASHBOARD_CONFIG,
  DEFAULT_ROOM_RENT_DASHBOARD_CONFIG,
  calculateCappedAilmentWorkbook,
  SUM_INSURED_REQUIRED,
  calculateCopayWorkbook,
  calculateMaternityWorkbook,
  calculateRoomRentWorkbook,
  calculateSumInsured,
  mapRowsToObjects,
  normalizeKey,
  parseCSV,
  workbookSheetsToCSV,
} from "./lib";
import {
  BENEFICIARY_FIELD_DEFS,
  BENEFICIARY_FIELD_KEYS,
  CAPPED_AILMENT_FIELD_DEFS,
  CAPPED_AILMENT_FIELD_KEYS,
  CLAIM_FIELD_KEYS,
  COPAY_CLAIM_FIELD_DEFS,
  HEADER_SCAN_LIMIT,
  ICD_FIELD_DEFS,
  ICD_FIELD_KEYS,
  MATERNITY_FIELD_DEFS,
  MATERNITY_FIELD_KEYS,
  ROOM_RENT_FIELD_DEFS,
  ROOM_RENT_FIELD_KEYS,
  SUM_INSURED_FIELD_DEFS,
  buildDefaultMapping,
  findHeaderRow,
  getPreviewRowValidation,
  prepareRowsForFieldMapping,
} from "./headerMappings";
import { DEFAULT_ICD_LOOKUP_ROWS } from "./icdDefaults";

const SUM_INSURED_SAMPLE = `Employee ID,Claim Status,Current Sum Insured,Claimed Amount,Incurred Amount
722489,Settled,500000,771001,465732
729536,Settled,500000,969782,384596
718928,Settled,500000,540240,351334`;

const COPAY_CLAIM_SAMPLE = `Sum Insured,Relationship,Age,Claimed Amount,Incurred Amount,Claim Type,Admission Type,Claim Status,Settlement Status,ICD Code,Procedure Type,Procedure Limit,Grade,Policy Number,Client Name,Risk Start Date,Risk End Date,Employee Code
500000,Mother-in-law,69,38500,38498,Cashless,IPD,Settled,Settled,H25.011,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,707559
500000,Mother-in-law,69,38500,38500,Cashless,IPD,Settled,Settled,H25.012,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,707559
500000,Mother,71,46300,45500,Cashless,IPD,Settled,Settled,H25.012,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,707559
500000,Mother,71,46300,45500,Cashless,IPD,Settled,Settled,H25.011,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,707859
500000,Mother,64,58000,48000,Cashless,IPD,Settled,Settled,H25.011,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,707930
500000,Father,74,35109,35109,Cashless,IPD,Settled,Settled,H25.012,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,708232
500000,Mother,61,40000,40000,Cashless,IPD,Settled,Settled,H25.012,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,708466
500000,Father,73,36500,35000,Cashless,IPD,Settled,Settled,H25.011,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,708518
500000,Father,72,10000,10000,Cashless,IPD,Settled,Settled,H25.011,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,708558
500000,Mother,73,46500,46500,Cashless,IPD,Settled,Settled,H25.012,Cataract,35000,,pol_100020008965/00/00,Finastra Software Solutions,24-Dec-23,23-Dec-24,709473`;

const BENEFICIARY_TYPE_SAMPLE = `Beneficiary Type,Beneficiary Type Group1,Beneficiary Type Group2,Beneficiary Type Group
Self,ESC,Employee,Employee
Employee,ESC,Employee,Employee
Spouse,ESC,Spouse,Spouse
Son,ESC,Child,Child
Daughter,ESC,Child,Child
Father,PARENTS,Parent,Parent
Mother,PARENTS,Parent,Parent
Father-In-Law,PARENTS,Parent,Parent IL
Mother-In-Law,PARENTS,Parent,Parent IL
Mother-in-law,PARENTS,Parent,Parent IL`;

const DEFAULT_ICD_AILMENT_SAMPLE_PREFIXES = new Set([
  "H25",
  "K40",
  "M17",
  "O82",
  "S22",
  "U07",
]);

const ICD_AILMENT_SAMPLE = [
  ["ICD Prefix", "Category", "Ailment"],
  ...DEFAULT_ICD_LOOKUP_ROWS
    .filter((row) => DEFAULT_ICD_AILMENT_SAMPLE_PREFIXES.has(row.icdPrefix))
    .map((row) => [row.icdPrefix, row.category, row.ailment]),
].map((row) => row.map(escapeCSVCell).join(",")).join("\n");

const KNOWN_ICD_AILMENT_GROUPS = new Set(
  DEFAULT_ICD_LOOKUP_ROWS.map((row) => normalizeKey(row.ailment)).filter(Boolean),
);
const BUILT_IN_ICD_MAPPING_COUNT = DEFAULT_ICD_LOOKUP_ROWS.length;

const MATERNITY_CLAIM_SAMPLE = `employee_code,Proc Type,Proc Limit,ARG Claimed Amount,ARG Incurred Amount,ARG Status1,ARG Ailment
EMP001,C-Section,100000,169836,100000,Settled,Maternity
EMP002,Normal,100000,120028,100000,Settled,Maternity
EMP003,Normal,100000,85000,80000,Settled,Maternity
EMP004,C section,100000,169836,100000,Settled,`;

const ROOM_RENT_CLAIM_SAMPLE = `employee_code,Sum Insured,ARG Status1,Room Category,Room Rent Amount,Room Rent Per Day,Room Days
EMP201,500000,Settled,Normal,20000,,
EMP202,500000,Settled,ICU,,15000,2
EMP203,500000,Settled,Normal,,7000,
EMP204,500000,Pending,ICU,18000,,1`;

const CAPPED_AILMENT_CLAIM_SAMPLE = `employee_code,Proc Type,Proc Limit,ARG Claimed Amount,ARG Incurred Amount,ARG Status1,ARG Ailment
EMP401,Cataract,35000,60000,35000,Settled,Eye
EMP401,Cataract,35000,10000,5000,Settled,Eye
EMP402,Hernia,40000,60000,40000,Settled,Hernia
EMP403,TKR THR,150000,260000,160000,Settled,Ortho
EMP404,Psychiatric,0,105000,91000,Settled,Psychological/Psychiatric
EMP405,CAG,50000,90000,50000,Settled,Cardiac`;

const EMPTY_RESULT = { rows: [], summary: [], grandTotal: 0 };

const TAB_OPTIONS = [
  {
    id: "sum-insured",
    label: "Sum Insured Impact",
    description: "Change insurance limits and measure payable impact.",
  },
  {
    id: "copay",
    label: "Co-pay Calculator",
    description: "Replicate the workbook with lookup-based co-pay logic.",
  },
  {
    id: "maternity",
    label: "Maternity",
    description: "Summarize settled maternity claims and apply procedure limits.",
  },
  {
    id: "room-rent",
    label: "Room Rent",
    description: "Estimate room-rent impact from claim room charges and SI-based caps.",
  },
  {
    id: "capped-ailment",
    label: "Capped Ailment",
    description: "Group settled capped ailments and calculate impact by procedure type.",
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "Manage shared lookup tables and mapping overrides.",
  },
];

const DEFAULT_COPAY_DASHBOARD_FORM = {
  ESC: {
    existingLimit: 5,
    proposedLimit: 10,
  },
  Parent: {
    existingLimit: 0,
    proposedLimit: 12,
  },
};

const DEFAULT_MATERNITY_DASHBOARD_FORM = {
  Normal: {
    existingLimit: 100000,
    proposedLimit: 75000,
  },
  "C-section": {
    existingLimit: 100000,
    proposedLimit: 125000,
  },
};

const DEFAULT_ROOM_RENT_DASHBOARD_FORM = {
  Normal: {
    existingLimit: 1,
    proposedLimit: 2,
  },
  ICU: {
    existingLimit: 2,
    proposedLimit: 4,
  },
};

const DEFAULT_CAPPED_AILMENT_DASHBOARD_FORM = Object.fromEntries(
  Object.entries(DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG).map(
    ([type, config]) => [
      type,
      {
        existingLimit: config.existingLimit,
        proposedLimit: config.proposedLimit,
      },
    ],
  ),
);

const CAPPED_AILMENT_TYPES = Object.keys(
  DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
);

function formatNumber(value, locale) {
  return Math.round(Number(value || 0)).toLocaleString(locale, {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value, locale) {
  if (!Number.isFinite(value)) return "-";
  return `${Number(value).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatDecimalPercent(value, locale) {
  if (value === "-" || value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${(Number(value) * 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function parsePercentInput(value, fallback) {
  const normalized = String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized) return fallback;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return fallback;

  return numeric >= 1 ? numeric / 100 : numeric;
}

function parseAmountInput(value, fallback) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return fallback;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function moneyClass(value) {
  if (value < 0) return "negative";
  if (value > 0) return "positive";
  return "";
}

function escapeCSVCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function serializeRows(rows) {
  return rows.map((row) => row.map(escapeCSVCell).join(",")).join("\n");
}

function downloadCSVFile(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCSVCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isXlsxFile(file) {
  return String(file?.name || "").toLowerCase().endsWith(".xlsx");
}

function buildRequiredExample(fieldDefs, sampleRows) {
  const sampleHeaders = sampleRows[0] || [];
  const sampleValues = sampleRows[1] || [];
  const sampleMapping = buildDefaultMapping(sampleHeaders, fieldDefs, {});

  return fieldDefs
    .filter((field) => field.required)
    .map((field) => {
      const header = sampleMapping[field.key] || field.label;
      const headerIndex = sampleHeaders.indexOf(header);

      return {
        key: field.key,
        header,
        value: headerIndex >= 0 ? sampleValues[headerIndex] || "" : "",
      };
    });
}

function getFieldOption(field) {
  return {
    key: field.key,
    label: field.label,
  };
}

function getFieldOrderIndex(fieldDefs, fieldKey) {
  const index = fieldDefs.findIndex((field) => field.key === fieldKey);
  return index === -1 ? fieldDefs.length : index;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function looksLikeNumberText(value) {
  return /^-?[\d,]+(?:\.\d+)?$/.test(String(value ?? "").trim());
}

function isSumInsuredHeaderRow(row) {
  return (
    Array.isArray(row) &&
    row.length >= SUM_INSURED_REQUIRED.length &&
    SUM_INSURED_REQUIRED.every(
      (header, index) => normalizeKey(row[index]) === normalizeKey(header),
    )
  );
}

function isSumInsuredExcelExportRow(row) {
  return (
    Array.isArray(row) &&
    (row.length === 4 || row.length === 5) &&
    String(row[0] ?? "").trim() !== "" &&
    row.slice(1).every(looksLikeNumberText)
  );
}

function normalizeSumInsuredPasteText(text, defaultStatus = "Settled") {
  const normalizedByHeader = normalizeRowsFromDetectedHeaders({
    text,
    fieldDefs: SUM_INSURED_FIELD_DEFS,
    outputColumns: [
      { key: "Employee ID", fallback: "" },
      { key: "Claim Status", fallback: defaultStatus },
      { key: "Current Sum Insured", fallback: "" },
      { key: "Claimed Amount", fallback: "" },
      { key: "Incurred Amount", fallback: "" },
    ],
  });

  if (normalizedByHeader) {
    return normalizedByHeader;
  }

  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return "";

  const normalizedRows = [];
  let hasHeader = false;
  let hasStarted = false;

  lines.forEach((line) => {
    const row = parseCSV(line)[0] || [];
    if (row.length === 0) return;

    if (isSumInsuredHeaderRow(row)) {
      if (!hasHeader) {
        normalizedRows.push([...SUM_INSURED_REQUIRED]);
        hasHeader = true;
      }
      hasStarted = true;
      return;
    }

    if (isSumInsuredExcelExportRow(row)) {
      if (!hasHeader) {
        normalizedRows.push([...SUM_INSURED_REQUIRED]);
        hasHeader = true;
      }

      hasStarted = true;
      normalizedRows.push([row[0], defaultStatus, row[1], row[2], row[3]]);
      return;
    }

    if (hasStarted) {
      normalizedRows.push(row);
    }
  });

  return serializeRows(normalizedRows);
}

function normalizeRowsFromDetectedHeaders({ text, fieldDefs, outputColumns }) {
  const rows = parseCSV(String(text || ""));
  if (rows.length === 0) return "";

  const headerMatch = findHeaderRow(rows, fieldDefs, HEADER_SCAN_LIMIT);
  if (!headerMatch.found) return "";

  const headers = headerMatch.headers || [];
  const mapping = buildDefaultMapping(headers, fieldDefs, {});
  const canBuildRows = outputColumns.every(
    (column) => mapping[column.key] || column.fallback !== undefined,
  );

  if (!canBuildRows) return "";

  const normalizedRows = [
    outputColumns.map((column) => {
      const field = fieldDefs.find((candidate) => candidate.key === column.key);
      return field?.label || column.key;
    }),
  ];
  const sourceRows = rows.slice(headerMatch.headerRowIndex + 1);

  sourceRows.forEach((row) => {
    if (!Array.isArray(row) || row.every((cell) => String(cell ?? "").trim() === "")) {
      return;
    }

    normalizedRows.push(
      outputColumns.map((column) => {
        const sourceHeader = mapping[column.key];
        const sourceIndex = sourceHeader ? headers.indexOf(sourceHeader) : -1;

        if (sourceIndex >= 0) {
          return row[sourceIndex] ?? "";
        }

        return column.fallback ?? "";
      }),
    );
  });

  return serializeRows(normalizedRows);
}

function looksLikeIcdCode(value) {
  return /^[A-Z]\d{2}(?:[A-Z0-9.]*)?$/i.test(String(value ?? "").trim());
}

function repairLooseIcdRow(row) {
  if (!Array.isArray(row) || row.length <= 3 || !looksLikeIcdCode(row[0])) {
    return row;
  }

  const ailmentIndex = row.findIndex(
    (cell, index) =>
      index > 0 && KNOWN_ICD_AILMENT_GROUPS.has(normalizeKey(cell)),
  );

  if (ailmentIndex > 1) {
    return [
      row[0],
      row.slice(1, ailmentIndex).join(", ").trim(),
      row[ailmentIndex],
    ];
  }

  return [
    row[0],
    row.slice(1, -1).join(", ").trim(),
    row[row.length - 1],
  ];
}

function normalizeIcdPasteText(text) {
  const rows = parseCSV(String(text || ""));
  if (rows.length === 0) return "";

  const headerMatch = findHeaderRow(rows, ICD_FIELD_DEFS, HEADER_SCAN_LIMIT);

  if (headerMatch.found) {
    const repairedRows = rows.map((row, index) =>
      index <= headerMatch.headerRowIndex ? row : repairLooseIcdRow(row),
    );

    return (
      normalizeRowsFromDetectedHeaders({
        text: serializeRows(repairedRows),
        fieldDefs: ICD_FIELD_DEFS,
        outputColumns: [
          { key: "icdPrefix", fallback: "" },
          { key: "category", fallback: "" },
          { key: "ailment", fallback: "" },
        ],
      }) || serializeRows(repairedRows)
    );
  }

  const nonEmptyRows = rows.filter(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => String(cell ?? "").trim() !== ""),
  );

  if (nonEmptyRows.length > 0 && nonEmptyRows.every((row) => looksLikeIcdCode(row[0]))) {
    return serializeRows([
      ["ICD Prefix", "Category", "Ailment"],
      ...nonEmptyRows.map((row) => {
        const repairedRow = repairLooseIcdRow(row);
        return [repairedRow[0] ?? "", repairedRow[1] ?? "", repairedRow[2] ?? ""];
      }),
    ]);
  }

  return String(text || "");
}

function normalizeMaternityPasteText(text) {
  return (
    normalizeRowsFromDetectedHeaders({
      text,
      fieldDefs: MATERNITY_FIELD_DEFS,
      outputColumns: [
        { key: "employeeCode", fallback: "" },
        { key: "procedureType", fallback: "" },
        { key: "procedureLimit", fallback: "" },
        { key: "claimedAmount", fallback: "" },
        { key: "incurredAmount", fallback: "" },
        { key: "settlementStatus", fallback: "Settled" },
        { key: "ailment", fallback: "" },
      ],
    }) || String(text || "")
  );
}

function normalizeCappedAilmentPasteText(text) {
  return (
    normalizeRowsFromDetectedHeaders({
      text,
      fieldDefs: CAPPED_AILMENT_FIELD_DEFS,
      outputColumns: [
        { key: "employeeCode", fallback: "" },
        { key: "procedureType", fallback: "" },
        { key: "procedureLimit", fallback: "" },
        { key: "claimedAmount", fallback: "" },
        { key: "incurredAmount", fallback: "" },
        { key: "settlementStatus", fallback: "Settled" },
        { key: "ailment", fallback: "" },
      ],
    }) || String(text || "")
  );
}

function getHeaderInsertIndex(headerRow, targetField, fieldDefs) {
  const targetOrder = getFieldOrderIndex(fieldDefs, targetField.key);

  for (let index = 0; index < headerRow.length; index += 1) {
    const existingHeaderKey = fieldDefs.find((field) =>
      [field.label, field.key, ...(field.aliases || [])].some(
        (candidate) => normalizeKey(candidate) === normalizeKey(headerRow[index]),
      ),
    )?.key;

    const existingOrder = getFieldOrderIndex(fieldDefs, existingHeaderKey);
    if (existingOrder > targetOrder) {
      return index;
    }
  }

  return headerRow.length;
}

function useMappedWorkspace({
  sample,
  fieldDefs,
  normalizeInput = (value) => String(value ?? ""),
  initialText,
}) {
  const normalizedSample = normalizeInput(sample);
  const normalizedInitialText =
    initialText === undefined ? normalizedSample : normalizeInput(initialText);
  const [text, setTextState] = useState(normalizedInitialText);
  const [showPreview, setShowPreview] = useState(false);
  const [mapping, setMapping] = useState({});
  const [importError, setImportError] = useState(null);
  const [singleColText, setSingleColText] = useState("");
  const [singleColTargetKey, setSingleColTargetKey] = useState(fieldDefs[0].key);
  const [singleColStartRow, setSingleColStartRow] = useState(2);
  const sampleRows = useMemo(() => parseCSV(normalizedSample || ""), [normalizedSample]);
  const requiredExample = useMemo(
    () => buildRequiredExample(fieldDefs, sampleRows),
    [fieldDefs, sampleRows],
  );

  function setText(nextText) {
    setImportError(null);
    setTextState(normalizeInput(nextText));
  }

  const rows = useMemo(() => parseCSV(text || ""), [text]);
  const headers = rows[0] || null;
  const previewRows = rows.slice(1);
  const previewRowIssues = useMemo(
    () => getPreviewRowValidation(rows, headers, fieldDefs, mapping),
    [rows, headers, fieldDefs, mapping],
  );

  useEffect(() => {
    if (!headers) {
      setMapping({});
      return;
    }

    setMapping((current) => buildDefaultMapping(headers, fieldDefs, current));
  }, [headers, fieldDefs]);

  const missingRequiredFields = headers
    ? fieldDefs.filter((field) => field.required && !mapping[field.key])
    : [];
  const selectedFields = Object.values(mapping || {}).filter(Boolean);
  const hasDuplicateMapping = new Set(selectedFields).size !== selectedFields.length;

  function rejectImport(preparedImport, nextMissingRequiredFields) {
    setImportError({
      missingRequiredLabels: nextMissingRequiredFields.map((field) => field.label),
      receivedHeaders: (preparedImport.headers || []).filter(
        (header) => String(header || "").trim() !== "",
      ),
      scannedRows: preparedImport.scannedRows || HEADER_SCAN_LIMIT,
      headerRowIndex: preparedImport.headerRowIndex,
      headerFound: preparedImport.found,
    });
  }

  function applyImportedText(nextText) {
    const normalizedText = normalizeInput(nextText);
    const importedRows = parseCSV(normalizedText || "");
    const preparedImport = prepareRowsForFieldMapping(
      importedRows,
      fieldDefs,
      HEADER_SCAN_LIMIT,
    );
    const nextRows = preparedImport.rows;
    const nextMissingRequiredFields = preparedImport.missingRequiredFields;

    if (nextRows.length === 0 || nextMissingRequiredFields.length > 0) {
      rejectImport(preparedImport, nextMissingRequiredFields);
      return false;
    }

    setImportError(null);
    setTextState(serializeRows(nextRows));
    setShowPreview(true);
    return true;
  }

  async function importFile(file) {
    if (!file) return;

    try {
      const nextText = isXlsxFile(file)
        ? workbookSheetsToCSV(await readExcelFile(file))
        : String(await file.text());

      applyImportedText(nextText);
    } catch (error) {
      console.error(error);
      alert("Could not read this file. Upload CSV or Excel (.xlsx).");
    }
  }

  function handleTextPaste(event) {
    const clipboardText = event.clipboardData?.getData("text");
    if (!clipboardText) return;

    event.preventDefault();
    event.currentTarget.value = "";
    applyImportedText(clipboardText);
  }

  function editCell(previewRowIndex, colIndex, value) {
    const allRows = parseCSV(text || "");
    const rowIndex = previewRowIndex + 1;

    if (rowIndex < 1 || rowIndex >= allRows.length) return;

    const nextRows = allRows.map((row) => [...row]);
    while (nextRows[rowIndex].length <= colIndex) {
      nextRows[rowIndex].push("");
    }
    nextRows[rowIndex][colIndex] = value;
    setText(serializeRows(nextRows));
  }

  function deleteRow(previewRowIndex) {
    const allRows = parseCSV(text || "");
    const rowIndex = previewRowIndex + 1;

    if (rowIndex < 1 || rowIndex >= allRows.length) return;

    const nextRows = allRows.filter((_, index) => index !== rowIndex);
    setText(serializeRows(nextRows));
  }

  function clearData() {
    setImportError(null);
    setText("");
    setShowPreview(false);
  }

  function loadSample() {
    setImportError(null);
    setText(sample);
    setShowPreview(true);
  }

  function applySingleColumn() {
    const pastedValues = (singleColText || "")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (pastedValues.length === 0) {
      alert("Paste a column first");
      return;
    }

    const nextRows = parseCSV(text || "").map((row) => [...row]);
    const targetField =
      fieldDefs.find((field) => field.key === singleColTargetKey) || fieldDefs[0];

    if (nextRows.length === 0) {
      nextRows.push([targetField.label]);
    }

    const headerRow = nextRows[0];
    const existingHeaderName = mapping[targetField.key] || targetField.label;
    const normalizedTargets = [
      existingHeaderName,
      targetField.label,
      targetField.key,
      ...(targetField.aliases || []),
    ].map(normalizeKey);

    let colIndex = headerRow.findIndex((header) =>
      normalizedTargets.includes(normalizeKey(header)),
    );

    if (colIndex === -1) {
      colIndex = getHeaderInsertIndex(headerRow, targetField, fieldDefs);
      headerRow.splice(colIndex, 0, targetField.label);

      for (let rowIndex = 1; rowIndex < nextRows.length; rowIndex += 1) {
        nextRows[rowIndex].splice(colIndex, 0, "");
      }
    }

    const startRow = Math.max(2, Number(singleColStartRow) || 2);
    const endRowIndex = startRow - 1 + pastedValues.length - 1;

    for (let rowIndex = 1; rowIndex <= endRowIndex; rowIndex += 1) {
      if (!nextRows[rowIndex]) {
        nextRows[rowIndex] = Array(headerRow.length).fill("");
      }

      while (nextRows[rowIndex].length < headerRow.length) {
        nextRows[rowIndex].push("");
      }
    }

    pastedValues.forEach((value, index) => {
      const rowIndex = startRow - 1 + index;
      nextRows[rowIndex][colIndex] = value;
    });

    setText(serializeRows(nextRows));
    setShowPreview(true);
    setSingleColText("");
  }

  return {
    text,
    setText,
    showPreview,
    setShowPreview,
    mapping,
    setMapping,
    importError,
    singleColText,
    setSingleColText,
    singleColTargetKey,
    setSingleColTargetKey,
    singleColStartRow,
    setSingleColStartRow,
    rows,
    headers,
    previewRows,
    previewRowIssues,
    requiredExample,
    missingRequiredFields,
    hasDuplicateMapping,
    importFile,
    handleTextPaste,
    editCell,
    deleteRow,
    clearData,
    loadSample,
    applySingleColumn,
  };
}

function PageTabs({ activeTab, setActiveTab }) {
  return (
    <div className="tab-list" role="tablist" aria-label="Calculator tabs">
      {TAB_OPTIONS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function getWorkspaceDataRowCount(workspace) {
  return Math.max(0, (workspace?.rows?.length || 0) - 1);
}

function getIcdConfigurationState(workspace) {
  const customRowCount = getWorkspaceDataRowCount(workspace);
  const hasHeaders = Boolean(workspace.headers);
  const hasMappingIssues =
    workspace.missingRequiredFields.length > 0 || workspace.hasDuplicateMapping;

  if (!hasHeaders || customRowCount === 0) {
    return {
      mode: "built-in",
      sourceLabel: "Built-in ICD master only",
      title: "Using built-in ICD master",
      summary:
        "No custom ICD rows are active. Calculators use the built-in ICD master only.",
      detail: `The built-in lookup covers ${formatCount(
        BUILT_IN_ICD_MAPPING_COUNT,
      )} ICD prefixes before any custom overrides are applied.`,
      customRowCount: 0,
    };
  }

  if (hasMappingIssues) {
    return {
      mode: "needs-attention",
      sourceLabel: "Built-in ICD master with inactive custom draft",
      title: "ICD configuration needs attention",
      summary:
        "The current ICD upload is not active yet. Calculators continue using the built-in ICD master only.",
      detail:
        "Fix the missing required mappings or duplicate column selections on the Configuration page to activate the custom ICD rows.",
      customRowCount: 0,
    };
  }

  return {
    mode: "custom",
    sourceLabel: "Built-in ICD master plus Configuration overrides",
    title: "Using Configuration overrides",
    summary: `${formatCount(customRowCount)} custom ICD row${
      customRowCount === 1 ? "" : "s"
    } are active and will override matching built-in rows.`,
    detail:
      "Custom ICD rows from the Configuration page are layered on top of the built-in ICD master for all calculators that use ICD mappings.",
    customRowCount,
  };
}

function getBeneficiaryConfigurationState(workspace) {
  const activeRowCount = getWorkspaceDataRowCount(workspace);
  const hasHeaders = Boolean(workspace.headers);
  const hasMappingIssues =
    workspace.missingRequiredFields.length > 0 || workspace.hasDuplicateMapping;

  if (!hasHeaders || activeRowCount === 0) {
    return {
      mode: "missing",
      sourceLabel: "Configuration beneficiary mapping",
      title: "Beneficiary mapping required",
      summary:
        "No beneficiary mapping is active yet. The co-pay calculator needs this mapping to group relationships correctly.",
      detail:
        "Load a beneficiary mapping file on the Configuration page to enable co-pay calculation.",
      activeRowCount: 0,
    };
  }

  if (hasMappingIssues) {
    return {
      mode: "needs-attention",
      sourceLabel: "Configuration beneficiary mapping",
      title: "Beneficiary mapping needs attention",
      summary:
        "The current beneficiary upload is not active yet. Fix the mapping issues on the Configuration page to use it.",
      detail:
        "Fix the missing required mappings or duplicate column selections on the Configuration page to activate the beneficiary mapping rows.",
      activeRowCount: 0,
    };
  }

  return {
    mode: "ready",
    sourceLabel: "Configuration beneficiary mapping",
    title: "Beneficiary mapping ready",
    summary: `${formatCount(activeRowCount)} beneficiary mapping row${
      activeRowCount === 1 ? "" : "s"
    } are active for co-pay relationship grouping.`,
    detail:
      "The active beneficiary mapping from the Configuration page is used by calculators that rely on relationship grouping.",
    activeRowCount,
  };
}

function BeneficiaryConfigurationStatusCard({
  title = "Beneficiary Mapping Source",
  description,
  status,
  actionLabel,
  onAction,
  compact = false,
}) {
  if (compact) {
    return (
      <section className="card compact-status-card">
        <div className="compact-status-row">
          <div>
            <div className="section-label">{title}</div>
            <p className="muted compact-status-copy">
              {status.mode === "ready"
                ? `${formatCount(status.activeRowCount)} rows active from Configuration.`
                : description || status.summary}
            </p>
          </div>
          {actionLabel && onAction ? (
            <button type="button" className="secondary" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>

        {status.mode !== "ready" ? <div className="notice">{status.detail}</div> : null}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description || status.detail}</p>
        </div>
        {actionLabel && onAction ? (
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      <div className="config-grid">
        <div className="info-card">
          <div className="section-label">Current Source</div>
          <p className="muted">{status.sourceLabel}</p>
        </div>
        <div className="info-card">
          <div className="section-label">Active Mapping Rows</div>
          <p className="muted">{formatCount(status.activeRowCount)}</p>
        </div>
        <div className="info-card">
          <div className="section-label">Used By</div>
          <p className="muted">Co-pay relationship grouping</p>
        </div>
        <div className="info-card">
          <div className="section-label">Effective Behavior</div>
          <p className="muted">{status.summary}</p>
        </div>
      </div>

      {status.mode !== "ready" ? <div className="notice">{status.detail}</div> : null}
    </section>
  );
}

function IcdConfigurationStatusCard({
  title = "ICD Configuration",
  description,
  status,
  actionLabel,
  onAction,
  compact = false,
}) {
  if (compact) {
    return (
      <section className="card compact-status-card">
        <div className="compact-status-row">
          <div>
            <div className="section-label">{title}</div>
            <p className="muted compact-status-copy">
              {status.mode === "custom"
                ? `${formatCount(status.customRowCount)} custom row${
                    status.customRowCount === 1 ? "" : "s"
                  } active from Configuration.`
                : status.mode === "built-in"
                  ? "Using built-in ICD master."
                  : description || status.summary}
            </p>
          </div>
          {actionLabel && onAction ? (
            <button type="button" className="secondary" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>

        {status.mode === "needs-attention" ? <div className="notice">{status.detail}</div> : null}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description || status.detail}</p>
        </div>
        {actionLabel && onAction ? (
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      <div className="config-grid">
        <div className="info-card">
          <div className="section-label">Current Source</div>
          <p className="muted">{status.sourceLabel}</p>
        </div>
        <div className="info-card">
          <div className="section-label">Built-in ICD Prefixes</div>
          <p className="muted">{formatCount(BUILT_IN_ICD_MAPPING_COUNT)}</p>
        </div>
        <div className="info-card">
          <div className="section-label">Active Custom Rows</div>
          <p className="muted">{formatCount(status.customRowCount)}</p>
        </div>
        <div className="info-card">
          <div className="section-label">Effective Behavior</div>
          <p className="muted">{status.summary}</p>
        </div>
      </div>

      {status.mode === "needs-attention" ? <div className="notice">{status.detail}</div> : null}
    </section>
  );
}

function WorkspaceActionsCard({
  extraActions = [],
}) {
  if (extraActions.length === 0) return null;

  return (
    <section className="card">
      <div className="toolbar">
        {extraActions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.secondary ? "secondary" : ""}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function FieldMappingCard({
  title = "Field Mapping",
  description = "Map your uploaded headers to the standard fields.",
  headers,
  mapping,
  fieldDefs,
  onMappingChange,
  showDuplicateNotice,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasHeaders = Boolean(headers);
  const mappedCount = fieldDefs.filter((field) => Boolean(mapping[field.key])).length;
  const missingRequiredCount = headers
    ? fieldDefs.filter((field) => field.required && !mapping[field.key]).length
    : 0;
  const summaryParts = headers
    ? [`${mappedCount} of ${fieldDefs.length} fields mapped`]
    : [];

  if (headers) {
    if (missingRequiredCount > 0) {
      summaryParts.push(`${missingRequiredCount} required still missing`);
    } else {
      summaryParts.push("all required fields ready");
    }

    if (showDuplicateNotice) {
      summaryParts.push("duplicate source columns selected");
    }
  }

  const mappingSummary = headers
    ? `${summaryParts.join(", ")}.`
    : "Paste or upload data to map fields.";

  return (
    <section
      className={`card field-mapping-card ${hasHeaders && !isExpanded ? "is-collapsed" : ""}`.trim()}
    >
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {isExpanded || !hasHeaders ? <p className="muted">{description}</p> : null}
        </div>
        {hasHeaders ? (
          <div className="mapping-actions">
            {isExpanded ? <div className="mapping-summary">{mappingSummary}</div> : null}
            <button
              type="button"
              className="secondary"
              onClick={() => setIsExpanded((value) => !value)}
            >
              {isExpanded ? "Hide Mapping" : "Show Mapping"}
            </button>
          </div>
        ) : null}
      </div>
      {hasHeaders ? (
        isExpanded ? (
          <>
            <div className="mapping-grid">
              {fieldDefs.map((field) => (
                <div key={field.key}>
                  <label>
                    {field.label}
                    <span className={`field-chip ${field.required ? "required" : "optional"}`}>
                      {field.required ? "Required" : "Optional"}
                    </span>
                  </label>
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(event) =>
                      onMappingChange((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">-- select column --</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {showDuplicateNotice ? (
              <div className="notice">
                Each mapped field must use a different source column.
              </div>
            ) : null}
          </>
        ) : null
      ) : (
        <div className="notice">Paste or upload data to map fields.</div>
      )}
    </section>
  );
}

function PreviewTable({ headers, rows, rowIssues, onEditCell, onDeleteRow }) {
  if (!headers) return null;

  return (
    <div className="table-wrap preview-table-wrap top-gap">
      <table>
        <thead>
          <tr>
            <th className="row-index-head">Row</th>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
            <th className="row-action-head">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length + 2}>No data rows to preview.</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => {
              const issues = rowIssues?.[rowIndex] || [];

              return (
                <tr
                  key={`${rowIndex}-${row.join("|")}`}
                  className={issues.length > 0 ? "preview-row-invalid" : ""}
                  title={issues.length > 0 ? issues.join(". ") : undefined}
                >
                  <td className="row-index-cell">{rowIndex + 1}</td>
                  {headers.map((header, colIndex) => (
                    <td key={`${header}-${colIndex}`} className="preview-cell">
                      <input
                        className={`preview-input ${issues.length > 0 ? "is-invalid" : ""}`}
                        value={row[colIndex] || ""}
                        spellCheck={false}
                        onChange={(event) =>
                          onEditCell(rowIndex, colIndex, event.target.value)
                        }
                      />
                    </td>
                  ))}
                  <td className="row-action-cell">
                    <button
                      type="button"
                      className="secondary row-delete-button"
                      onClick={() => onDeleteRow(rowIndex)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function DataEntryCard({
  title,
  description,
  workspace,
  fieldDefs,
  missingLabels,
  accept = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasText = Boolean(workspace.text.trim());
  const dataRowCount = Math.max(0, workspace.rows.length - 1);
  const columnCount = workspace.headers?.length || 0;
  const previewRowCount = workspace.previewRows.length;
  const invalidPreviewRowCount = workspace.previewRowIssues.filter(
    (issues) => issues.length > 0,
  ).length;
  const collapsedSummary = workspace.importError
    ? "Import needs attention."
    : hasText
      ? `${formatCount(dataRowCount)} rows x ${formatCount(columnCount)} columns loaded.`
      : "No data loaded yet.";

  return (
    <section
      className={`card data-entry-card${!isExpanded ? " is-collapsed" : ""}`}
    >
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {isExpanded ? <p className="muted">{description}</p> : null}
        </div>
        <div className="mapping-actions">
          {!isExpanded ? (
            <div className="mapping-summary">{collapsedSummary}</div>
          ) : null}
          <button
            type="button"
            className="secondary"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <>
          <div className="toolbar data-entry-toolbar">
            <input
              className="file-input"
              type="file"
              accept={accept}
              onChange={(event) => {
                workspace.importFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="secondary"
              onClick={workspace.loadSample}
            >
              Load Sample
            </button>
            <button
              type="button"
              className="secondary"
              onClick={workspace.clearData}
            >
              Clear
            </button>
          </div>

          <div className="paste-board">
            <textarea
              className="paste-capture"
              aria-label="Paste data from Excel or CSV"
              onPaste={workspace.handleTextPaste}
              onChange={(event) => {
                event.target.value = "";
              }}
              onInput={(event) => {
                event.currentTarget.value = "";
              }}
              spellCheck={false}
            />
            <div className="section-label">
              {hasText
                ? "Paste again to replace current data"
                : "Paste from Excel or CSV"}
            </div>
            <p className="muted data-text-hint">
              Copy cells in Excel, click here, and press Ctrl+V. Keep the header
              row on the first line.
            </p>
            <div className="paste-steps" aria-label="How to paste from Excel">
              <span className="paste-step">1. Copy cells in Excel</span>
              <span className="paste-step">2. Click inside this area</span>
              <span className="paste-step">3. Press Ctrl+V</span>
            </div>
            {hasText ? (
              <div className="paste-board-meta">
                Current data: {formatCount(dataRowCount)} rows x{" "}
                {formatCount(columnCount)} columns
              </div>
            ) : null}
          </div>

          {workspace.importError ? (
            <div className="notice import-guide">
              <div className="section-label">
                This file format cannot be imported yet
              </div>
              <p>
                The app scans the first {workspace.importError.scannedRows} row
                {workspace.importError.scannedRows === 1 ? "" : "s"} for a usable
                header row. Missing required headers:{" "}
                {workspace.importError.missingRequiredLabels.join(", ")}.
              </p>
              {workspace.importError.headerFound &&
              workspace.importError.receivedHeaders.length > 0 ? (
                <p>
                  Best header row found at row{" "}
                  {workspace.importError.headerRowIndex + 1}. Headers used for
                  mapping: {workspace.importError.receivedHeaders.join(", ")}.
                </p>
              ) : workspace.importError.receivedHeaders.length > 0 ? (
                <p>
                  We could not find a usable header row. First row values seen:{" "}
                  {workspace.importError.receivedHeaders.join(", ")}.
                </p>
              ) : (
                <p>No usable header row was detected in the first scanned rows.</p>
              )}
              <p>Use a file shaped like this example:</p>
              <div className="table-wrap import-guide-table">
                <table>
                  <thead>
                    <tr>
                      {workspace.requiredExample.map((column) => (
                        <th key={column.key}>{column.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {workspace.requiredExample.map((column) => (
                        <td key={column.key}>{column.value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {missingLabels.length > 0 ? (
            <div className="notice">
              Missing required mappings: {missingLabels.join(", ")}
            </div>
          ) : null}

          {hasText ? (
            <div className="preview-panel">
              <div className="preview-head">
                <div>
                  <div className="section-label">Editable table preview</div>
                  <p className="muted">
                    Showing {formatCount(previewRowCount)} data row
                    {previewRowCount === 1 ? "" : "s"} with an 8-row viewport.
                    Scroll for more, edit cells directly, or delete a row.
                  </p>
                  {invalidPreviewRowCount > 0 ? (
                    <p className="preview-warning">
                      {formatCount(invalidPreviewRowCount)} row
                      {invalidPreviewRowCount === 1 ? "" : "s"} need attention.
                      Incomplete or unexpected rows are highlighted in red.
                    </p>
                  ) : null}
                </div>
                {columnCount > 0 ? (
                  <div className="preview-badge">
                    {formatCount(dataRowCount)} rows x {formatCount(columnCount)}{" "}
                    columns
                  </div>
                ) : null}
              </div>
              <PreviewTable
                headers={workspace.headers}
                rows={workspace.previewRows}
                rowIssues={workspace.previewRowIssues}
                onEditCell={workspace.editCell}
                onDeleteRow={workspace.deleteRow}
              />
            </div>
          ) : null}

          <details className="advanced-tools">
            <summary>Advanced: raw text editor</summary>
            <div className="advanced-tools-body stack">
              <p className="muted">
                Use this only if you need to inspect or edit the pasted data as
                raw text.
              </p>
              <textarea
                className="data-textarea raw-editor"
                value={workspace.text}
                onChange={(event) => workspace.setText(event.target.value)}
                rows={8}
                spellCheck={false}
                wrap="off"
                placeholder="Paste Excel rows here"
              />
            </div>
          </details>

          <details className="advanced-tools">
            <summary>Advanced: paste a single column</summary>
            <div className="advanced-tools-body stack">
              <p className="muted">
                Use this only if you need to paste one newline-separated Excel
                column into an existing dataset.
              </p>
              <textarea
                value={workspace.singleColText}
                onChange={(event) => workspace.setSingleColText(event.target.value)}
                rows={5}
                placeholder="Paste a single column here"
              />
              <div className="inline-controls">
                <select
                  value={workspace.singleColTargetKey}
                  onChange={(event) =>
                    workspace.setSingleColTargetKey(event.target.value)
                  }
                  className="grow"
                >
                  {fieldDefs.map((field) => {
                    const option = getFieldOption(field);
                    return (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  min={2}
                  value={workspace.singleColStartRow}
                  onChange={(event) =>
                    workspace.setSingleColStartRow(Number(event.target.value || 2))
                  }
                  className="start-row-input"
                  title="Start at data row (1 = header, 2 = first data row)"
                />
                <button type="button" onClick={workspace.applySingleColumn}>
                  Apply Column Paste
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => workspace.setSingleColText("")}
                >
                  Clear
                </button>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}

function WarningsCard({ warnings }) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Warnings</h2>
          <p className="muted">
            Missing mappings or invalid numeric values do not stop the run. They
            are listed here row by row.
          </p>
        </div>
        <div className="warning-total">{warnings.length} warnings</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="number">Row</th>
              <th>Employee Code</th>
              <th>Field</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {warnings.length === 0 ? (
              <tr>
                <td colSpan={4}>No warnings.</td>
              </tr>
            ) : (
              warnings.map((warning, index) => (
                <tr key={`${warning.rowNumber}-${warning.field}-${index}`}>
                  <td className="number">{warning.rowNumber || "-"}</td>
                  <td>{warning.employeeCode || "-"}</td>
                  <td>{warning.field}</td>
                  <td>{warning.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CopayDashboardConfigCard({
  dashboardForm,
  setDashboardForm,
  numberFormat,
  dashboard,
  actionLabel,
  onAction,
}) {
  function updateLimit(relationshipType, field, value) {
    setDashboardForm((current) => ({
      ...current,
      [relationshipType]: {
        ...current[relationshipType],
        [field]: value,
      },
    }));
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Co-pay Settings</h2>
          <p className="muted">
            Existing and proposed limits are editable here. Row-level
            <code> Copay Existing </code>
            still follows the workbook formula.
          </p>
        </div>
        {onAction ? (
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="config-grid">
        <div className="config-card">
          <h3>ESC</h3>
          <label>Existing Limit %</label>
          <input
            value={dashboardForm.ESC.existingLimit}
            onChange={(event) =>
              updateLimit("ESC", "existingLimit", event.target.value)
            }
            inputMode="decimal"
          />
          <label>Proposed Limit %</label>
          <input
            value={dashboardForm.ESC.proposedLimit}
            onChange={(event) =>
              updateLimit("ESC", "proposedLimit", event.target.value)
            }
            inputMode="decimal"
          />
        </div>
        <div className="config-card">
          <h3>Parent</h3>
          <label>Existing Limit %</label>
          <input
            value={dashboardForm.Parent.existingLimit}
            onChange={(event) =>
              updateLimit("Parent", "existingLimit", event.target.value)
            }
            inputMode="decimal"
          />
          <label>Proposed Limit %</label>
          <input
            value={dashboardForm.Parent.proposedLimit}
            onChange={(event) =>
              updateLimit("Parent", "proposedLimit", event.target.value)
            }
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="table-wrap top-gap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th className="number">Existing Limit</th>
              <th className="number">Proposed Limit Increase %</th>
              <th className="number">Proposed Limit</th>
              <th className="number">Total Impact</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rows.map((row) => (
              <tr key={row.relationshipType}>
                <td>{row.relationshipType}</td>
                <td className="number">
                  {formatDecimalPercent(row.existingLimit, numberFormat)}
                </td>
                <td className="number">
                  {formatDecimalPercent(row.proposedLimitIncrease, numberFormat)}
                </td>
                <td className="number">
                  {formatDecimalPercent(row.proposedLimit, numberFormat)}
                </td>
                <td className={`number ${moneyClass(row.totalImpact)}`}>
                  {formatNumber(row.totalImpact, numberFormat)}
                </td>
              </tr>
            ))}
            <tr>
              <td>Total</td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className={`number ${moneyClass(dashboard.grandTotalImpact)}`}>
                {formatNumber(dashboard.grandTotalImpact, numberFormat)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MaternityDashboardConfigCard({
  dashboardForm,
  setDashboardForm,
  numberFormat,
  dashboard,
  actionLabel,
  onAction,
}) {
  function updateLimit(procedureType, field, value) {
    setDashboardForm((current) => ({
      ...current,
      [procedureType]: {
        ...current[procedureType],
        [field]: value,
      },
    }));
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Maternity Settings</h2>
          <p className="muted">
            Existing and proposed limits are editable here. Row-level
            <code> Difference </code>
            still uses the grouped procedure limit from uploaded data.
          </p>
        </div>
        {onAction ? (
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="config-grid">
        <div className="config-card">
          <h3>Normal</h3>
          <label>Existing Limit</label>
          <input
            value={dashboardForm.Normal.existingLimit}
            onChange={(event) =>
              updateLimit("Normal", "existingLimit", event.target.value)
            }
            inputMode="decimal"
          />
          <label>Proposed Limit</label>
          <input
            value={dashboardForm.Normal.proposedLimit}
            onChange={(event) =>
              updateLimit("Normal", "proposedLimit", event.target.value)
            }
            inputMode="decimal"
          />
        </div>
        <div className="config-card">
          <h3>C-section</h3>
          <label>Existing Limit</label>
          <input
            value={dashboardForm["C-section"].existingLimit}
            onChange={(event) =>
              updateLimit("C-section", "existingLimit", event.target.value)
            }
            inputMode="decimal"
          />
          <label>Proposed Limit</label>
          <input
            value={dashboardForm["C-section"].proposedLimit}
            onChange={(event) =>
              updateLimit("C-section", "proposedLimit", event.target.value)
            }
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="table-wrap top-gap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th className="number">Existing Limit</th>
              <th className="number">Proposed Limit Increase %</th>
              <th className="number">Proposed Limit</th>
              <th className="number">Total Impact</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rows.map((row) => (
              <tr key={row.procedureType}>
                <td>{row.procedureType}</td>
                <td className="number">
                  {formatNumber(row.existingLimit, numberFormat)}
                </td>
                <td className="number">
                  {formatDecimalPercent(row.proposedLimitIncrease, numberFormat)}
                </td>
                <td className="number">
                  {formatNumber(row.proposedLimit, numberFormat)}
                </td>
                <td className={`number ${moneyClass(row.totalImpact)}`}>
                  {formatNumber(row.totalImpact, numberFormat)}
                </td>
              </tr>
            ))}
            <tr>
              <td>Total</td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className={`number ${moneyClass(dashboard.grandTotalImpact)}`}>
                {formatNumber(dashboard.grandTotalImpact, numberFormat)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RoomRentDashboardConfigCard({
  dashboardForm,
  setDashboardForm,
  numberFormat,
  dashboard,
  actionLabel,
  onAction,
}) {
  function updateLimit(roomCategory, field, value) {
    setDashboardForm((current) => ({
      ...current,
      [roomCategory]: {
        ...current[roomCategory],
        [field]: value,
      },
    }));
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Room Rent Settings</h2>
          <p className="muted">
            Existing and proposed caps are stored as percentages of sum insured
            and applied separately to Normal and ICU rows.
          </p>
        </div>
        {onAction ? (
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="config-grid">
        <div className="config-card">
          <h3>Normal</h3>
          <label>Existing Limit % of SI</label>
          <input
            value={dashboardForm.Normal.existingLimit}
            onChange={(event) =>
              updateLimit("Normal", "existingLimit", event.target.value)
            }
            inputMode="decimal"
          />
          <label>Proposed Limit % of SI</label>
          <input
            value={dashboardForm.Normal.proposedLimit}
            onChange={(event) =>
              updateLimit("Normal", "proposedLimit", event.target.value)
            }
            inputMode="decimal"
          />
        </div>
        <div className="config-card">
          <h3>ICU</h3>
          <label>Existing Limit % of SI</label>
          <input
            value={dashboardForm.ICU.existingLimit}
            onChange={(event) =>
              updateLimit("ICU", "existingLimit", event.target.value)
            }
            inputMode="decimal"
          />
          <label>Proposed Limit % of SI</label>
          <input
            value={dashboardForm.ICU.proposedLimit}
            onChange={(event) =>
              updateLimit("ICU", "proposedLimit", event.target.value)
            }
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="table-wrap top-gap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th className="number">Existing Limit</th>
              <th className="number">Proposed Limit Increase %</th>
              <th className="number">Proposed Limit</th>
              <th className="number">Total Impact</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rows.map((row) => (
              <tr key={row.roomCategory}>
                <td>{row.roomCategory}</td>
                <td className="number">
                  {formatDecimalPercent(row.existingLimit, numberFormat)}
                </td>
                <td className="number">
                  {formatDecimalPercent(row.proposedLimitIncrease, numberFormat)}
                </td>
                <td className="number">
                  {formatDecimalPercent(row.proposedLimit, numberFormat)}
                </td>
                <td className={`number ${moneyClass(row.totalImpact)}`}>
                  {formatNumber(row.totalImpact, numberFormat)}
                </td>
              </tr>
            ))}
            <tr>
              <td>Total</td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className={`number ${moneyClass(dashboard.grandTotalImpact)}`}>
                {formatNumber(dashboard.grandTotalImpact, numberFormat)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CappedAilmentDashboardConfigCard({
  dashboardForm,
  setDashboardForm,
  numberFormat,
  dashboard,
  actionLabel,
  onAction,
}) {
  function updateLimit(procedureType, field, value) {
    setDashboardForm((current) => ({
      ...current,
      [procedureType]: {
        ...current[procedureType],
        [field]: value,
      },
    }));
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Capped Ailment Settings</h2>
          <p className="muted">
            Configure existing and proposed limits by procedure type. Psychiatric
            still follows the separate incurred-amount rule.
          </p>
        </div>
        {onAction ? (
          <button type="button" className="secondary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th className="number">Existing Limit</th>
              <th className="number">Proposed Limit Increase %</th>
              <th className="number">Proposed Limit</th>
              <th className="number">Total Impact</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rows.map((row) => (
              <tr key={row.procedureType}>
                <td>{row.procedureType}</td>
                <td className="number">
                  <input
                    value={dashboardForm[row.procedureType].existingLimit}
                    onChange={(event) =>
                      updateLimit(
                        row.procedureType,
                        "existingLimit",
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                  />
                </td>
                <td className="number">
                  {formatDecimalPercent(row.proposedLimitIncrease, numberFormat)}
                </td>
                <td className="number">
                  <input
                    value={dashboardForm[row.procedureType].proposedLimit}
                    onChange={(event) =>
                      updateLimit(
                        row.procedureType,
                        "proposedLimit",
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                  />
                </td>
                <td className={`number ${moneyClass(row.totalImpact)}`}>
                  {formatNumber(row.totalImpact, numberFormat)}
                </td>
              </tr>
            ))}
            <tr>
              <td>Total</td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className="number"> </td>
              <td className={`number ${moneyClass(dashboard.grandTotalImpact)}`}>
                {formatNumber(dashboard.grandTotalImpact, numberFormat)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SumInsuredCalculator() {
  const [statusFilter, setStatusFilter] = useState("Settled");
  const [proposedLimit, setProposedLimit] = useState(300000);
  const [numberFormat, setNumberFormat] = useState("en-IN");
  const workspace = useMappedWorkspace({
    sample: SUM_INSURED_SAMPLE,
    fieldDefs: SUM_INSURED_FIELD_DEFS,
    normalizeInput: (text) => normalizeSumInsuredPasteText(text, statusFilter),
  });

  const canCalculate =
    workspace.headers &&
    workspace.missingRequiredFields.length === 0 &&
    !workspace.hasDuplicateMapping;

  const { rows, summary, grandTotal } = useMemo(() => {
    if (!canCalculate) return EMPTY_RESULT;
    return calculateSumInsured(
      workspace.rows,
      workspace.headers,
      workspace.mapping,
      statusFilter,
      Number(proposedLimit),
    );
  }, [
    canCalculate,
    proposedLimit,
    statusFilter,
    workspace.headers,
    workspace.mapping,
    workspace.rows,
  ]);

  function downloadResults() {
    downloadCSVFile(
      "sum-insured-impact-results.csv",
      [
        "Employee ID",
        "Claim Status",
        "Current Sum Insured",
        "Claimed Amount",
        "Incurred Amount",
        "New Proposed Sum Insured",
        "Current Payable Amount",
        "New Payable Amount",
        "Impact Amount",
        "Included In Total",
      ],
      rows.map((row) => [
        row.employeeId,
        row.claimStatus,
        row.currentSumInsured,
        row.claimedAmount,
        row.incurredAmount,
        row.newProposedSumInsured,
        row.currentPayable,
        row.newPayable,
        row.impact,
        row.included ? "Yes" : "No",
      ]),
    );
  }

  return (
    <div className="panel">
      <section className="hero hero-compact">
        <div className="hero-card hero-card-compact">
          <h2>Sum Insured Impact</h2>
          <p>Paste claim data to compare current and proposed payable amounts.</p>
        </div>
        <div className="metric metric-compact">
          <div>
            <div className="metric-label">Grand Total Impact</div>
            <div className={`metric-value ${moneyClass(grandTotal)}`}>
              {formatNumber(grandTotal, numberFormat)}
            </div>
          </div>
          <p className="metric-copy">Negative means payable reduces.</p>
        </div>
      </section>

      <FieldMappingCard
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={SUM_INSURED_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      <WorkspaceActionsCard workspace={workspace} />

      <DataEntryCard
        title="Paste / Upload Data"
        description="Upload a claim file or paste the raw table directly."
        workspace={workspace}
        fieldDefs={SUM_INSURED_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="field-grid">
          <div>
            <label>Claim Status to Calculate</label>
            <input
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            />
          </div>
          <div>
            <label>New Proposed Sum Insured</label>
            <input
              value={proposedLimit}
              onChange={(event) => setProposedLimit(event.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label>Number Format</label>
            <select
              value={numberFormat}
              onChange={(event) => setNumberFormat(event.target.value)}
            >
              <option value="en-IN">Indian</option>
              <option value="en-US">International</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Summary by current sum insured</h2>
            <p className="muted">
              Groups included claims by the existing insurance limit.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Current Sum Insured</th>
                <th>New Proposed Sum Insured</th>
                <th>Limit Change %</th>
                <th className="number">Included Claims</th>
                <th className="number">Total Impact</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={5}>No included rows found.</td>
                </tr>
              ) : (
                summary.map((item) => {
                  const limitChangePercent = item.currentSumInsured
                    ? (item.newProposedSumInsured / item.currentSumInsured - 1) * 100
                    : Number.NaN;

                  return (
                    <tr key={item.currentSumInsured}>
                      <td>{formatNumber(item.currentSumInsured, numberFormat)}</td>
                      <td>{formatNumber(item.newProposedSumInsured, numberFormat)}</td>
                      <td>{formatPercent(limitChangePercent, numberFormat)}</td>
                      <td className="number">
                        {formatNumber(item.includedClaims, numberFormat)}
                      </td>
                      <td className={`number ${moneyClass(item.totalImpact)}`}>
                        {formatNumber(item.totalImpact, numberFormat)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Employee-level results</h2>
            <p className="muted">
              Rows outside the selected claim status remain visible but do not
              affect totals.
            </p>
          </div>
          <button type="button" className="secondary" onClick={downloadResults}>
            Download Results CSV
          </button>
        </div>
        <div className="table-wrap tall-table">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Claim Status</th>
                <th className="number">Current Sum Insured</th>
                <th className="number">Claimed Amount</th>
                <th className="number">Incurred Amount</th>
                <th className="number">New Proposed Sum Insured</th>
                <th className="number">Current Payable Amount</th>
                <th className="number">New Payable Amount</th>
                <th className="number">Impact Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.employeeId}-${index}`}
                  className={row.included ? "" : "excluded"}
                >
                  <td>{row.employeeId}</td>
                  <td>{row.claimStatus}</td>
                  <td className="number">
                    {formatNumber(row.currentSumInsured, numberFormat)}
                  </td>
                  <td className="number">
                    {formatNumber(row.claimedAmount, numberFormat)}
                  </td>
                  <td className="number">
                    {formatNumber(row.incurredAmount, numberFormat)}
                  </td>
                  <td className="number">
                    {formatNumber(row.newProposedSumInsured, numberFormat)}
                  </td>
                  <td className="number">
                    {formatNumber(row.currentPayable, numberFormat)}
                  </td>
                  <td className="number">
                    {formatNumber(row.newPayable, numberFormat)}
                  </td>
                  <td className={`number ${moneyClass(row.impact)}`}>
                    {formatNumber(row.impact, numberFormat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer-total">
        Grand Total Impact: {formatNumber(grandTotal, numberFormat)}
      </footer>
    </div>
  );
}

function ConfigurationPage({
  beneficiaryWorkspace,
  beneficiaryConfigurationState,
  icdWorkspace,
  icdConfigurationState,
}) {
  return (
    <div className="panel">
      <section className="hero hero-compact">
        <div className="hero-card hero-card-compact">
          <h2>Configuration</h2>
          <p>
            Manage shared mapping tables here. Calculators automatically pick up the
            active configuration from this page.
          </p>
        </div>
        <div className="metric metric-compact">
          <div>
            <div className="metric-label">Active ICD Override Rows</div>
            <div className="metric-value">
              {formatCount(icdConfigurationState.customRowCount)}
            </div>
          </div>
          <p className="metric-copy">
            {icdConfigurationState.mode === "custom"
              ? "Custom ICD rows are active for downstream calculators."
              : "Built-in ICD defaults stay active until custom rows are valid."}
          </p>
        </div>
      </section>

      <IcdConfigurationStatusCard
        status={icdConfigurationState}
        description="This is the shared ICD source for calculators that rely on ICD-to-ailment mappings."
      />

      <BeneficiaryConfigurationStatusCard
        title="Beneficiary Mapping"
        status={beneficiaryConfigurationState}
        description="This is the shared beneficiary source for calculators that rely on relationship grouping."
      />

      <FieldMappingCard
        title="Beneficiary Mapping"
        description="Map beneficiary relationships to the shared dimension fields used for relationship grouping."
        headers={beneficiaryWorkspace.headers}
        mapping={beneficiaryWorkspace.mapping}
        fieldDefs={BENEFICIARY_FIELD_DEFS}
        onMappingChange={beneficiaryWorkspace.setMapping}
        showDuplicateNotice={beneficiaryWorkspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Paste / Upload Beneficiary Mapping"
        description="Upload the beneficiary lookup table or paste it directly from Excel. Calculators will read the active mapping from this page."
        workspace={beneficiaryWorkspace}
        fieldDefs={BENEFICIARY_FIELD_DEFS}
        missingLabels={beneficiaryWorkspace.missingRequiredFields.map((field) => field.label)}
      />

      <FieldMappingCard
        title="ICD / Ailment Mapping"
        description="Map ICD prefixes or full ICD codes to the ailment lookup used by the calculators. The built-in ICD master always remains available."
        headers={icdWorkspace.headers}
        mapping={icdWorkspace.mapping}
        fieldDefs={ICD_FIELD_DEFS}
        onMappingChange={icdWorkspace.setMapping}
        showDuplicateNotice={icdWorkspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Paste / Upload ICD Mapping"
        description="Upload the ICD lookup table or paste it directly from Excel to override or extend the built-in master ICD list. Sheets with ICD Prefix or ICD Start Code plus Group Diagnosis1 are supported."
        workspace={icdWorkspace}
        fieldDefs={ICD_FIELD_DEFS}
        missingLabels={icdWorkspace.missingRequiredFields.map((field) => field.label)}
      />
    </div>
  );
}

function CopayCalculator({
  beneficiaryConfigurationState,
  sharedBeneficiaryConfigurationRows,
  icdConfigurationState,
  sharedIcdConfigurationRows,
  onOpenConfiguration,
}) {
  const claimsWorkspace = useMappedWorkspace({
    sample: COPAY_CLAIM_SAMPLE,
    fieldDefs: COPAY_CLAIM_FIELD_DEFS,
  });
  const [numberFormat, setNumberFormat] = useState("en-IN");
  const [dashboardForm, setDashboardForm] = useState(
    DEFAULT_COPAY_DASHBOARD_FORM,
  );

  const dashboardConfig = useMemo(() => {
    return {
      ESC: {
        existingLimit: parsePercentInput(
          dashboardForm.ESC.existingLimit,
          DEFAULT_COPAY_DASHBOARD_CONFIG.ESC.existingLimit,
        ),
        proposedLimit: parsePercentInput(
          dashboardForm.ESC.proposedLimit,
          DEFAULT_COPAY_DASHBOARD_CONFIG.ESC.proposedLimit,
        ),
      },
      Parent: {
        existingLimit: parsePercentInput(
          dashboardForm.Parent.existingLimit,
          DEFAULT_COPAY_DASHBOARD_CONFIG.Parent.existingLimit,
        ),
        proposedLimit: parsePercentInput(
          dashboardForm.Parent.proposedLimit,
          DEFAULT_COPAY_DASHBOARD_CONFIG.Parent.proposedLimit,
        ),
      },
    };
  }, [dashboardForm]);

  const canCalculate =
    claimsWorkspace.headers &&
    beneficiaryConfigurationState.mode === "ready" &&
    claimsWorkspace.missingRequiredFields.length === 0 &&
    !claimsWorkspace.hasDuplicateMapping;

  const copayResult = useMemo(() => {
    if (!canCalculate) {
      return {
        rows: [],
        warnings: [],
        dashboard: {
          rows: [
            {
              relationshipType: "ESC",
              existingLimit: dashboardConfig.ESC.existingLimit,
              proposedLimitIncrease:
                dashboardConfig.ESC.existingLimit === 0
                  ? "-"
                  : dashboardConfig.ESC.proposedLimit / dashboardConfig.ESC.existingLimit - 1,
              proposedLimit: dashboardConfig.ESC.proposedLimit,
              totalImpact: 0,
            },
            {
              relationshipType: "Parent",
              existingLimit: dashboardConfig.Parent.existingLimit,
              proposedLimitIncrease:
                dashboardConfig.Parent.existingLimit === 0
                  ? "-"
                  : dashboardConfig.Parent.proposedLimit /
                    dashboardConfig.Parent.existingLimit -
                    1,
              proposedLimit: dashboardConfig.Parent.proposedLimit,
              totalImpact: 0,
            },
          ],
          grandTotalImpact: 0,
        },
      };
    }

    return calculateCopayWorkbook({
      claimRows: mapRowsToObjects(
        claimsWorkspace.rows,
        claimsWorkspace.headers,
        claimsWorkspace.mapping,
        CLAIM_FIELD_KEYS,
      ),
      beneficiaryTypeRows: sharedBeneficiaryConfigurationRows,
      icdRows: sharedIcdConfigurationRows,
      dashboardConfig,
    });
  }, [
    beneficiaryConfigurationState.mode,
    canCalculate,
    claimsWorkspace.headers,
    claimsWorkspace.mapping,
    claimsWorkspace.rows,
    claimsWorkspace.hasDuplicateMapping,
    claimsWorkspace.missingRequiredFields.length,
    dashboardConfig,
    sharedBeneficiaryConfigurationRows,
    sharedIcdConfigurationRows,
  ]);

  function downloadDataResults() {
    downloadCSVFile(
      "copay-calculated-data.csv",
      [
        "Sum Insured",
        "Relationship",
        "Relationship Group",
        "Age",
        "Claimed Amount",
        "Incurred Amount",
        "Claim Type",
        "Admission Type",
        "Claim Status",
        "Settlement Status",
        "ICD Code",
        "Ailment",
        "Procedure Type",
        "Procedure Limit",
        "Grade",
        "Policy Number",
        "Client Name",
        "Risk Start Date",
        "Risk End Date",
        "Employee Code",
        "Copay Existing",
        "Copay New Suggested",
        "Relationship Type",
      ],
      copayResult.rows.map((row) => [
        row.sumInsured,
        row.relationship,
        row.relationshipGroup,
        row.age,
        row.claimedAmount,
        row.incurredAmount,
        row.claimType,
        row.admissionType,
        row.claimStatus,
        row.settlementStatus,
        row.icdCode,
        row.ailment,
        row.procedureType,
        row.procedureLimit,
        row.grade,
        row.policyNumber,
        row.clientName,
        row.riskStartDate,
        row.riskEndDate,
        row.employeeCode,
        row.copayExisting,
        row.copayNewSuggested,
        row.relationshipType,
      ]),
    );
  }

  function downloadDashboardResults() {
    downloadCSVFile(
      "copay-dashboard-summary.csv",
      [
        "Type",
        "Existing Limit",
        "Proposed Limit Increase %",
        "Proposed Limit",
        "Total Impact",
      ],
      [
        ...copayResult.dashboard.rows.map((row) => [
          row.relationshipType,
          formatDecimalPercent(row.existingLimit, numberFormat),
          formatDecimalPercent(row.proposedLimitIncrease, numberFormat),
          formatDecimalPercent(row.proposedLimit, numberFormat),
          row.totalImpact,
        ]),
        [
          "Total",
          "",
          "",
          "",
          copayResult.dashboard.grandTotalImpact,
        ],
      ],
    );
  }

  return (
    <div className="panel">
      <section className="hero hero-compact">
        <div className="hero-card hero-card-compact">
          <h2>Co-pay Calculator</h2>
          <p>
            Load claim data to rebuild co-pay impact. Beneficiary mapping and ICD
            mapping overrides are managed from the shared Configuration page.
          </p>
        </div>
        <div className="metric metric-compact">
          <div>
            <div className="metric-label">Grand Total Impact</div>
            <div
              className={`metric-value ${moneyClass(
                copayResult.dashboard.grandTotalImpact,
              )}`}
            >
              {formatNumber(copayResult.dashboard.grandTotalImpact, numberFormat)}
            </div>
          </div>
          <p className="metric-copy">Grand total sums `Copay New Suggested` by relationship type.</p>
        </div>
      </section>

      <FieldMappingCard
        title="Claim Data Mapping"
        description="Map the uploaded claim columns to the standard fields."
        headers={claimsWorkspace.headers}
        mapping={claimsWorkspace.mapping}
        fieldDefs={COPAY_CLAIM_FIELD_DEFS}
        onMappingChange={claimsWorkspace.setMapping}
        showDuplicateNotice={claimsWorkspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Paste / Upload Claim Data"
        description="Upload a claim file or paste the raw claim table directly."
        workspace={claimsWorkspace}
        fieldDefs={COPAY_CLAIM_FIELD_DEFS}
        missingLabels={claimsWorkspace.missingRequiredFields.map((field) => field.label)}
      />

      <BeneficiaryConfigurationStatusCard
        status={beneficiaryConfigurationState}
        description="The co-pay run uses the beneficiary mapping loaded on the Configuration page."
        actionLabel="Open Configuration"
        onAction={onOpenConfiguration}
        compact
      />

      <IcdConfigurationStatusCard
        title="ICD Mapping Source"
        description="The co-pay run always uses the built-in ICD master and, when valid, any custom overrides loaded on the Configuration page."
        status={icdConfigurationState}
        actionLabel="Open Configuration"
        onAction={onOpenConfiguration}
        compact
      />

      <section className="card">
        <div className="field-grid">
          <div>
            <label>Number Format</label>
            <select
              value={numberFormat}
              onChange={(event) => setNumberFormat(event.target.value)}
            >
              <option value="en-IN">Indian</option>
              <option value="en-US">International</option>
            </select>
          </div>
          <div className="info-card">
            <div className="section-label">Existing Co-pay Formula</div>
            <div className="muted">ESC = Incurred Amount x 10 / 90</div>
            <div className="muted">Parent = Incurred Amount x 20 / 80</div>
          </div>
          <div className="info-card">
            <div className="section-label">Validation Behavior</div>
            <div className="muted">
              Missing ICD mappings stay in the run and appear in warnings. Beneficiary
              mapping must be configured on the Configuration page before co-pay
              calculation can run.
            </div>
          </div>
        </div>
      </section>

      <CopayDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={copayResult.dashboard}
        actionLabel="Download Summary CSV"
        onAction={downloadDashboardResults}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Calculated Results</h2>
            <p className="muted">
              Output follows the workbook order with relationship group, ailment,
              co-pay amounts, and final relationship type.
            </p>
          </div>
          <button type="button" className="secondary" onClick={downloadDataResults}>
            Download Results CSV
          </button>
        </div>
        <div className="table-wrap tall-table">
          <table>
            <thead>
              <tr>
                <th className="number">Sum Insured</th>
                <th>Relationship</th>
                <th>Relationship Group</th>
                <th className="number">Age</th>
                <th className="number">Claimed Amount</th>
                <th className="number">Incurred Amount</th>
                <th>Claim Type</th>
                <th>Admission Type</th>
                <th>Claim Status</th>
                <th>Settlement Status</th>
                <th>ICD Code</th>
                <th>Ailment</th>
                <th>Procedure Type</th>
                <th className="number">Procedure Limit</th>
                <th>Grade</th>
                <th>Policy Number</th>
                <th>Client Name</th>
                <th>Risk Start Date</th>
                <th>Risk End Date</th>
                <th>Employee Code</th>
                <th className="number">Copay Existing</th>
                <th className="number">Copay New Suggested</th>
                <th>Relationship Type</th>
              </tr>
            </thead>
            <tbody>
              {copayResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={23}>Load and map the three datasets to calculate results.</td>
                </tr>
              ) : (
                copayResult.rows.map((row, index) => (
                  <tr key={`${row.employeeCode}-${row.rowNumber}-${index}`}>
                    <td className="number">{formatNumber(row.sumInsured, numberFormat)}</td>
                    <td>{row.relationship}</td>
                    <td>{row.relationshipGroup}</td>
                    <td className="number">{formatNumber(row.age, numberFormat)}</td>
                    <td className="number">{formatNumber(row.claimedAmount, numberFormat)}</td>
                    <td className="number">{formatNumber(row.incurredAmount, numberFormat)}</td>
                    <td>{row.claimType}</td>
                    <td>{row.admissionType}</td>
                    <td>{row.claimStatus}</td>
                    <td>{row.settlementStatus}</td>
                    <td>{row.icdCode}</td>
                    <td>{row.ailment}</td>
                    <td>{row.procedureType}</td>
                    <td className="number">
                      {formatNumber(row.procedureLimit, numberFormat)}
                    </td>
                    <td>{row.grade}</td>
                    <td>{row.policyNumber}</td>
                    <td>{row.clientName}</td>
                    <td>{row.riskStartDate}</td>
                    <td>{row.riskEndDate}</td>
                    <td>{row.employeeCode}</td>
                    <td className="number">
                      {formatNumber(row.copayExisting, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.copayNewSuggested, numberFormat)}
                    </td>
                    <td>{row.relationshipType}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <WarningsCard warnings={copayResult.warnings} />
    </div>
  );
}

function MaternityCalculator() {
  const workspace = useMappedWorkspace({
    sample: MATERNITY_CLAIM_SAMPLE,
    fieldDefs: MATERNITY_FIELD_DEFS,
    normalizeInput: normalizeMaternityPasteText,
  });
  const [numberFormat, setNumberFormat] = useState("en-IN");
  const [dashboardForm, setDashboardForm] = useState(
    DEFAULT_MATERNITY_DASHBOARD_FORM,
  );

  const dashboardConfig = useMemo(
    () => ({
      Normal: {
        existingLimit: parseAmountInput(
          dashboardForm.Normal.existingLimit,
          DEFAULT_MATERNITY_DASHBOARD_CONFIG.Normal.existingLimit,
        ),
        proposedLimit: parseAmountInput(
          dashboardForm.Normal.proposedLimit,
          DEFAULT_MATERNITY_DASHBOARD_CONFIG.Normal.proposedLimit,
        ),
      },
      "C-section": {
        existingLimit: parseAmountInput(
          dashboardForm["C-section"].existingLimit,
          DEFAULT_MATERNITY_DASHBOARD_CONFIG["C-section"].existingLimit,
        ),
        proposedLimit: parseAmountInput(
          dashboardForm["C-section"].proposedLimit,
          DEFAULT_MATERNITY_DASHBOARD_CONFIG["C-section"].proposedLimit,
        ),
      },
    }),
    [dashboardForm],
  );

  const canCalculate =
    workspace.headers &&
    workspace.missingRequiredFields.length === 0 &&
    !workspace.hasDuplicateMapping;

  const maternityResult = useMemo(() => {
    if (!canCalculate) {
      return {
        rows: [],
        warnings: [],
        dashboard: {
          rows: [
            {
              procedureType: "Normal",
              existingLimit: dashboardConfig.Normal.existingLimit,
              proposedLimitIncrease:
                dashboardConfig.Normal.existingLimit === 0
                  ? "-"
                  : dashboardConfig.Normal.proposedLimit /
                    dashboardConfig.Normal.existingLimit -
                    1,
              proposedLimit: dashboardConfig.Normal.proposedLimit,
              totalImpact: 0,
            },
            {
              procedureType: "C-section",
              existingLimit: dashboardConfig["C-section"].existingLimit,
              proposedLimitIncrease:
                dashboardConfig["C-section"].existingLimit === 0
                  ? "-"
                  : dashboardConfig["C-section"].proposedLimit /
                    dashboardConfig["C-section"].existingLimit -
                    1,
              proposedLimit: dashboardConfig["C-section"].proposedLimit,
              totalImpact: 0,
            },
          ],
          grandTotalImpact: 0,
        },
      };
    }

    return calculateMaternityWorkbook({
      claimRows: mapRowsToObjects(
        workspace.rows,
        workspace.headers,
        workspace.mapping,
        MATERNITY_FIELD_KEYS,
      ),
      dashboardConfig,
    });
  }, [
    canCalculate,
    dashboardConfig,
    workspace.headers,
    workspace.mapping,
    workspace.rows,
    workspace.hasDuplicateMapping,
    workspace.missingRequiredFields.length,
  ]);

  function downloadDataResults() {
    downloadCSVFile(
      "maternity-calculated-data.csv",
      [
        "employee_code",
        "Proc Type",
        "Proc Limit",
        "Sum of ARG Claimed Amount",
        "Sum of ARG Incurred Amount",
        "Proposed",
        "Difference",
      ],
      maternityResult.rows.map((row) => [
        row.employeeCode,
        row.procedureType,
        row.procedureLimit,
        row.claimedAmount,
        row.incurredAmount,
        row.proposedLimit,
        row.difference,
      ]),
    );
  }

  function downloadDashboardResults() {
    downloadCSVFile(
      "maternity-dashboard-summary.csv",
      [
        "Type",
        "Existing Limit",
        "Proposed Limit Increase %",
        "Proposed Limit",
        "Total Impact",
      ],
      [
        ...maternityResult.dashboard.rows.map((row) => [
          row.procedureType,
          row.existingLimit,
          formatDecimalPercent(row.proposedLimitIncrease, numberFormat),
          row.proposedLimit,
          row.totalImpact,
        ]),
        ["Total", "", "", "", maternityResult.dashboard.grandTotalImpact],
      ],
    );
  }

  return (
    <div className="panel">
      <section className="hero hero-compact">
        <div className="hero-card hero-card-compact">
          <h2>Maternity</h2>
          <p>Load claim data to rebuild the grouped maternity impact sheet.</p>
        </div>
        <div className="metric metric-compact">
          <div>
            <div className="metric-label">Grand Total Impact</div>
            <div
              className={`metric-value ${moneyClass(
                maternityResult.dashboard.grandTotalImpact,
              )}`}
            >
              {formatNumber(
                maternityResult.dashboard.grandTotalImpact,
                numberFormat,
              )}
            </div>
          </div>
          <p className="metric-copy">Grand total is the sum of grouped `Difference` values.</p>
        </div>
      </section>

      <FieldMappingCard
        title="Field Mapping"
        description="Map the uploaded claim columns used to build the maternity summary."
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={MATERNITY_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Paste / Upload Data"
        description="Upload claim data or paste the raw table directly."
        workspace={workspace}
        fieldDefs={MATERNITY_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="field-grid">
          <div>
            <label>Number Format</label>
            <select
              value={numberFormat}
              onChange={(event) => setNumberFormat(event.target.value)}
            >
              <option value="en-IN">Indian</option>
              <option value="en-US">International</option>
            </select>
          </div>
          <div className="info-card">
            <div className="section-label">Claim Filter</div>
            <div className="muted">Settlement Status should be `Settled`.</div>
            <div className="muted">Ailment should be `Maternity` when available.</div>
          </div>
          <div className="info-card">
            <div className="section-label">Procedure Mapping</div>
            <div className="muted">Normal maps to the Normal summary row.</div>
            <div className="muted">C-section, C-Section, and C section map together.</div>
          </div>
        </div>
      </section>

      <MaternityDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={maternityResult.dashboard}
        actionLabel="Download Summary CSV"
        onAction={downloadDashboardResults}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Grouped Results</h2>
            <p className="muted">
              Output follows the workbook layout with grouped rows, proposed limit,
              and calculated difference.
            </p>
          </div>
          <button type="button" className="secondary" onClick={downloadDataResults}>
            Download Results CSV
          </button>
        </div>
        <div className="table-wrap tall-table">
          <table>
            <thead>
              <tr>
                <th>employee_code</th>
                <th>Proc Type</th>
                <th className="number">Proc Limit</th>
                <th className="number">Sum of ARG Claimed Amount</th>
                <th className="number">Sum of ARG Incurred Amount</th>
                <th className="number">Proposed</th>
                <th className="number">Difference</th>
              </tr>
            </thead>
            <tbody>
              {maternityResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    Load and map claim data to calculate the maternity sheet.
                  </td>
                </tr>
              ) : (
                maternityResult.rows.map((row, index) => (
                  <tr
                    key={`${row.employeeCode}-${row.procedureType}-${row.procedureLimit}-${index}`}
                  >
                    <td>{row.employeeCode}</td>
                    <td>{row.procedureType}</td>
                    <td className="number">
                      {formatNumber(row.procedureLimit, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.claimedAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.incurredAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.proposedLimit, numberFormat)}
                    </td>
                    <td className={`number ${moneyClass(row.difference)}`}>
                      {formatNumber(row.difference, numberFormat)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <WarningsCard warnings={maternityResult.warnings} />
    </div>
  );
}

function RoomRentCalculator() {
  const workspace = useMappedWorkspace({
    sample: ROOM_RENT_CLAIM_SAMPLE,
    fieldDefs: ROOM_RENT_FIELD_DEFS,
  });
  const [numberFormat, setNumberFormat] = useState("en-IN");
  const [dashboardForm, setDashboardForm] = useState(
    DEFAULT_ROOM_RENT_DASHBOARD_FORM,
  );

  const dashboardConfig = useMemo(
    () => ({
      Normal: {
        existingLimit: parsePercentInput(
          dashboardForm.Normal.existingLimit,
          DEFAULT_ROOM_RENT_DASHBOARD_CONFIG.Normal.existingLimit,
        ),
        proposedLimit: parsePercentInput(
          dashboardForm.Normal.proposedLimit,
          DEFAULT_ROOM_RENT_DASHBOARD_CONFIG.Normal.proposedLimit,
        ),
      },
      ICU: {
        existingLimit: parsePercentInput(
          dashboardForm.ICU.existingLimit,
          DEFAULT_ROOM_RENT_DASHBOARD_CONFIG.ICU.existingLimit,
        ),
        proposedLimit: parsePercentInput(
          dashboardForm.ICU.proposedLimit,
          DEFAULT_ROOM_RENT_DASHBOARD_CONFIG.ICU.proposedLimit,
        ),
      },
    }),
    [dashboardForm],
  );

  const hasRoomTypeMapping = Boolean(
    workspace.mapping.roomCategory || workspace.mapping.icuFlag,
  );
  const hasRoomValueMapping = Boolean(
    workspace.mapping.roomRentAmount || workspace.mapping.roomRentPerDay,
  );
  const roomRentMappingNotices = [];

  if (!hasRoomTypeMapping) {
    roomRentMappingNotices.push("Map Room Category or ICU Flag.");
  }

  if (!hasRoomValueMapping) {
    roomRentMappingNotices.push(
      "Map Room Rent Amount or Room Rent Per Day.",
    );
  }

  const canCalculate =
    workspace.headers &&
    workspace.missingRequiredFields.length === 0 &&
    !workspace.hasDuplicateMapping &&
    hasRoomTypeMapping &&
    hasRoomValueMapping;

  const roomRentResult = useMemo(() => {
    if (!canCalculate) {
      return {
        rows: [],
        warnings: [],
        dashboard: {
          rows: [
            {
              roomCategory: "Normal",
              existingLimit: dashboardConfig.Normal.existingLimit,
              proposedLimitIncrease:
                dashboardConfig.Normal.existingLimit === 0
                  ? "-"
                  : dashboardConfig.Normal.proposedLimit /
                    dashboardConfig.Normal.existingLimit -
                    1,
              proposedLimit: dashboardConfig.Normal.proposedLimit,
              totalImpact: 0,
            },
            {
              roomCategory: "ICU",
              existingLimit: dashboardConfig.ICU.existingLimit,
              proposedLimitIncrease:
                dashboardConfig.ICU.existingLimit === 0
                  ? "-"
                  : dashboardConfig.ICU.proposedLimit /
                    dashboardConfig.ICU.existingLimit -
                    1,
              proposedLimit: dashboardConfig.ICU.proposedLimit,
              totalImpact: 0,
            },
          ],
          grandTotalImpact: 0,
        },
      };
    }

    return calculateRoomRentWorkbook({
      claimRows: mapRowsToObjects(
        workspace.rows,
        workspace.headers,
        workspace.mapping,
        ROOM_RENT_FIELD_KEYS,
      ),
      dashboardConfig,
    });
  }, [
    canCalculate,
    dashboardConfig,
    workspace.headers,
    workspace.mapping,
    workspace.rows,
    workspace.hasDuplicateMapping,
    workspace.missingRequiredFields.length,
  ]);

  function downloadDataResults() {
    downloadCSVFile(
      "room-rent-calculated-data.csv",
      [
        "Employee Code",
        "Settlement Status",
        "Room Category",
        "Sum Insured",
        "Room Days",
        "Room Rent Per Day",
        "Room Rent Amount",
        "Actual Room Rent",
        "Existing Limit %",
        "Existing Limit Amount",
        "Existing Payable",
        "Proposed Limit %",
        "Proposed Limit Amount",
        "Proposed Payable",
        "Impact",
      ],
      roomRentResult.rows.map((row) => [
        row.employeeCode,
        row.settlementStatus,
        row.roomCategory,
        row.sumInsured,
        row.roomDays,
        row.roomRentPerDay,
        row.roomRentAmount,
        row.actualRoomRent,
        row.existingLimit,
        row.existingLimitAmount,
        row.existingPayable,
        row.proposedLimit,
        row.proposedLimitAmount,
        row.proposedPayable,
        row.impact,
      ]),
    );
  }

  function downloadDashboardResults() {
    downloadCSVFile(
      "room-rent-dashboard-summary.csv",
      [
        "Type",
        "Existing Limit",
        "Proposed Limit Increase %",
        "Proposed Limit",
        "Total Impact",
      ],
      [
        ...roomRentResult.dashboard.rows.map((row) => [
          row.roomCategory,
          formatDecimalPercent(row.existingLimit, numberFormat),
          formatDecimalPercent(row.proposedLimitIncrease, numberFormat),
          formatDecimalPercent(row.proposedLimit, numberFormat),
          row.totalImpact,
        ]),
        ["Total", "", "", "", roomRentResult.dashboard.grandTotalImpact],
      ],
    );
  }

  return (
    <div className="panel">
      <section className="hero hero-compact">
        <div className="hero-card hero-card-compact">
          <h2>Room Rent</h2>
          <p>Load settled claim data to estimate room-rent impact from SI-based caps.</p>
        </div>
        <div className="metric metric-compact">
          <div>
            <div className="metric-label">Grand Total Impact</div>
            <div
              className={`metric-value ${moneyClass(
                roomRentResult.dashboard.grandTotalImpact,
              )}`}
            >
              {formatNumber(
                roomRentResult.dashboard.grandTotalImpact,
                numberFormat,
              )}
            </div>
          </div>
          <p className="metric-copy">Impact = proposed room-rent payable minus existing payable.</p>
        </div>
      </section>

      <FieldMappingCard
        title="Field Mapping"
        description="Map the uploaded claim columns to room category and room-rent charge fields."
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={ROOM_RENT_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      {roomRentMappingNotices.length > 0 ? (
        <section className="card">
          <div className="notice">{roomRentMappingNotices.join(" ")}</div>
        </section>
      ) : null}

      <DataEntryCard
        title="Paste / Upload Data"
        description="Upload claim data or paste the raw table directly."
        workspace={workspace}
        fieldDefs={ROOM_RENT_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="field-grid">
          <div>
            <label>Number Format</label>
            <select
              value={numberFormat}
              onChange={(event) => setNumberFormat(event.target.value)}
            >
              <option value="en-IN">Indian</option>
              <option value="en-US">International</option>
            </select>
          </div>
          <div className="info-card">
            <div className="section-label">Default Caps</div>
            <div className="muted">Normal: 1% to 2% of Sum Insured</div>
            <div className="muted">ICU: 2% to 4% of Sum Insured</div>
          </div>
          <div className="info-card">
            <div className="section-label">Amount Logic</div>
            <div className="muted">Uses total room-rent amount when present.</div>
            <div className="muted">Otherwise uses per-day rent multiplied by room days.</div>
          </div>
        </div>
      </section>

      <RoomRentDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={roomRentResult.dashboard}
        actionLabel="Download Summary CSV"
        onAction={downloadDashboardResults}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Claim-level Results</h2>
            <p className="muted">
              Each settled row shows actual room rent, existing and proposed
              cap amounts, payable amounts, and impact.
            </p>
          </div>
          <button type="button" className="secondary" onClick={downloadDataResults}>
            Download Results CSV
          </button>
        </div>
        <div className="table-wrap tall-table">
          <table>
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Settlement Status</th>
                <th>Room Category</th>
                <th className="number">Sum Insured</th>
                <th className="number">Room Days</th>
                <th className="number">Room Rent Per Day</th>
                <th className="number">Room Rent Amount</th>
                <th className="number">Actual Room Rent</th>
                <th className="number">Existing Limit</th>
                <th className="number">Existing Limit Amount</th>
                <th className="number">Existing Payable</th>
                <th className="number">Proposed Limit</th>
                <th className="number">Proposed Limit Amount</th>
                <th className="number">Proposed Payable</th>
                <th className="number">Impact</th>
              </tr>
            </thead>
            <tbody>
              {roomRentResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={15}>
                    Load and map room-rent source data to calculate results.
                  </td>
                </tr>
              ) : (
                roomRentResult.rows.map((row, index) => (
                  <tr
                    key={`${row.employeeCode}-${row.rowNumber}-${row.roomCategory}-${index}`}
                  >
                    <td>{row.employeeCode}</td>
                    <td>{row.settlementStatus}</td>
                    <td>{row.roomCategory}</td>
                    <td className="number">
                      {formatNumber(row.sumInsured, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.roomDays, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.roomRentPerDay, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.roomRentAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.actualRoomRent, numberFormat)}
                    </td>
                    <td className="number">
                      {formatDecimalPercent(row.existingLimit, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.existingLimitAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.existingPayable, numberFormat)}
                    </td>
                    <td className="number">
                      {formatDecimalPercent(row.proposedLimit, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.proposedLimitAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.proposedPayable, numberFormat)}
                    </td>
                    <td className={`number ${moneyClass(row.impact)}`}>
                      {formatNumber(row.impact, numberFormat)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <WarningsCard warnings={roomRentResult.warnings} />
    </div>
  );
}

function CappedAilmentCalculator() {
  const workspace = useMappedWorkspace({
    sample: CAPPED_AILMENT_CLAIM_SAMPLE,
    fieldDefs: CAPPED_AILMENT_FIELD_DEFS,
    normalizeInput: normalizeCappedAilmentPasteText,
  });
  const [numberFormat, setNumberFormat] = useState("en-IN");
  const [dashboardForm, setDashboardForm] = useState(
    DEFAULT_CAPPED_AILMENT_DASHBOARD_FORM,
  );

  const dashboardConfig = useMemo(
    () =>
      Object.fromEntries(
        CAPPED_AILMENT_TYPES.map((type) => [
          type,
          {
            existingLimit: parseAmountInput(
              dashboardForm[type].existingLimit,
              DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG[type].existingLimit,
            ),
            proposedLimit: parseAmountInput(
              dashboardForm[type].proposedLimit,
              DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG[type].proposedLimit,
            ),
          },
        ]),
      ),
    [dashboardForm],
  );

  const canCalculate =
    workspace.headers &&
    workspace.missingRequiredFields.length === 0 &&
    !workspace.hasDuplicateMapping;

  const cappedAilmentResult = useMemo(() => {
    if (!canCalculate) {
      return {
        rows: [],
        warnings: [],
        dashboard: {
          rows: CAPPED_AILMENT_TYPES.map((procedureType) => ({
            procedureType,
            existingLimit: dashboardConfig[procedureType].existingLimit,
            proposedLimitIncrease:
              dashboardConfig[procedureType].existingLimit === 0
                ? "-"
                : dashboardConfig[procedureType].proposedLimit /
                  dashboardConfig[procedureType].existingLimit -
                  1,
            proposedLimit: dashboardConfig[procedureType].proposedLimit,
            totalImpact: 0,
          })),
          grandTotalImpact: 0,
        },
      };
    }

    return calculateCappedAilmentWorkbook({
      claimRows: mapRowsToObjects(
        workspace.rows,
        workspace.headers,
        workspace.mapping,
        CAPPED_AILMENT_FIELD_KEYS,
      ),
      dashboardConfig,
    });
  }, [
    canCalculate,
    dashboardConfig,
    workspace.headers,
    workspace.mapping,
    workspace.rows,
    workspace.hasDuplicateMapping,
    workspace.missingRequiredFields.length,
  ]);

  function downloadDataResults() {
    downloadCSVFile(
      "capped-ailment-calculated-data.csv",
      [
        "employeeCode",
        "procedureType",
        "existingLimit",
        "sumClaimedAmount",
        "sumIncurredAmount",
        "proposedLimit",
        "difference",
      ],
      cappedAilmentResult.rows.map((row) => [
        row.employeeCode,
        row.procedureType,
        row.existingLimit,
        row.sumClaimedAmount,
        row.sumIncurredAmount,
        row.proposedLimit,
        row.difference,
      ]),
    );
  }

  function downloadDashboardResults() {
    downloadCSVFile(
      "capped-ailment-dashboard-summary.csv",
      [
        "Type",
        "Existing Limit",
        "Proposed Limit Increase %",
        "Proposed Limit",
        "Total Impact",
      ],
      [
        ...cappedAilmentResult.dashboard.rows.map((row) => [
          row.procedureType,
          row.existingLimit,
          formatDecimalPercent(row.proposedLimitIncrease, numberFormat),
          row.proposedLimit,
          row.totalImpact,
        ]),
        ["Total", "", "", "", cappedAilmentResult.dashboard.grandTotalImpact],
      ],
    );
  }

  return (
    <div className="panel">
      <section className="hero hero-compact">
        <div className="hero-card hero-card-compact">
          <h2>Capped Ailment</h2>
          <p>Load settled claim data to rebuild the grouped capped-ailment impact sheet.</p>
        </div>
        <div className="metric metric-compact">
          <div>
            <div className="metric-label">Grand Total Impact</div>
            <div
              className={`metric-value ${moneyClass(
                cappedAilmentResult.dashboard.grandTotalImpact,
              )}`}
            >
              {formatNumber(
                cappedAilmentResult.dashboard.grandTotalImpact,
                numberFormat,
              )}
            </div>
          </div>
          <p className="metric-copy">Grand total is the sum of grouped `Difference` values.</p>
        </div>
      </section>

      <FieldMappingCard
        title="Field Mapping"
        description="Map the uploaded claim columns needed to build the capped ailment summary."
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={CAPPED_AILMENT_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Paste / Upload Data"
        description="Upload claim data or paste the raw table directly."
        workspace={workspace}
        fieldDefs={CAPPED_AILMENT_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="field-grid">
          <div>
            <label>Number Format</label>
            <select
              value={numberFormat}
              onChange={(event) => setNumberFormat(event.target.value)}
            >
              <option value="en-IN">Indian</option>
              <option value="en-US">International</option>
            </select>
          </div>
          <div className="info-card">
            <div className="section-label">Source Filter</div>
            <div className="muted">Only rows with `Settlement Status = Settled` are included.</div>
            <div className="muted">Grouping key: Employee Code + Procedure Type + Procedure Limit.</div>
          </div>
          <div className="info-card">
            <div className="section-label">Procedure Matching</div>
            <div className="muted">Uses normalized procedure types like TKR THR to TKR/THR.</div>
            <div className="muted">Psychiatric can also fall back from ailment text.</div>
          </div>
        </div>
      </section>

      <CappedAilmentDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={cappedAilmentResult.dashboard}
        actionLabel="Download Summary CSV"
        onAction={downloadDashboardResults}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Grouped Results</h2>
            <p className="muted">
              Output follows the grouped workbook structure with proposed limit
              and calculated difference.
            </p>
          </div>
          <button type="button" className="secondary" onClick={downloadDataResults}>
            Download Results CSV
          </button>
        </div>
        <div className="table-wrap tall-table">
          <table>
            <thead>
              <tr>
                <th>employeeCode</th>
                <th>procedureType</th>
                <th className="number">existingLimit</th>
                <th className="number">sumClaimedAmount</th>
                <th className="number">sumIncurredAmount</th>
                <th className="number">proposedLimit</th>
                <th className="number">difference</th>
              </tr>
            </thead>
            <tbody>
              {cappedAilmentResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    Load and map claim data to calculate capped ailment results.
                  </td>
                </tr>
              ) : (
                cappedAilmentResult.rows.map((row, index) => (
                  <tr
                    key={`${row.employeeCode}-${row.procedureType}-${row.existingLimit}-${index}`}
                  >
                    <td>{row.employeeCode}</td>
                    <td>{row.procedureType}</td>
                    <td className="number">
                      {formatNumber(row.existingLimit, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.sumClaimedAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.sumIncurredAmount, numberFormat)}
                    </td>
                    <td className="number">
                      {formatNumber(row.proposedLimit, numberFormat)}
                    </td>
                    <td className={`number ${moneyClass(row.difference)}`}>
                      {formatNumber(row.difference, numberFormat)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <WarningsCard warnings={cappedAilmentResult.warnings} />
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("sum-insured");
  const beneficiaryConfigurationWorkspace = useMappedWorkspace({
    sample: BENEFICIARY_TYPE_SAMPLE,
    fieldDefs: BENEFICIARY_FIELD_DEFS,
  });
  const beneficiaryConfigurationState = useMemo(
    () => getBeneficiaryConfigurationState(beneficiaryConfigurationWorkspace),
    [
      beneficiaryConfigurationWorkspace.headers,
      beneficiaryConfigurationWorkspace.hasDuplicateMapping,
      beneficiaryConfigurationWorkspace.missingRequiredFields,
      beneficiaryConfigurationWorkspace.rows,
    ],
  );
  const sharedBeneficiaryConfigurationRows = useMemo(() => {
    if (beneficiaryConfigurationState.mode !== "ready") return [];

    return mapRowsToObjects(
      beneficiaryConfigurationWorkspace.rows,
      beneficiaryConfigurationWorkspace.headers,
      beneficiaryConfigurationWorkspace.mapping,
      BENEFICIARY_FIELD_KEYS,
    );
  }, [
    beneficiaryConfigurationState.mode,
    beneficiaryConfigurationWorkspace.headers,
    beneficiaryConfigurationWorkspace.mapping,
    beneficiaryConfigurationWorkspace.rows,
  ]);
  const icdConfigurationWorkspace = useMappedWorkspace({
    sample: ICD_AILMENT_SAMPLE,
    fieldDefs: ICD_FIELD_DEFS,
    normalizeInput: normalizeIcdPasteText,
  });
  const icdConfigurationState = useMemo(
    () => getIcdConfigurationState(icdConfigurationWorkspace),
    [
      icdConfigurationWorkspace.headers,
      icdConfigurationWorkspace.hasDuplicateMapping,
      icdConfigurationWorkspace.missingRequiredFields,
      icdConfigurationWorkspace.rows,
    ],
  );
  const sharedIcdConfigurationRows = useMemo(() => {
    if (icdConfigurationState.mode !== "custom") return [];

    return mapRowsToObjects(
      icdConfigurationWorkspace.rows,
      icdConfigurationWorkspace.headers,
      icdConfigurationWorkspace.mapping,
      ICD_FIELD_KEYS,
    );
  }, [
    icdConfigurationState.mode,
    icdConfigurationWorkspace.headers,
    icdConfigurationWorkspace.mapping,
    icdConfigurationWorkspace.rows,
  ]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Claims Scenario Workbench</h1>
      </header>

      <PageTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <section
        hidden={activeTab !== "sum-insured"}
        aria-hidden={activeTab !== "sum-insured"}
      >
        <SumInsuredCalculator />
      </section>

      <section hidden={activeTab !== "copay"} aria-hidden={activeTab !== "copay"}>
        <CopayCalculator
          beneficiaryConfigurationState={beneficiaryConfigurationState}
          sharedBeneficiaryConfigurationRows={sharedBeneficiaryConfigurationRows}
          icdConfigurationState={icdConfigurationState}
          sharedIcdConfigurationRows={sharedIcdConfigurationRows}
          onOpenConfiguration={() => setActiveTab("configuration")}
        />
      </section>

      <section
        hidden={activeTab !== "configuration"}
        aria-hidden={activeTab !== "configuration"}
      >
        <ConfigurationPage
          beneficiaryWorkspace={beneficiaryConfigurationWorkspace}
          beneficiaryConfigurationState={beneficiaryConfigurationState}
          icdWorkspace={icdConfigurationWorkspace}
          icdConfigurationState={icdConfigurationState}
        />
      </section>

      <section
        hidden={activeTab !== "maternity"}
        aria-hidden={activeTab !== "maternity"}
      >
        <MaternityCalculator />
      </section>

      <section
        hidden={activeTab !== "room-rent"}
        aria-hidden={activeTab !== "room-rent"}
      >
        <RoomRentCalculator />
      </section>

      <section
        hidden={activeTab !== "capped-ailment"}
        aria-hidden={activeTab !== "capped-ailment"}
      >
        <CappedAilmentCalculator />
      </section>
    </div>
  );
}
