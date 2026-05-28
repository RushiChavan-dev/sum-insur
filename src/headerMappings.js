import { normalizeKey } from "./lib";

export const HEADER_SCAN_LIMIT = 20;

export const SUM_INSURED_FIELD_DEFS = [
  {
    key: "Employee ID",
    label: "Employee ID",
    required: true,
    aliases: ["Employee ID", "employee_code", "Employee Code", "employeeCode"],
  },
  {
    key: "Claim Status",
    label: "Claim Status",
    required: true,
    aliases: [
      "Claim Status",
      "ARG Status",
      "ARG Status1",
      "Settlement Status",
      "Status1",
    ],
  },
  {
    key: "Current Sum Insured",
    label: "Current Sum Insured",
    required: true,
    aliases: [
      "Current Sum Insured",
      "Sum Insured",
      "Insured Amount",
      "sumInsured",
    ],
  },
  {
    key: "Claimed Amount",
    label: "Claimed Amount",
    required: true,
    aliases: [
      "Claimed Amount",
      "ARG Claimed Amount",
      "Sum of ARG Claimed Amount",
    ],
  },
  {
    key: "Incurred Amount",
    label: "Incurred Amount",
    required: true,
    aliases: [
      "Incurred Amount",
      "ARG Incurred Amount",
      "IncurredAmount",
      "Sum of ARG Incurred Amount",
    ],
  },
];

export const COPAY_CLAIM_FIELD_DEFS = [
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
      "IncurredAmount",
      "Sum of ARG Incurred Amount",
    ],
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
    aliases: ["Proc Limit", "Procedure Limit", "Limit"],
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

