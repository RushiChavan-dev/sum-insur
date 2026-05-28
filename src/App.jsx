import React, { useEffect, useMemo, useState } from "react";
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
} from "./lib";

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

const ICD_AILMENT_SAMPLE = `ICD Prefix,Category,Ailment
H25,Ophthalmology,Eye
J11,Respiratory,Flu
M54,Orthopedic,Back Pain`;

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
];

const SUM_INSURED_FIELD_DEFS = SUM_INSURED_REQUIRED.map((label) => ({
  key: label,
  label,
  required: true,
  aliases: [label],
}));

const COPAY_CLAIM_FIELD_DEFS = [
  {
    key: "sumInsured",
    label: "Sum Insured",
    required: true,
    aliases: ["Sum Insured", "Insured Amount", "SumInsured"],
  },
  {
    key: "relationship",
    label: "Relationship",
    required: true,
    aliases: ["ARG Relation", "Relationship", "Beneficiary Type"],
  },
  {
    key: "age",
    label: "Age",
    required: true,
    aliases: ["ARG Age", "Age"],
  },
  {
    key: "claimedAmount",
    label: "Claimed Amount",
    required: true,
    aliases: ["ARG Claimed Amount", "Claimed Amount"],
  },
  {
    key: "incurredAmount",
    label: "Incurred Amount",
    required: true,
    aliases: ["ARG Incurred Amount", "Incurred Amount", "IncurredAmount"],
  },
  {
    key: "claimType",
    label: "Claim Type",
    required: true,
    aliases: ["ARG Claim Type", "Claim Type"],
  },
  {
    key: "admissionType",
    label: "Admission Type",
    required: true,
    aliases: ["IPD/OPD", "Admission Type"],
  },
  {
    key: "claimStatus",
    label: "Claim Status",
    required: true,
    aliases: ["ARG Status", "Claim Status"],
  },
  {
    key: "settlementStatus",
    label: "Settlement Status",
    required: true,
    aliases: ["ARG Status1", "Settlement Status"],
  },
  {
    key: "icdCode",
    label: "ICD Code",
    required: true,
    aliases: ["ARG ICD", "ICD Code", "ICD"],
  },
  {
    key: "procedureType",
    label: "Procedure Type",
    required: true,
    aliases: ["Proc Type", "Procedure Type"],
  },
  {
    key: "procedureLimit",
    label: "Procedure Limit",
    required: true,
    aliases: ["Proc Limit", "Procedure Limit"],
  },
  {
    key: "grade",
    label: "Grade",
    required: false,
    aliases: ["Grade"],
  },
  {
    key: "policyNumber",
    label: "Policy Number",
    required: true,
    aliases: ["policy_no", "Policy Number"],
  },
  {
    key: "clientName",
    label: "Client Name",
    required: true,
    aliases: ["mph_name", "Client Name", "MPH Name"],
  },
  {
    key: "riskStartDate",
    label: "Risk Start Date",
    required: true,
    aliases: ["risk_inc_date", "Risk Start Date"],
  },
  {
    key: "riskEndDate",
    label: "Risk End Date",
    required: true,
    aliases: ["risk_exp_date", "Risk End Date"],
  },
  {
    key: "employeeCode",
    label: "Employee Code",
    required: true,
    aliases: ["employee_code", "Employee Code"],
  },
];

const BENEFICIARY_FIELD_DEFS = [
  {
    key: "beneficiaryType",
    label: "Beneficiary Type",
    required: true,
    aliases: ["Beneficiary Type", "beneficiaryType"],
  },
  {
    key: "beneficiaryTypeGroup1",
    label: "Beneficiary Type Group1",
    required: false,
    aliases: ["Beneficiary Type Group1", "beneficiaryTypeGroup1"],
  },
  {
    key: "beneficiaryTypeGroup2",
    label: "Beneficiary Type Group2",
    required: true,
    aliases: ["Beneficiary Type Group2", "beneficiaryTypeGroup2"],
  },
  {
    key: "beneficiaryTypeGroup",
    label: "Beneficiary Type Group",
    required: false,
    aliases: ["Beneficiary Type Group", "beneficiaryTypeGroup"],
  },
];

const ICD_FIELD_DEFS = [
  {
    key: "icdPrefix",
    label: "ICD Prefix",
    required: true,
    aliases: ["ICD Prefix", "icdPrefix"],
  },
  {
    key: "ailment",
    label: "Ailment",
    required: true,
    aliases: ["Ailment", "ailment"],
  },
];

