import { DEFAULT_ICD_LOOKUP_ROWS } from "./icdDefaults";

export const SUM_INSURED_REQUIRED = [
  "Employee ID",
  "Claim Status",
  "Current Sum Insured",
  "Claimed Amount",
  "Incurred Amount",
];

export const COPAY_REQUIRED = [
  "sumInsured",
  "relationship",
  "age",
  "claimedAmount",
  "incurredAmount",
  "claimType",
  "admissionType",
  "claimStatus",
  "settlementStatus",
  "icdCode",
  "procedureType",
  "procedureLimit",
  "policyNumber",
  "clientName",
  "riskStartDate",
  "riskEndDate",
  "employeeCode",
];

export const REQUIRED = SUM_INSURED_REQUIRED;

export const DEFAULT_COPAY_DASHBOARD_CONFIG = {
  ESC: {
    existingLimit: 0.05,
    proposedLimit: 0.1,
  },
  Parent: {
    existingLimit: 0,
    proposedLimit: 0.12,
  },
};

export const DEFAULT_EXISTING_COPAY_GROSS_UP_CONFIG = {
  ESC: {
    basePercent: 90,
    copayPercent: 10,
  },
  Parent: {
    basePercent: 80,
    copayPercent: 20,
  },
};

export const DEFAULT_MATERNITY_DASHBOARD_CONFIG = {
  Normal: {
    existingLimit: 100000,
    proposedLimit: 75000,
  },
  "C-section": {
    existingLimit: 100000,
    proposedLimit: 125000,
  },
};

export const DEFAULT_ROOM_RENT_DASHBOARD_CONFIG = {
  Normal: {
    existingLimit: 0.01,
    proposedLimit: 0.02,
  },
  ICU: {
    existingLimit: 0.02,
    proposedLimit: 0.04,
  },
};

export const DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG = {
  Cataract: {
    existingLimit: 35000,
    proposedLimit: 50000,
  },
  Hernia: {
    existingLimit: 40000,
    proposedLimit: 80000,
  },
  "TKR/THR": {
    existingLimit: 150000,
    proposedLimit: 200000,
  },
  Psychiatric: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  CAG: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Angioplasty: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  CABG: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Cholecystectomy: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Circumcision: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Cystectomy: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Dialysis: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Fistulectomy: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Haemorrhoidectomy: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Hydrocele: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Hysterectomy: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Infertility: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  "Kidney Stone": {
    existingLimit: 0,
    proposedLimit: 0,
  },
  Appendectomy: {
    existingLimit: 0,
    proposedLimit: 0,
  },
  "Therapy (Chemo / Radio / Photo)": {
    existingLimit: 0,
    proposedLimit: 0,
  },
};

function getCopayRelationshipType(relationshipGroup) {
  return normalizeKey(relationshipGroup) === "parent" ? "Parent" : "ESC";
}

function getExistingCopayGrossUp(relationshipType, existingCopayGrossUpConfig) {
  return (
    existingCopayGrossUpConfig?.[relationshipType] ||
    DEFAULT_EXISTING_COPAY_GROSS_UP_CONFIG[relationshipType]
  );
}

function calculateWorkbookExistingCopay(
  incurredAmount,
  relationshipType,
  existingCopayGrossUpConfig,
) {
  const grossUpConfig = getExistingCopayGrossUp(
    relationshipType,
    existingCopayGrossUpConfig,
  );

  if (
    !grossUpConfig ||
    !Number.isFinite(grossUpConfig.basePercent) ||
    grossUpConfig.basePercent === 0 ||
    !Number.isFinite(grossUpConfig.copayPercent)
  ) {
    return 0;
  }

  return (
    (incurredAmount * grossUpConfig.copayPercent) / grossUpConfig.basePercent
  );
}

function normalizeCompactKey(value) {
  return normalizeKey(value).replace(/[^a-z0-9]/g, "");
}

function normalizeMaternityProcedureType(procedureType) {
  const compactKey = normalizeCompactKey(procedureType);

  if (compactKey === "normal") return "Normal";
  if (compactKey === "csection") return "C-section";

  return "";
}

function isMaternityAilment(ailment) {
  return normalizeKey(ailment) === "maternity";
}

function normalizeRoomRentCategory(roomCategory, icuFlag) {
  const roomCategoryKey = normalizeCompactKey(roomCategory);
  const icuFlagKey = normalizeCompactKey(icuFlag);

  if (
    roomCategoryKey === "icu" ||
    roomCategoryKey.includes("intensivecare") ||
    icuFlagKey === "icu" ||
    ["y", "yes", "true", "1"].includes(icuFlagKey)
  ) {
    return "ICU";
  }

  if (
    [
      "normal",
      "regular",
      "room",
      "normalroom",
      "nonicu",
    ].includes(roomCategoryKey) ||
    ["n", "no", "false", "0", "normal"].includes(icuFlagKey)
  ) {
    return "Normal";
  }

  return "";
}