export const BENEFICIARY_FIELD_DEFS = [
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

export const ICD_FIELD_DEFS = [
  {
    key: "icdPrefix",
    label: "ICD Prefix",
    required: true,
    aliases: [
      "ICD Prefix",
      "icdPrefix",
      "ICD Start Code",
      "ICD10 Start Code",
    ],
  },
  {
    key: "category",
    label: "Category",
    required: false,
    aliases: [
      "Category",
      "category",
      "ICD Start Code Classification",
      "ICD Classification",
      "Classification",
    ],
  },
  {
    key: "ailment",
    label: "Ailment",
    required: true,
    aliases: [
      "Ailment",
      "ailment",
      "Group Diagnosis1",
      "Group Diagnosis 1",
      "Diagnosis Group 1",
      "Group Diagnosis2",
      "Group Diagnosis 2",
      "Diagnosis Group 2",
    ],
  },
];

export const MATERNITY_FIELD_DEFS = [
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

export const ROOM_RENT_FIELD_DEFS = [
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
    aliases: ["Room Category", "Room Type", "ICU / Normal", "roomCategory"],
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
    aliases: ["Room Days", "No. of Days", "Normal Room Days", "ICU Days"],
  },
];

export const CAPPED_AILMENT_FIELD_DEFS = [
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

export const CLAIM_FIELD_KEYS = COPAY_CLAIM_FIELD_DEFS.map((field) => field.key);
export const BENEFICIARY_FIELD_KEYS = BENEFICIARY_FIELD_DEFS.map(
  (field) => field.key,
);
export const ICD_FIELD_KEYS = ICD_FIELD_DEFS.map((field) => field.key);
export const MATERNITY_FIELD_KEYS = MATERNITY_FIELD_DEFS.map((field) => field.key);
export const ROOM_RENT_FIELD_KEYS = ROOM_RENT_FIELD_DEFS.map((field) => field.key);
export const CAPPED_AILMENT_FIELD_KEYS = CAPPED_AILMENT_FIELD_DEFS.map(
  (field) => field.key,
);

export function buildDefaultMapping(headers, fieldDefs, currentMapping = {}) {
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

export function getAutoMappedMissingRequiredFields(headers, fieldDefs) {
  if (!headers || headers.length === 0) {
    return fieldDefs.filter((field) => field.required);
  }

  const nextMapping = buildDefaultMapping(headers, fieldDefs, {});
  return fieldDefs.filter((field) => field.required && !nextMapping[field.key]);
}

const NUMERIC_FIELD_KEYS = new Set([
  "sumInsured",
  "age",
  "claimedAmount",
  "incurredAmount",
  "procedureLimit",
  "roomRentAmount",
  "roomRentPerDay",
  "roomDays",
  "Current Sum Insured",
  "Claimed Amount",
  "Incurred Amount",
]);

function hasCellValue(value) {
  return String(value ?? "").trim() !== "";
}

function looksLikeNumericValue(value) {
  return /^-?[\d,]+(?:\.\d+)?$/.test(String(value ?? "").trim());
}

export function getRowValidationIssues(row, headers, fieldDefs, mapping) {
  if (!Array.isArray(row) || !Array.isArray(headers)) return [];

  const issues = [];
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  fieldDefs.forEach((field) => {
    const mappedHeader = mapping?.[field.key];
    if (!mappedHeader || !headerIndex.has(mappedHeader)) {
      return;
    }

    const value = row[headerIndex.get(mappedHeader)] ?? "";
    if (field.required && !hasCellValue(value)) {
      issues.push(`${field.label} is missing`);
      return;
    }

    if (
      hasCellValue(value) &&
      NUMERIC_FIELD_KEYS.has(field.key) &&
      !looksLikeNumericValue(value)
    ) {
      issues.push(`${field.label} should be numeric`);
    }
  });

  if (row.length > headers.length && row.slice(headers.length).some(hasCellValue)) {
    issues.push("Unexpected extra values found in the row");
  }

  return issues;
}

export function getPreviewRowValidation(rows, headers, fieldDefs, mapping) {
  if (!Array.isArray(rows) || !headers) return [];

  return rows.slice(1).map((row) =>
    getRowValidationIssues(row, headers, fieldDefs, mapping),
  );
}

function getHeaderCandidate(row, index, fieldDefs) {
  const normalizedHeaders = new Set(
    row.map((cell) => normalizeKey(cell)).filter(Boolean),
  );
  const matchedFields = fieldDefs.filter((field) => {
    const candidates = [field.label, field.key, ...(field.aliases || [])].map(
      normalizeKey,
    );

    return candidates.some((candidate) => normalizedHeaders.has(candidate));
  });
  const matchedRequiredFields = matchedFields.filter((field) => field.required);

  return {
    index,
    headers: row,
    matchedFields,
    matchedRequiredFields,
  };
}

function isBetterHeaderCandidate(current, next, requiredCount) {
  const currentHasAllRequired =
    current.matchedRequiredFields.length === requiredCount;
  const nextHasAllRequired = next.matchedRequiredFields.length === requiredCount;

  if (currentHasAllRequired !== nextHasAllRequired) {
    return nextHasAllRequired;
  }

  if (next.matchedRequiredFields.length !== current.matchedRequiredFields.length) {
    return next.matchedRequiredFields.length > current.matchedRequiredFields.length;
  }

  if (next.matchedFields.length !== current.matchedFields.length) {
    return next.matchedFields.length > current.matchedFields.length;
  }

  return next.index < current.index;
}

export function findHeaderRow(rows, fieldDefs, scanLimit = HEADER_SCAN_LIMIT) {
  const rowsToScan = rows.slice(0, scanLimit);
  const requiredCount = fieldDefs.filter((field) => field.required).length;
  let best = null;

  rowsToScan.forEach((row, index) => {
    if (!Array.isArray(row) || row.every((cell) => normalizeKey(cell) === "")) {
      return;
    }

    const candidate = getHeaderCandidate(row, index, fieldDefs);
    if (candidate.matchedFields.length === 0) {
      return;
    }

    if (!best || isBetterHeaderCandidate(best, candidate, requiredCount)) {
      best = candidate;
    }
  });

  return {
    found: Boolean(best),
    headerRowIndex: best ? best.index : -1,
    headers: best ? best.headers : rows[0] || [],
    scannedRows: rowsToScan.length,
  };
}

export function prepareRowsForFieldMapping(
  rows,
  fieldDefs,
  scanLimit = HEADER_SCAN_LIMIT,
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      found: false,
      headerRowIndex: -1,
      headers: [],
      rows: [],
      scannedRows: 0,
      missingRequiredFields: fieldDefs.filter((field) => field.required),
    };
  }

  const headerMatch = findHeaderRow(rows, fieldDefs, scanLimit);
  const alignedRows = headerMatch.found
    ? rows.slice(headerMatch.headerRowIndex)
    : rows;
  const headers = alignedRows[0] || [];

  return {
    ...headerMatch,
    headers,
    rows: alignedRows,
    missingRequiredFields: getAutoMappedMissingRequiredFields(headers, fieldDefs),
  };
}