const MATERNITY_FIELD_DEFS = [
  {
    key: "employeeCode",
    label: "Employee Code",
    required: true,
    aliases: ["employee_code", "Employee Code", "employeeCode"],
  },
  {
    key: "procedureType",
    label: "Procedure Type",
    required: true,
    aliases: ["Proc Type", "Procedure Type", "procType"],
  },
  {
    key: "procedureLimit",
    label: "Procedure Limit",
    required: true,
    aliases: ["Proc Limit", "Procedure Limit", "procLimit"],
  },
  {
    key: "claimedAmount",
    label: "Claimed Amount",
    required: true,
    aliases: [
      "ARG Claimed Amount",
      "Claimed Amount",
      "Sum of ARG Claimed Amount",
    ],
  },
  {
    key: "incurredAmount",
    label: "Incurred Amount",
    required: true,
    aliases: [
      "ARG Incurred Amount",
      "Incurred Amount",
      "Sum of ARG Incurred Amount",
    ],
  },
  {
    key: "settlementStatus",
    label: "Settlement Status",
    required: true,
    aliases: ["ARG Status1", "Settlement Status", "Status1"],
  },
  {
    key: "ailment",
    label: "Ailment",
    required: false,
    aliases: ["ARG Ailment", "Ailment", "ailment"],
  },
];

const ROOM_RENT_FIELD_DEFS = [
  {
    key: "employeeCode",
    label: "Employee Code",
    required: true,
    aliases: ["employee_code", "Employee Code", "employeeCode"],
  },
  {
    key: "sumInsured",
    label: "Sum Insured",
    required: true,
    aliases: ["Sum Insured", "Insured Amount", "sumInsured"],
  },
  {
    key: "settlementStatus",
    label: "Settlement Status",
    required: true,
    aliases: ["ARG Status1", "Settlement Status", "Status1"],
  },
  {
    key: "roomCategory",
    label: "Room Category",
    required: false,
    aliases: [
      "Room Category",
      "Room Type",
      "ICU / Normal",
      "roomCategory",
    ],
  },
  {
    key: "icuFlag",
    label: "ICU Flag",
    required: false,
    aliases: ["ICU Flag", "ICU/Normal", "icuFlag"],
  },
  {
    key: "roomRentAmount",
    label: "Room Rent Amount",
    required: false,
    aliases: [
      "Room Rent Amount",
      "Room Rent Claimed",
      "Total Room Rent Claimed",
      "Total Room Rent Paid",
    ],
  },
  {
    key: "roomRentPerDay",
    label: "Room Rent Per Day",
    required: false,
    aliases: [
      "Room Rent Per Day",
      "Per Day Room Rent",
      "Daily Room Rent",
    ],
  },
  {
    key: "roomDays",
    label: "Room Days",
    required: false,
    aliases: [
      "Room Days",
      "No. of Days",
      "Normal Room Days",
      "ICU Days",
    ],
  },
];

const CAPPED_AILMENT_FIELD_DEFS = [
  {
    key: "employeeCode",
    label: "Employee Code",
    required: true,
    aliases: ["employee_code", "Employee Code", "employeeCode"],
  },
  {
    key: "procedureType",
    label: "Procedure Type",
    required: true,
    aliases: ["Proc Type", "Procedure Type", "procType"],
  },
  {
    key: "procedureLimit",
    label: "Procedure Limit",
    required: true,
    aliases: ["Proc Limit", "Procedure Limit", "procLimit", "Limit"],
  },
  {
    key: "claimedAmount",
    label: "Claimed Amount",
    required: true,
    aliases: [
      "ARG Claimed Amount",
      "Claimed Amount",
      "Sum of ARG Claimed Amount",
    ],
  },
  {
    key: "incurredAmount",
    label: "Incurred Amount",
    required: true,
    aliases: [
      "ARG Incurred Amount",
      "Incurred Amount",
      "Sum of ARG Incurred Amount",
    ],
  },
  {
    key: "settlementStatus",
    label: "Settlement Status",
    required: true,
    aliases: ["ARG Status1", "Settlement Status", "Status1"],
  },
  {
    key: "ailment",
    label: "Ailment",
    required: false,
    aliases: ["ARG Ailment", "Ailment", "ailment"],
  },
];