function getRoomRentRateConfig(roomCategory, dashboardConfig) {
  return (
    dashboardConfig?.[roomCategory] ||
    DEFAULT_ROOM_RENT_DASHBOARD_CONFIG[roomCategory]
  );
}

function calculateRoomRentLimits(sumInsured, roomDays, rateConfig) {
  const dayMultiplier = roomDays > 0 ? roomDays : 1;

  return {
    dayMultiplier,
    existingLimitAmount:
      sumInsured * (rateConfig?.existingLimit ?? 0) * dayMultiplier,
    proposedLimitAmount:
      sumInsured * (rateConfig?.proposedLimit ?? 0) * dayMultiplier,
  };
}

function normalizeCappedAilmentType(procedureType, ailment) {
  const procedureTypeKey = normalizeCompactKey(procedureType);
  const ailmentKey = normalizeCompactKey(ailment);

  const directMatches = new Map([
    ["cataract", "Cataract"],
    ["hernia", "Hernia"],
    ["tkrthr", "TKR/THR"],
    ["psychiatric", "Psychiatric"],
    ["psychiatry", "Psychiatric"],
    ["cag", "CAG"],
    ["angioplasty", "Angioplasty"],
    ["cabg", "CABG"],
    ["cholecystectomy", "Cholecystectomy"],
    ["circumcision", "Circumcision"],
    ["cystectomy", "Cystectomy"],
    ["dialysis", "Dialysis"],
    ["fistulectomy", "Fistulectomy"],
    ["haemorrhoidectomy", "Haemorrhoidectomy"],
    ["hemorrhoidectomy", "Haemorrhoidectomy"],
    ["hydrocele", "Hydrocele"],
    ["hysterectomy", "Hysterectomy"],
    ["infertility", "Infertility"],
    ["kidneystone", "Kidney Stone"],
    ["appendectomy", "Appendectomy"],
    ["therapychemoradiophoto", "Therapy (Chemo / Radio / Photo)"],
    ["therapy", "Therapy (Chemo / Radio / Photo)"],
  ]);

  if (directMatches.has(procedureTypeKey)) {
    return directMatches.get(procedureTypeKey);
  }

  if (ailmentKey.includes("psychi") || ailmentKey.includes("psycholog")) {
    return "Psychiatric";
  }

  if (directMatches.has(ailmentKey)) {
    return directMatches.get(ailmentKey);
  }

  return "";
}

function calculateCappedAilmentDifference(
  existingLimit,
  claimedAmount,
  incurredAmount,
  proposedLimit,
) {
  if (incurredAmount >= existingLimit) {
    if (claimedAmount > existingLimit && claimedAmount > proposedLimit) {
      return proposedLimit - existingLimit;
    }

    if (claimedAmount > existingLimit && claimedAmount < proposedLimit) {
      return claimedAmount - existingLimit;
    }

    return 0;
  }

  if (proposedLimit < existingLimit) {
    return incurredAmount > proposedLimit ? proposedLimit - incurredAmount : 0;
  }

  return 0;
}

function calculateMaternityProposedLimit(procedureType, dashboardConfig) {
  const normalizedProcedureType = normalizeMaternityProcedureType(procedureType);

  if (!normalizedProcedureType) return 0;

  return (
    dashboardConfig?.[normalizedProcedureType]?.proposedLimit ??
    DEFAULT_MATERNITY_DASHBOARD_CONFIG[normalizedProcedureType].proposedLimit
  );
}

function calculateMaternityDifference({
  procedureLimit,
  claimedAmount,
  incurredAmount,
  proposedLimit,
}) {
  if (incurredAmount >= procedureLimit) {
    if (claimedAmount > procedureLimit && claimedAmount > proposedLimit) {
      return proposedLimit - procedureLimit;
    }

    if (claimedAmount > procedureLimit && claimedAmount < proposedLimit) {
      return claimedAmount - procedureLimit;
    }

    return 0;
  }

  if (proposedLimit < procedureLimit) {
    return incurredAmount > proposedLimit ? proposedLimit - incurredAmount : 0;
  }

  return 0;
}

export function parseCSV(text) {
  if (!text) return [];

  let delimiter = ",";
  let quoteScan = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoteScan && next === '"') {
      index += 1;
    } else if (char === '"') {
      quoteScan = !quoteScan;
    } else if (char === "\t" && !quoteScan) {
      delimiter = "\t";
      break;
    } else if ((char === "\n" || char === "\r") && !quoteScan) {
      // Delimiter is chosen from the first non-quoted row.
      break;
    }
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row.map((value) => value.trim()));
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(Boolean)) rows.push(row.map((value) => value.trim()));

  return rows;
}

function escapeCSVCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function spreadsheetCellToText(value) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return "";
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

export function workbookSheetsToCSV(sheets) {
  const firstPopulatedSheet = Array.isArray(sheets)
    ? sheets.find(
        (sheet) =>
          Array.isArray(sheet?.data) &&
          sheet.data.some(
            (row) =>
              Array.isArray(row) &&
              row.some((cell) => spreadsheetCellToText(cell).trim() !== ""),
          ),
      )
    : null;

  if (!firstPopulatedSheet) return "";

  return firstPopulatedSheet.data
    .map((row) => row.map((cell) => escapeCSVCell(spreadsheetCellToText(cell))).join(","))
    .join("\n");
}

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

export function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapRowsToObjects(rows, headers, mapping, fieldKeys) {
  if (!headers || !Array.isArray(fieldKeys)) return [];

  const index = buildIndex(headers, mapping);

  return rows.slice(1).map((row, rowIndex) => {
    const mapped = { __rowNumber: rowIndex + 2 };

    fieldKeys.forEach((fieldKey) => {
      mapped[fieldKey] = getCell(row, index[fieldKey]);
    });

    return mapped;
  });
}

export function buildBeneficiaryTypeMap(beneficiaryTypeRows) {
  const map = new Map();

  beneficiaryTypeRows.forEach((row) => {
    const key = normalizeKey(row.beneficiaryType);
    if (!key) return;

    map.set(key, {
      beneficiaryType: normalizeText(row.beneficiaryType),
      beneficiaryTypeGroup1: normalizeText(row.beneficiaryTypeGroup1),
      beneficiaryTypeGroup2: normalizeText(row.beneficiaryTypeGroup2),
      beneficiaryTypeGroup: normalizeText(row.beneficiaryTypeGroup),
    });
  });

  return map;
}

export function buildIcdAilmentMap(icdRows) {
  const map = new Map();

  [...DEFAULT_ICD_LOOKUP_ROWS, ...(icdRows || [])].forEach((row) => {
    const key = normalizeIcdCodeKey(row.icdPrefix);
    const ailment = normalizeText(row.ailment);
    if (!key || !ailment) return;

    map.set(key, {
      icdPrefix: normalizeText(row.icdPrefix),
      category: normalizeText(row.category),
      ailment,
    });
  });

  return map;
}

function normalizeIcdCodeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findIcdAilmentMatch(icdCode, icdAilmentMap) {
  const compactIcdCode = normalizeIcdCodeKey(icdCode);

  for (let index = compactIcdCode.length; index >= 3; index -= 1) {
    const match = icdAilmentMap.get(compactIcdCode.slice(0, index));
    if (match) return match;
  }

  return null;
}

export function calculateSumInsured(
  rows,
  headers,
  mapping,
  statusFilter,
  proposedLimit,
) {
  if (!headers) return { rows: [], summary: [], grandTotal: 0 };

  const index = buildIndex(headers, mapping);
  const normalizedStatus = normalizeKey(statusFilter);
  const nextLimit = parseNumber(proposedLimit);

  const parsedRows = rows.slice(1).map((row) => {
    const claimStatus = getCell(row, index["Claim Status"]);
    const currentSumInsured = parseNumber(
      getCell(row, index["Current Sum Insured"]),
    );
    const claimedAmount = parseNumber(getCell(row, index["Claimed Amount"]));
    const incurredAmount = parseNumber(getCell(row, index["Incurred Amount"]));
    const currentPayable = Math.min(incurredAmount, currentSumInsured);
    const newPayable = Math.min(incurredAmount, nextLimit);
    const impact = newPayable - currentPayable;
    const included =
      !normalizedStatus || normalizeKey(claimStatus) === normalizedStatus;

    return {
      employeeId: getCell(row, index["Employee ID"]),
      claimStatus,
      currentSumInsured,
      claimedAmount,
      incurredAmount,
      newProposedSumInsured: nextLimit,
      currentPayable,
      newPayable,
      impact,
      included,
    };
  });

  const summaryMap = new Map();

  parsedRows
    .filter((row) => row.included)
    .forEach((row) => {
      const key = row.currentSumInsured;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          currentSumInsured: key,
          newProposedSumInsured: nextLimit,
          includedClaims: 0,
          totalImpact: 0,
        });
      }

      const summary = summaryMap.get(key);
      summary.includedClaims += 1;
      summary.totalImpact += row.impact;
    });

  const summary = Array.from(summaryMap.values()).sort(
    (left, right) => left.currentSumInsured - right.currentSumInsured,
  );
  const grandTotal = summary.reduce(
    (total, item) => total + item.totalImpact,
    0,
  );

  return { rows: parsedRows, summary, grandTotal };
}