const CLAIM_FIELD_KEYS = COPAY_CLAIM_FIELD_DEFS.map((field) => field.key);
const BENEFICIARY_FIELD_KEYS = BENEFICIARY_FIELD_DEFS.map((field) => field.key);
const ICD_FIELD_KEYS = ICD_FIELD_DEFS.map((field) => field.key);
const MATERNITY_FIELD_KEYS = MATERNITY_FIELD_DEFS.map((field) => field.key);
const ROOM_RENT_FIELD_KEYS = ROOM_RENT_FIELD_DEFS.map((field) => field.key);
const CAPPED_AILMENT_FIELD_KEYS = CAPPED_AILMENT_FIELD_DEFS.map(
  (field) => field.key,
);

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

function buildDefaultMapping(headers, fieldDefs, currentMapping) {
  const normalizedHeaderMap = new Map(
    headers.map((header) => [normalizeKey(header), header]),
  );
  const next = {};

  fieldDefs.forEach((field) => {
    if (currentMapping[field.key] && headers.includes(currentMapping[field.key])) {
      next[field.key] = currentMapping[field.key];
      return;
    }

    const candidates = [field.label, field.key, ...(field.aliases || [])];
    const match = candidates.find((candidate) =>
      normalizedHeaderMap.has(normalizeKey(candidate)),
    );

    next[field.key] = match ? normalizedHeaderMap.get(normalizeKey(match)) : "";
  });

  return next;
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

function useMappedWorkspace({ sample, fieldDefs }) {
  const [text, setText] = useState(sample);
  const [showPreview, setShowPreview] = useState(false);
  const [mapping, setMapping] = useState({});
  const [singleColText, setSingleColText] = useState("");
  const [singleColTargetKey, setSingleColTargetKey] = useState(fieldDefs[0].key);
  const [singleColStartRow, setSingleColStartRow] = useState(2);

  const rows = useMemo(() => parseCSV(text || ""), [text]);
  const headers = rows[0] || null;
  const previewRows = rows.slice(1, 21);

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

  async function pasteClipboard() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
    } catch (error) {
      alert("Clipboard paste failed: " + (error && error.message));
    }
  }

  function importFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setText(String(event.target?.result || ""));
    };
    reader.readAsText(file);
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

  function clearData() {
    setText("");
  }

  function loadSample() {
    setText(sample);
  }

  function previewOnly() {
    setSingleColText("");
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
    singleColText,
    setSingleColText,
    singleColTargetKey,
    setSingleColTargetKey,
    singleColStartRow,
    setSingleColStartRow,
    rows,
    headers,
    previewRows,
    missingRequiredFields,
    hasDuplicateMapping,
    pasteClipboard,
    importFile,
    editCell,
    clearData,
    loadSample,
    previewOnly,
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
          <span className="tab-caption">{tab.description}</span>
        </button>
      ))}
    </div>
  );
}

function WorkspaceActionsCard({
  workspace,
  extraActions = [],
  accept = ".csv,text/csv",
}) {
  return (
    <section className="card">
      <div className="toolbar">
        <input
          className="file-input"
          type="file"
          accept={accept}
          onChange={(event) => workspace.importFile(event.target.files?.[0])}
        />
        <button type="button" onClick={workspace.pasteClipboard}>
          Paste from Clipboard
        </button>
        <button type="button" className="secondary" onClick={workspace.loadSample}>
          Load Sample
        </button>
        <button type="button" className="secondary" onClick={workspace.clearData}>
          Clear
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => workspace.setShowPreview((value) => !value)}
        >
          {workspace.showPreview ? "Hide Preview" : "Show Preview"}
        </button>
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
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {headers ? (
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
      ) : (
        <div className="notice">Paste or upload data to map fields.</div>
      )}
    </section>
  );
}