export function calculateCopayRows(
  rawClaimRows,
  beneficiaryTypeMap,
  icdAilmentMap,
  dashboardConfig = DEFAULT_COPAY_DASHBOARD_CONFIG,
  existingCopayGrossUpConfig = DEFAULT_EXISTING_COPAY_GROSS_UP_CONFIG,
) {
  const warnings = [];

  const rows = rawClaimRows.map((rawRow) => {
    const rowWarnings = [];
    const rowNumber = rawRow.__rowNumber ?? null;

    const relationship = normalizeText(rawRow.relationship);
    const icdCode = normalizeText(rawRow.icdCode);
    const claimStatus = normalizeText(rawRow.claimStatus);
    const settlementStatus = normalizeText(rawRow.settlementStatus);
    const claimType = normalizeText(rawRow.claimType);
    const admissionType = normalizeText(rawRow.admissionType);
    const procedureType = normalizeText(rawRow.procedureType);
    const grade = normalizeText(rawRow.grade);
    const policyNumber = normalizeText(rawRow.policyNumber);
    const clientName = normalizeText(rawRow.clientName);
    const employeeCode = normalizeText(rawRow.employeeCode);

    const sumInsured = parseNumericField(
      rawRow.sumInsured,
      "Sum Insured",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const age = parseNumericField(
      rawRow.age,
      "Age",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const claimedAmount = parseNumericField(
      rawRow.claimedAmount,
      "Claimed Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const incurredAmount = parseNumericField(
      rawRow.incurredAmount,
      "Incurred Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const procedureLimit = parseNumericField(
      rawRow.procedureLimit,
      "Procedure Limit",
      rowWarnings,
      rowNumber,
      employeeCode,
    );

    if (!relationship) {
      rowWarnings.push(makeWarning(rowNumber, employeeCode, "relationship", "Relationship is missing."));
    }

    if (!icdCode) {
      rowWarnings.push(makeWarning(rowNumber, employeeCode, "icdCode", "ICD code is missing."));
    }

    const beneficiaryMatch = beneficiaryTypeMap.get(normalizeKey(relationship));
    const relationshipGroup = beneficiaryMatch?.beneficiaryTypeGroup2 || "";

    if (!beneficiaryMatch && relationship) {
      rowWarnings.push(
        makeWarning(
          rowNumber,
          employeeCode,
          "relationship",
          "Relationship not found in beneficiary mapping.",
        ),
      );
    }

    const relationshipType = getCopayRelationshipType(relationshipGroup);

    const ailmentMatch = findIcdAilmentMatch(icdCode, icdAilmentMap);
    const ailment = ailmentMatch?.ailment || "";

    if (!ailmentMatch && icdCode) {
      rowWarnings.push(
        makeWarning(
          rowNumber,
          employeeCode,
          "icdCode",
          "ICD code not found in ailment mapping.",
        ),
      );
    }

    const proposedLimit =
      dashboardConfig[relationshipType]?.proposedLimit ??
      DEFAULT_COPAY_DASHBOARD_CONFIG[relationshipType].proposedLimit;

    const copayExisting = calculateWorkbookExistingCopay(
      incurredAmount,
      relationshipType,
      existingCopayGrossUpConfig,
    );
    const copayNewSuggested = incurredAmount * proposedLimit;

    warnings.push(...rowWarnings);

    return {
      rowNumber,
      sumInsured,
      relationship,
      relationshipGroup,
      age,
      claimedAmount,
      incurredAmount,
      claimType,
      admissionType,
      claimStatus,
      settlementStatus,
      icdCode,
      ailment,
      procedureType,
      procedureLimit,
      grade,
      policyNumber,
      clientName,
      riskStartDate: rawRow.riskStartDate ?? "",
      riskEndDate: rawRow.riskEndDate ?? "",
      employeeCode,
      copayExisting,
      copayNewSuggested,
      relationshipType,
      warnings: rowWarnings,
    };
  });

  return { rows, warnings };
}

export function calculateCopayDashboard(
  calculatedRows,
  dashboardConfig = DEFAULT_COPAY_DASHBOARD_CONFIG,
) {
  const relationshipTypes = ["ESC", "Parent"];

  const rows = relationshipTypes.map((relationshipType) => {
    const existingLimit =
      dashboardConfig[relationshipType]?.existingLimit ??
      DEFAULT_COPAY_DASHBOARD_CONFIG[relationshipType].existingLimit;
    const proposedLimit =
      dashboardConfig[relationshipType]?.proposedLimit ??
      DEFAULT_COPAY_DASHBOARD_CONFIG[relationshipType].proposedLimit;

    const proposedLimitIncrease =
      existingLimit === 0 ? "-" : proposedLimit / existingLimit - 1;

    const totalImpact = calculatedRows
      .filter((row) => row.relationshipType === relationshipType)
      .reduce((sum, row) => sum + row.copayNewSuggested, 0);

    return {
      relationshipType,
      existingLimit,
      proposedLimitIncrease,
      proposedLimit,
      totalImpact,
    };
  });

  const grandTotalImpact = rows.reduce(
    (sum, row) => sum + row.totalImpact,
    0,
  );

  return {
    rows,
    grandTotalImpact,
  };
}

export function calculateCopayWorkbook({
  claimRows,
  beneficiaryTypeRows,
  icdRows,
  dashboardConfig = DEFAULT_COPAY_DASHBOARD_CONFIG,
  existingCopayGrossUpConfig = DEFAULT_EXISTING_COPAY_GROSS_UP_CONFIG,
}) {
  const beneficiaryTypeMap = buildBeneficiaryTypeMap(beneficiaryTypeRows);
  const icdAilmentMap = buildIcdAilmentMap(icdRows);
  const rowCalculation = calculateCopayRows(
    claimRows,
    beneficiaryTypeMap,
    icdAilmentMap,
    dashboardConfig,
    existingCopayGrossUpConfig,
  );
  const dashboard = calculateCopayDashboard(
    rowCalculation.rows,
    dashboardConfig,
  );

  return {
    rows: rowCalculation.rows,
    warnings: rowCalculation.warnings,
    dashboard,
  };
}

export function calculateMaternityRows(
  rawClaimRows,
  dashboardConfig = DEFAULT_MATERNITY_DASHBOARD_CONFIG,
) {
  const warnings = [];
  const groupedRows = new Map();

  rawClaimRows.forEach((rawRow) => {
    const rowWarnings = [];
    const rowNumber = rawRow.__rowNumber ?? null;
    const employeeCode = normalizeText(rawRow.employeeCode);
    const procedureType = normalizeText(rawRow.procedureType);
    const settlementStatus = normalizeText(rawRow.settlementStatus);
    const ailment = normalizeText(rawRow.ailment);
    const normalizedProcedureType =
      normalizeMaternityProcedureType(procedureType);
    const isSettled = normalizeKey(settlementStatus) === "settled";
    const includeRow =
      isSettled &&
      (ailment
        ? isMaternityAilment(ailment)
        : Boolean(normalizedProcedureType));

    if (!includeRow) {
      return;
    }

    const claimedAmount = parseNumericField(
      rawRow.claimedAmount,
      "Claimed Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const incurredAmount = parseNumericField(
      rawRow.incurredAmount,
      "Incurred Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const procedureLimit = parseNumericField(
      rawRow.procedureLimit,
      "Procedure Limit",
      rowWarnings,
      rowNumber,
      employeeCode,
    );

    const outputProcedureType = normalizedProcedureType || procedureType;

    if (!normalizedProcedureType) {
      rowWarnings.push(
        makeWarning(
          rowNumber,
          employeeCode,
          "procedureType",
          "Unsupported maternity procedure type. Proposed limit is 0 and dashboard totals ignore this row.",
        ),
      );
    }

    const groupKey = [
      employeeCode,
      outputProcedureType,
      procedureLimit,
    ].join("||");

    if (!groupedRows.has(groupKey)) {
      groupedRows.set(groupKey, {
        employeeCode,
        procedureType: outputProcedureType,
        procedureLimit,
        claimedAmount: 0,
        incurredAmount: 0,
      });
    }

    const group = groupedRows.get(groupKey);
    group.claimedAmount += claimedAmount;
    group.incurredAmount += incurredAmount;

    warnings.push(...rowWarnings);
  });

  const rows = Array.from(groupedRows.values())
    .map((group) => {
      const proposedLimit = calculateMaternityProposedLimit(
        group.procedureType,
        dashboardConfig,
      );
      const difference = calculateMaternityDifference({
        procedureLimit: group.procedureLimit,
        claimedAmount: group.claimedAmount,
        incurredAmount: group.incurredAmount,
        proposedLimit,
      });

      return {
        employeeCode: group.employeeCode,
        procedureType: group.procedureType,
        procedureLimit: group.procedureLimit,
        claimedAmount: group.claimedAmount,
        incurredAmount: group.incurredAmount,
        proposedLimit,
        difference,
      };
    })
    .sort((left, right) => {
      const employeeCompare = left.employeeCode.localeCompare(
        right.employeeCode,
      );
      if (employeeCompare !== 0) return employeeCompare;

      const procedureCompare = left.procedureType.localeCompare(
        right.procedureType,
      );
      if (procedureCompare !== 0) return procedureCompare;

      return left.procedureLimit - right.procedureLimit;
    });

  return { rows, warnings };
}

export function calculateMaternityDashboard(
  calculatedRows,
  dashboardConfig = DEFAULT_MATERNITY_DASHBOARD_CONFIG,
) {
  const procedureTypes = ["Normal", "C-section"];

  const rows = procedureTypes.map((procedureType) => {
    const existingLimit =
      dashboardConfig?.[procedureType]?.existingLimit ??
      DEFAULT_MATERNITY_DASHBOARD_CONFIG[procedureType].existingLimit;
    const proposedLimit =
      dashboardConfig?.[procedureType]?.proposedLimit ??
      DEFAULT_MATERNITY_DASHBOARD_CONFIG[procedureType].proposedLimit;

    const proposedLimitIncrease =
      existingLimit === 0 ? "-" : proposedLimit / existingLimit - 1;

    const totalImpact = calculatedRows
      .filter((row) => row.procedureType === procedureType)
      .reduce((sum, row) => sum + row.difference, 0);

    return {
      procedureType,
      existingLimit,
      proposedLimitIncrease,
      proposedLimit,
      totalImpact,
    };
  });

  const grandTotalImpact = rows.reduce(
    (sum, row) => sum + row.totalImpact,
    0,
  );

  return {
    rows,
    grandTotalImpact,
  };
}

export function calculateMaternityWorkbook({
  claimRows,
  dashboardConfig = DEFAULT_MATERNITY_DASHBOARD_CONFIG,
}) {
  const rowCalculation = calculateMaternityRows(claimRows, dashboardConfig);
  const dashboard = calculateMaternityDashboard(
    rowCalculation.rows,
    dashboardConfig,
  );

  return {
    rows: rowCalculation.rows,
    warnings: rowCalculation.warnings,
    dashboard,
  };
}

export function calculateRoomRentRows(
  rawClaimRows,
  dashboardConfig = DEFAULT_ROOM_RENT_DASHBOARD_CONFIG,
) {
  const warnings = [];

  const rows = rawClaimRows.flatMap((rawRow) => {
    const rowWarnings = [];
    const rowNumber = rawRow.__rowNumber ?? null;
    const employeeCode = normalizeText(rawRow.employeeCode);
    const settlementStatus = normalizeText(rawRow.settlementStatus);

    if (normalizeKey(settlementStatus) !== "settled") {
      return [];
    }

    const sumInsured = parseNumericField(
      rawRow.sumInsured,
      "Sum Insured",
      rowWarnings,
      rowNumber,
      employeeCode,
    );

    const roomCategoryInput = normalizeText(rawRow.roomCategory);
    const icuFlagInput = normalizeText(rawRow.icuFlag);
    const roomCategory =
      normalizeRoomRentCategory(roomCategoryInput, icuFlagInput) ||
      roomCategoryInput ||
      icuFlagInput ||
      "Unknown";
    const recognizedRoomCategory = roomCategory === "Normal" || roomCategory === "ICU";

    if (!recognizedRoomCategory) {
      rowWarnings.push(
        makeWarning(
          rowNumber,
          employeeCode,
          "roomCategory",
          "Room category is not recognized as Normal or ICU. Impact is set to 0 for this row.",
        ),
      );
    }

    const roomRentAmount = parseOptionalNumericField(
      rawRow.roomRentAmount,
      "Room Rent Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const roomRentPerDay = parseOptionalNumericField(
      rawRow.roomRentPerDay,
      "Room Rent Per Day",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const roomDays = parseOptionalNumericField(
      rawRow.roomDays,
      "Room Days",
      rowWarnings,
      rowNumber,
      employeeCode,
    );

    let actualRoomRent = 0;

    if (roomRentAmount > 0) {
      actualRoomRent = roomRentAmount;
    } else if (roomRentPerDay > 0) {
      const normalizedRoomDays = roomDays > 0 ? roomDays : 1;

      if (roomDays <= 0) {
        rowWarnings.push(
          makeWarning(
            rowNumber,
            employeeCode,
            "roomDays",
            "Room Days is missing. Assumed 1 day for room rent impact.",
          ),
        );
      }

      actualRoomRent = roomRentPerDay * normalizedRoomDays;
    } else {
      rowWarnings.push(
        makeWarning(
          rowNumber,
          employeeCode,
          "roomRentAmount",
          "Room Rent Amount or Room Rent Per Day is required. Used 0.",
        ),
      );
    }

    const rateConfig = recognizedRoomCategory
      ? getRoomRentRateConfig(roomCategory, dashboardConfig)
      : { existingLimit: 0, proposedLimit: 0 };
    const { dayMultiplier, existingLimitAmount, proposedLimitAmount } =
      calculateRoomRentLimits(sumInsured, roomDays, rateConfig);
    const existingPayable = Math.min(actualRoomRent, existingLimitAmount);
    const proposedPayable = Math.min(actualRoomRent, proposedLimitAmount);
    const impact = proposedPayable - existingPayable;

    warnings.push(...rowWarnings);

    return [
      {
        rowNumber,
        employeeCode,
        settlementStatus,
        roomCategory,
        sumInsured,
        roomDays,
        roomRentPerDay,
        roomRentAmount,
        actualRoomRent,
        dayMultiplier,
        existingLimit: rateConfig.existingLimit ?? 0,
        proposedLimit: rateConfig.proposedLimit ?? 0,
        existingLimitAmount,
        proposedLimitAmount,
        existingPayable,
        proposedPayable,
        impact,
        warnings: rowWarnings,
      },
    ];
  });

  return { rows, warnings };
}

export function calculateRoomRentDashboard(
  calculatedRows,
  dashboardConfig = DEFAULT_ROOM_RENT_DASHBOARD_CONFIG,
) {
  const roomCategories = ["Normal", "ICU"];

  const rows = roomCategories.map((roomCategory) => {
    const existingLimit =
      dashboardConfig?.[roomCategory]?.existingLimit ??
      DEFAULT_ROOM_RENT_DASHBOARD_CONFIG[roomCategory].existingLimit;
    const proposedLimit =
      dashboardConfig?.[roomCategory]?.proposedLimit ??
      DEFAULT_ROOM_RENT_DASHBOARD_CONFIG[roomCategory].proposedLimit;

    const proposedLimitIncrease =
      existingLimit === 0 ? "-" : proposedLimit / existingLimit - 1;

    const totalImpact = calculatedRows
      .filter((row) => row.roomCategory === roomCategory)
      .reduce((sum, row) => sum + row.impact, 0);

    return {
      roomCategory,
      existingLimit,
      proposedLimitIncrease,
      proposedLimit,
      totalImpact,
    };
  });

  const grandTotalImpact = rows.reduce(
    (sum, row) => sum + row.totalImpact,
    0,
  );

  return {
    rows,
    grandTotalImpact,
  };
}

export function calculateRoomRentWorkbook({
  claimRows,
  dashboardConfig = DEFAULT_ROOM_RENT_DASHBOARD_CONFIG,
}) {
  const rowCalculation = calculateRoomRentRows(claimRows, dashboardConfig);
  const dashboard = calculateRoomRentDashboard(
    rowCalculation.rows,
    dashboardConfig,
  );

  return {
    rows: rowCalculation.rows,
    warnings: rowCalculation.warnings,
    dashboard,
  };
}

export function calculateCappedAilmentRows(
  rawClaimRows,
  dashboardConfig = DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
) {
  const warnings = [];
  const groupedRows = new Map();

  rawClaimRows.forEach((rawRow) => {
    const rowWarnings = [];
    const rowNumber = rawRow.__rowNumber ?? null;
    const employeeCode = normalizeText(rawRow.employeeCode);
    const settlementStatus = normalizeText(rawRow.settlementStatus);

    if (normalizeKey(settlementStatus) !== "settled") {
      return;
    }

    const canonicalProcedureType = normalizeCappedAilmentType(
      rawRow.procedureType,
      rawRow.ailment,
    );

    if (!canonicalProcedureType) {
      return;
    }

    const existingLimit = parseNumericField(
      rawRow.procedureLimit,
      "Procedure Limit",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const claimedAmount = parseNumericField(
      rawRow.claimedAmount,
      "Claimed Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );
    const incurredAmount = parseNumericField(
      rawRow.incurredAmount,
      "Incurred Amount",
      rowWarnings,
      rowNumber,
      employeeCode,
    );

    const groupKey = [
      employeeCode,
      canonicalProcedureType,
      existingLimit,
    ].join("||");

    if (!groupedRows.has(groupKey)) {
      groupedRows.set(groupKey, {
        employeeCode,
        procedureType: canonicalProcedureType,
        existingLimit,
        sumClaimedAmount: 0,
        sumIncurredAmount: 0,
      });
    }

    const group = groupedRows.get(groupKey);
    group.sumClaimedAmount += claimedAmount;
    group.sumIncurredAmount += incurredAmount;

    warnings.push(...rowWarnings);
  });

  const rows = Array.from(groupedRows.values())
    .map((group) => {
      const config = dashboardConfig?.[group.procedureType] ??
        DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG[group.procedureType] ?? {
          existingLimit: 0,
          proposedLimit: 0,
        };

      let proposedLimit = Number(config.proposedLimit || 0);
      let difference = 0;

      if (group.procedureType === "Psychiatric") {
        proposedLimit = group.sumIncurredAmount;
        difference = group.sumIncurredAmount;
      } else if (
        Number(config.existingLimit || 0) === 0 &&
        Number(config.proposedLimit || 0) === 0
      ) {
        difference = 0;
      } else {
        difference = calculateCappedAilmentDifference(
          group.existingLimit,
          group.sumClaimedAmount,
          group.sumIncurredAmount,
          proposedLimit,
        );
      }

      return {
        employeeCode: group.employeeCode,
        procedureType: group.procedureType,
        existingLimit: group.existingLimit,
        sumClaimedAmount: group.sumClaimedAmount,
        sumIncurredAmount: group.sumIncurredAmount,
        proposedLimit,
        difference,
      };
    })
    .sort((left, right) => {
      const employeeCompare = left.employeeCode.localeCompare(
        right.employeeCode,
      );
      if (employeeCompare !== 0) return employeeCompare;

      const procedureCompare = left.procedureType.localeCompare(
        right.procedureType,
      );
      if (procedureCompare !== 0) return procedureCompare;

      return left.existingLimit - right.existingLimit;
    });

  return { rows, warnings };
}

export function calculateCappedAilmentDashboard(
  calculatedRows,
  dashboardConfig = DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
) {
  const procedureTypes = Object.keys(DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG);

  const rows = procedureTypes.map((procedureType) => {
    const existingLimit =
      dashboardConfig?.[procedureType]?.existingLimit ??
      DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG[procedureType].existingLimit;
    const proposedLimit =
      dashboardConfig?.[procedureType]?.proposedLimit ??
      DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG[procedureType].proposedLimit;

    const proposedLimitIncrease =
      existingLimit === 0 ? "-" : proposedLimit / existingLimit - 1;

    const totalImpact = calculatedRows
      .filter((row) => row.procedureType === procedureType)
      .reduce((sum, row) => sum + row.difference, 0);

    return {
      procedureType,
      existingLimit,
      proposedLimitIncrease,
      proposedLimit,
      totalImpact,
    };
  });

  const grandTotalImpact = rows.reduce(
    (sum, row) => sum + row.totalImpact,
    0,
  );

  return {
    rows,
    grandTotalImpact,
  };
}

export function calculateCappedAilmentWorkbook({
  claimRows,
  dashboardConfig = DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
}) {
  const rowCalculation = calculateCappedAilmentRows(
    claimRows,
    dashboardConfig,
  );
  const dashboard = calculateCappedAilmentDashboard(
    rowCalculation.rows,
    dashboardConfig,
  );

  return {
    rows: rowCalculation.rows,
    warnings: rowCalculation.warnings,
    dashboard,
  };
}

export function calculate(rows, headers, mapping, statusFilter, proposedLimit) {
  return calculateSumInsured(
    rows,
    headers,
    mapping,
    statusFilter,
    proposedLimit,
  );
}

function buildIndex(headers, mapping) {
  const index = {};

  Object.keys(mapping || {}).forEach((column) => {
    index[column] = headers.indexOf(mapping[column]);
  });

  return index;
}

function getCell(row, index, fallback = "") {
  if (typeof index !== "number" || index < 0 || index >= row.length) {
    return fallback;
  }
  return row[index];
}

function parseNumericField(value, label, warnings, rowNumber, employeeCode) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    warnings.push(
      makeWarning(
        rowNumber,
        employeeCode,
        label,
        `${label} is blank or invalid. Used 0.`,
      ),
    );
    return 0;
  }

  const cleaned = normalized.replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    warnings.push(
      makeWarning(
        rowNumber,
        employeeCode,
        label,
        `${label} is blank or invalid. Used 0.`,
      ),
    );
    return 0;
  }

  return parsed;
}

function parseOptionalNumericField(
  value,
  label,
  warnings,
  rowNumber,
  employeeCode,
) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return 0;
  }

  const cleaned = normalized.replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    warnings.push(
      makeWarning(
        rowNumber,
        employeeCode,
        label,
        `${label} is invalid. Used 0.`,
      ),
    );
    return 0;
  }

  return parsed;
}

function makeWarning(rowNumber, employeeCode, field, message) {
  return {
    rowNumber,
    employeeCode,
    field,
    message,
  };
}