function PreviewTable({ headers, rows, onEditCell }) {
  if (!headers) return null;

  return (
    <div className="table-wrap top-gap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length}>No data rows to preview.</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join("|")}`}>
                {headers.map((header, colIndex) => (
                  <td key={`${header}-${colIndex}`}>
                    <input
                      className="preview-input"
                      value={row[colIndex] || ""}
                      onChange={(event) =>
                        onEditCell(rowIndex, colIndex, event.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))
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
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <textarea
        value={workspace.text}
        onChange={(event) => workspace.setText(event.target.value)}
        rows={8}
        spellCheck={false}
      />
      <div className="split-grid top-gap">
        <div className="stack">
          <div className="stack">
            <div className="section-label">Paste single column from Excel</div>
            <div className="muted">
              Paste a newline-separated column and choose which standard field it
              should populate.
            </div>
          </div>
          <textarea
            value={workspace.singleColText}
            onChange={(event) => workspace.setSingleColText(event.target.value)}
            rows={6}
            placeholder="Paste a single column here"
          />
          <div className="inline-controls">
            <select
              value={workspace.singleColTargetKey}
              onChange={(event) => workspace.setSingleColTargetKey(event.target.value)}
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
            <button
              type="button"
              className="secondary"
              onClick={() => workspace.setSingleColText("")}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="stack">
          <div className="stack">
            <div className="section-label">Apply column</div>
            <div className="muted">
              Merge the pasted column into the current dataset before
              calculation.
            </div>
          </div>
          <div className="stack grow">
            <button type="button" onClick={workspace.applySingleColumn}>
              Apply Column Paste
            </button>
            <button
              type="button"
              className="secondary"
              onClick={workspace.previewOnly}
            >
              Preview Only
            </button>
          </div>
        </div>
      </div>

      {missingLabels.length > 0 ? (
        <div className="notice">
          Missing required mappings: {missingLabels.join(", ")}
        </div>
      ) : null}

      {workspace.showPreview ? (
        <PreviewTable
          headers={workspace.headers}
          rows={workspace.previewRows}
          onEditCell={workspace.editCell}
        />
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
          <h2>Dashboard Configuration</h2>
          <p className="muted">
            Dashboard existing limits stay separate from the workbook formulas
            used for row-level <code>Copay Existing</code>.
          </p>
        </div>
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
          <h2>Maternity Dashboard Configuration</h2>
          <p className="muted">
            Existing and proposed maternity limits are editable. Row-level
            <code> Difference </code>
            still uses the grouped procedure limit from the uploaded data.
          </p>
        </div>
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
          <h2>Room Rent Configuration</h2>
          <p className="muted">
            Existing and proposed room-rent caps are stored as percentages of
            sum insured and applied to Normal and ICU categories separately.
          </p>
        </div>
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
          <h2>Capped Ailment Configuration</h2>
          <p className="muted">
            Configure existing and proposed limits by procedure type. Rows with
            zero-configured limits stay visible and contribute zero impact,
            except Psychiatric which follows the separate incurred-amount rule.
          </p>
        </div>
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
  const workspace = useMappedWorkspace({
    sample: SUM_INSURED_SAMPLE,
    fieldDefs: SUM_INSURED_FIELD_DEFS,
  });
  const [statusFilter, setStatusFilter] = useState("Settled");
  const [proposedLimit, setProposedLimit] = useState(300000);
  const [numberFormat, setNumberFormat] = useState("en-IN");

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
      <section className="hero">
        <div className="hero-card">
          <h2>Sum Insured Impact Calculator</h2>
          <p>
            Paste claim data, upload CSV, or copy from Excel to test how a new
            sum insured changes payable claim amounts.
          </p>
          <div className="notice">
            Required fields: Employee ID, Claim Status, Current Sum Insured,
            Claimed Amount, and Incurred Amount.
          </div>
        </div>
        <div className="metric">
          <div>
            <div className="metric-label">Grand Total Impact</div>
            <div className={`metric-value ${moneyClass(grandTotal)}`}>
              {formatNumber(grandTotal, numberFormat)}
            </div>
          </div>
          <p className="metric-copy">
            Negative values mean payable amount reduces under the proposed
            limit.
          </p>
        </div>
      </section>

      <WorkspaceActionsCard
        workspace={workspace}
        extraActions={[{ label: "Download Results CSV", onClick: downloadResults }]}
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

      <FieldMappingCard
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={SUM_INSURED_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Paste / Upload Data"
        description="Upload a claim file or paste the raw table directly."
        workspace={workspace}
        fieldDefs={SUM_INSURED_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

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

function CopayCalculator() {
  const claimsWorkspace = useMappedWorkspace({
    sample: COPAY_CLAIM_SAMPLE,
    fieldDefs: COPAY_CLAIM_FIELD_DEFS,
  });
  const beneficiaryWorkspace = useMappedWorkspace({
    sample: BENEFICIARY_TYPE_SAMPLE,
    fieldDefs: BENEFICIARY_FIELD_DEFS,
  });
  const icdWorkspace = useMappedWorkspace({
    sample: ICD_AILMENT_SAMPLE,
    fieldDefs: ICD_FIELD_DEFS,
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
    beneficiaryWorkspace.headers &&
    icdWorkspace.headers &&
    claimsWorkspace.missingRequiredFields.length === 0 &&
    beneficiaryWorkspace.missingRequiredFields.length === 0 &&
    icdWorkspace.missingRequiredFields.length === 0 &&
    !claimsWorkspace.hasDuplicateMapping &&
    !beneficiaryWorkspace.hasDuplicateMapping &&
    !icdWorkspace.hasDuplicateMapping;

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
      beneficiaryTypeRows: mapRowsToObjects(
        beneficiaryWorkspace.rows,
        beneficiaryWorkspace.headers,
        beneficiaryWorkspace.mapping,
        BENEFICIARY_FIELD_KEYS,
      ),
      icdRows: mapRowsToObjects(
        icdWorkspace.rows,
        icdWorkspace.headers,
        icdWorkspace.mapping,
        ICD_FIELD_KEYS,
      ),
      dashboardConfig,
    });
  }, [
    beneficiaryWorkspace.headers,
    beneficiaryWorkspace.mapping,
    beneficiaryWorkspace.rows,
    beneficiaryWorkspace.hasDuplicateMapping,
    beneficiaryWorkspace.missingRequiredFields.length,
    canCalculate,
    claimsWorkspace.headers,
    claimsWorkspace.mapping,
    claimsWorkspace.rows,
    claimsWorkspace.hasDuplicateMapping,
    claimsWorkspace.missingRequiredFields.length,
    dashboardConfig,
    icdWorkspace.headers,
    icdWorkspace.mapping,
    icdWorkspace.rows,
    icdWorkspace.hasDuplicateMapping,
    icdWorkspace.missingRequiredFields.length,
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
      <section className="hero">
        <div className="hero-card">
          <h2>Co-pay Calculator</h2>
          <p>
            This tab mirrors the workbook logic. It derives relationship groups
            from the beneficiary dimension, looks up ailments from ICD prefixes,
            calculates workbook-style co-pay amounts, and summarizes totals for
            ESC and Parent.
          </p>
          <div className="notice">
            Row-level <code>Copay Existing</code> uses gross-up formulas from
            the workbook. Dashboard existing limits are editable but separate.
          </div>
        </div>
        <div className="metric">
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
          <p className="metric-copy">
            Dashboard totals are the sum of <code>Copay New Suggested</code> by
            relationship type, exactly like the workbook.
          </p>
        </div>
      </section>

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
            <div className="section-label">Default Existing Co-pay Formula</div>
            <div className="muted">ESC = Incurred Amount x 10 / 90</div>
            <div className="muted">Parent = Incurred Amount x 20 / 80</div>
          </div>
          <div className="info-card">
            <div className="section-label">Validation Behavior</div>
            <div className="muted">
              Missing relationship or ICD mappings stay in the run and show up
              in the warnings table.
            </div>
          </div>
        </div>
      </section>

      <CopayDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={copayResult.dashboard}
      />

      <WorkspaceActionsCard
        workspace={claimsWorkspace}
        extraActions={[
          { label: "Download Data CSV", onClick: downloadDataResults },
          { label: "Download Dashboard CSV", onClick: downloadDashboardResults },
        ]}
      />

      <FieldMappingCard
        title="Claim Data Mapping"
        description="Use the standard business names below. Older workbook headers are still accepted during upload."
        headers={claimsWorkspace.headers}
        mapping={claimsWorkspace.mapping}
        fieldDefs={COPAY_CLAIM_FIELD_DEFS}
        onMappingChange={claimsWorkspace.setMapping}
        showDuplicateNotice={claimsWorkspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Claim Data"
        description="Upload or paste the claim-level data using simple business names. Older workbook-style headers are still accepted in uploaded files."
        workspace={claimsWorkspace}
        fieldDefs={COPAY_CLAIM_FIELD_DEFS}
        missingLabels={claimsWorkspace.missingRequiredFields.map((field) => field.label)}
      />

      <WorkspaceActionsCard workspace={beneficiaryWorkspace} />

      <FieldMappingCard
        title="Beneficiary Type Dimension Mapping"
        description="Maps uploaded beneficiary relationships to Beneficiary Type Group2, which drives Relationship Group."
        headers={beneficiaryWorkspace.headers}
        mapping={beneficiaryWorkspace.mapping}
        fieldDefs={BENEFICIARY_FIELD_DEFS}
        onMappingChange={beneficiaryWorkspace.setMapping}
        showDuplicateNotice={beneficiaryWorkspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Beneficiary Type Dimension"
        description="Equivalent to the workbook lookup area in Lists!X:AA."
        workspace={beneficiaryWorkspace}
        fieldDefs={BENEFICIARY_FIELD_DEFS}
        missingLabels={beneficiaryWorkspace.missingRequiredFields.map((field) => field.label)}
      />

      <WorkspaceActionsCard workspace={icdWorkspace} />

      <FieldMappingCard
        title="ICD / Ailment Mapping"
        description="Maps the first 3 characters of ICD Code to the workbook ailment output."
        headers={icdWorkspace.headers}
        mapping={icdWorkspace.mapping}
        fieldDefs={ICD_FIELD_DEFS}
        onMappingChange={icdWorkspace.setMapping}
        showDuplicateNotice={icdWorkspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="ICD / Ailment Dimension"
        description="Equivalent to the workbook lookup area in Lists!AJ:AL."
        workspace={icdWorkspace}
        fieldDefs={ICD_FIELD_DEFS}
        missingLabels={icdWorkspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Calculated Data</h2>
            <p className="muted">
              Output columns follow the workbook order and include the
              calculated relationship group, ailment, co-pay amounts, and final
              relationship type.
            </p>
          </div>
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
      <section className="hero">
        <div className="hero-card">
          <h2>Maternity</h2>
          <p>
            This tab rebuilds the workbook maternity sheet from claim-level
            data. It filters settled maternity claims, groups them by employee
            code, procedure type, and procedure limit, then applies the
            workbook proposed and difference formulas.
          </p>
          <div className="notice">
            Preferred filter: <code>Settlement Status = Settled</code> and
            <code> Ailment = Maternity</code>. If ailment is missing, the tab
            falls back to recognized maternity procedure types.
          </div>
        </div>
        <div className="metric">
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
          <p className="metric-copy">
            Dashboard totals are the sum of grouped
            <code> Difference </code>
            values for <code>Normal</code> and <code>C-section</code>.
          </p>
        </div>
      </section>

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
            <div className="section-label">Fixed Claim Filter</div>
            <div className="muted">Settlement Status must be Settled.</div>
            <div className="muted">
              Ailment should be Maternity when that column is available.
            </div>
          </div>
          <div className="info-card">
            <div className="section-label">Procedure Mapping</div>
            <div className="muted">Normal maps to the Normal dashboard row.</div>
            <div className="muted">
              C-section, C-Section, and C section map to C-section.
            </div>
          </div>
        </div>
      </section>

      <MaternityDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={maternityResult.dashboard}
      />

      <WorkspaceActionsCard
        workspace={workspace}
        extraActions={[
          { label: "Download Data CSV", onClick: downloadDataResults },
          { label: "Download Dashboard CSV", onClick: downloadDashboardResults },
        ]}
      />

      <FieldMappingCard
        title="Maternity Source Mapping"
        description="Map the raw Data sheet columns used to build the workbook maternity summary."
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={MATERNITY_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Maternity Source Data"
        description="Upload or paste claim-level data. The calculator groups settled maternity rows by employee code, procedure type, and procedure limit."
        workspace={workspace}
        fieldDefs={MATERNITY_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Calculated Maternity Sheet</h2>
            <p className="muted">
              Output follows the workbook layout: grouped rows with proposed
              limit and calculated difference.
            </p>
          </div>
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
      <section className="hero">
        <div className="hero-card">
          <h2>Room Rent</h2>
          <p>
            This tab estimates room-rent impact using sum-insured-based caps for
            Normal and ICU rooms. It supports either a total room-rent amount
            or per-day room rent with days.
          </p>
          <div className="notice">
            This is a practical room-rent model. It is claim-accurate only when
            your uploaded data includes room category and room-rent charge
            fields.
          </div>
        </div>
        <div className="metric">
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
          <p className="metric-copy">
            Impact is calculated as proposed room-rent payable minus existing
            room-rent payable.
          </p>
        </div>
      </section>

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
            <div className="section-label">Default Room Rent Caps</div>
            <div className="muted">Normal: 1% to 2% of Sum Insured</div>
            <div className="muted">ICU: 2% to 4% of Sum Insured</div>
          </div>
          <div className="info-card">
            <div className="section-label">Amount Logic</div>
            <div className="muted">
              Uses total room-rent amount when present.
            </div>
            <div className="muted">
              Otherwise uses room-rent per day times room days.
            </div>
          </div>
        </div>
      </section>

      <RoomRentDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={roomRentResult.dashboard}
      />

      <WorkspaceActionsCard
        workspace={workspace}
        extraActions={[
          { label: "Download Data CSV", onClick: downloadDataResults },
          { label: "Download Dashboard CSV", onClick: downloadDashboardResults },
        ]}
      />

      <FieldMappingCard
        title="Room Rent Source Mapping"
        description="Map settled claim data to room category and room-rent charge fields."
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
        title="Room Rent Source Data"
        description="Upload or paste claim-level data. The calculator only includes rows where Settlement Status is Settled."
        workspace={workspace}
        fieldDefs={ROOM_RENT_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Calculated Room Rent Impact</h2>
            <p className="muted">
              Each settled row shows actual room rent, existing and proposed
              cap amounts, payable amounts, and impact.
            </p>
          </div>
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
      <section className="hero">
        <div className="hero-card">
          <h2>Capped Ailment</h2>
          <p>
            This tab rebuilds the capped-ailment sheet from settled claim rows.
            It groups by employee code, procedure type, and existing limit, and
            then applies the workbook difference logic by configured ailment
            type.
          </p>
          <div className="notice">
            Psychiatric follows the special workbook rule:
            <code> Proposed = Incurred Amount</code> and
            <code> Difference = Incurred Amount</code>.
          </div>
        </div>
        <div className="metric">
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
          <p className="metric-copy">
            Dashboard totals are the sum of grouped
            <code> Difference </code>
            values by capped ailment type.
          </p>
        </div>
      </section>

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
            <div className="muted">
              Only rows with Settlement Status = Settled are included.
            </div>
            <div className="muted">
              Grouping key: Employee Code + Procedure Type + Procedure Limit.
            </div>
          </div>
          <div className="info-card">
            <div className="section-label">Procedure Matching</div>
            <div className="muted">
              Uses normalized procedure types such as TKR THR to TKR/THR.
            </div>
            <div className="muted">
              Psychiatric can also fall back from ailment text.
            </div>
          </div>
        </div>
      </section>

      <CappedAilmentDashboardConfigCard
        dashboardForm={dashboardForm}
        setDashboardForm={setDashboardForm}
        numberFormat={numberFormat}
        dashboard={cappedAilmentResult.dashboard}
      />

      <WorkspaceActionsCard
        workspace={workspace}
        extraActions={[
          { label: "Download Data CSV", onClick: downloadDataResults },
          { label: "Download Dashboard CSV", onClick: downloadDashboardResults },
        ]}
      />

      <FieldMappingCard
        title="Capped Ailment Source Mapping"
        description="Map the raw Data sheet columns needed to build the capped ailment summary."
        headers={workspace.headers}
        mapping={workspace.mapping}
        fieldDefs={CAPPED_AILMENT_FIELD_DEFS}
        onMappingChange={workspace.setMapping}
        showDuplicateNotice={workspace.hasDuplicateMapping}
      />

      <DataEntryCard
        title="Capped Ailment Source Data"
        description="Upload or paste claim-level data. The calculator only includes settled rows with supported capped ailment procedure types."
        workspace={workspace}
        fieldDefs={CAPPED_AILMENT_FIELD_DEFS}
        missingLabels={workspace.missingRequiredFields.map((field) => field.label)}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Calculated Capped Ailment Sheet</h2>
            <p className="muted">
              Output follows the grouped workbook structure with proposed limit
              and calculated difference.
            </p>
          </div>
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

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Insurance Calculators</p>
        <h1>Claims Scenario Workbench</h1>
        <p className="page-copy">
          Switch between calculators without leaving the page. Each tab keeps
          its own uploaded data, mappings, and scenario inputs.
        </p>
      </header>

      <PageTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <section
        hidden={activeTab !== "sum-insured"}
        aria-hidden={activeTab !== "sum-insured"}
      >
        <SumInsuredCalculator />
      </section>

      <section hidden={activeTab !== "copay"} aria-hidden={activeTab !== "copay"}>
        <CopayCalculator />
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
