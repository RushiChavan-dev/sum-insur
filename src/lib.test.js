import { describe, expect, it } from "vitest";
import {
  DEFAULT_COPAY_DASHBOARD_CONFIG,
  DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
  DEFAULT_MATERNITY_DASHBOARD_CONFIG,
  DEFAULT_ROOM_RENT_DASHBOARD_CONFIG,
  calculateCappedAilmentWorkbook,
  calculateCopayWorkbook,
  calculateMaternityWorkbook,
  calculateRoomRentWorkbook,
  calculateSumInsured,
  mapRowsToObjects,
  parseCSV,
  workbookSheetsToCSV,
} from "./lib";
import {
  COPAY_CLAIM_FIELD_DEFS,
  ICD_FIELD_DEFS,
  SUM_INSURED_FIELD_DEFS,
  buildDefaultMapping,
  getAutoMappedMissingRequiredFields,
  getRowValidationIssues,
  MATERNITY_FIELD_DEFS,
  ROOM_RENT_FIELD_DEFS,
  prepareRowsForFieldMapping,
} from "./headerMappings";
import { DEFAULT_ICD_LOOKUP_ROWS } from "./icdDefaults";

describe("parseCSV", () => {
  it("treats Excel-pasted tab-separated rows as TSV even when numbers contain commas", () => {
    const text = `Employee ID\tCurrent Sum Insured\tClaimed Amount\tIncurred Amount\tNew Proposed Sum Insured
722489\t500000\t771,001\t465,732\t300,000
729536\t500000\t969,782\t384,596\t300,000`;

    expect(parseCSV(text)).toEqual([
      [
        "Employee ID",
        "Current Sum Insured",
        "Claimed Amount",
        "Incurred Amount",
        "New Proposed Sum Insured",
      ],
      ["722489", "500000", "771,001", "465,732", "300,000"],
      ["729536", "500000", "969,782", "384,596", "300,000"],
    ]);
  });

  it("still parses quoted CSV values that contain commas", () => {
    const text = `Employee ID,Claimed Amount,Notes
722489,"771,001","Paid, reviewed"`;

    expect(parseCSV(text)).toEqual([
      ["Employee ID", "Claimed Amount", "Notes"],
      ["722489", "771,001", "Paid, reviewed"],
    ]);
  });
});

describe("workbookSheetsToCSV", () => {
  it("serializes the first populated sheet for direct xlsx uploads", () => {
    const text = workbookSheetsToCSV([
      { sheet: "Intro", data: [] },
      {
        sheet: "Claims",
        data: [
          ["Employee ID", "Claimed Amount", "Risk Start Date"],
          ["722489", 771001, new Date("2023-12-24T00:00:00.000Z")],
          ["729536", 969782, null],
        ],
      },
    ]);

    expect(parseCSV(text)).toEqual([
      ["Employee ID", "Claimed Amount", "Risk Start Date"],
      ["722489", "771001", "2023-12-24"],
      ["729536", "969782", ""],
    ]);
  });
});

describe("prepareRowsForFieldMapping", () => {
  it("finds a header row within the first 20 rows using shared aliases", () => {
    const rows = [
      ["Maternity claim dump"],
      ["Generated on", "2026-05-28"],
      [
        "employee_code",
        "Proc Type",
        "Proc Limit",
        "ARG Claimed Amount",
        "ARG Incurred Amount",
        "ARG Status1",
      ],
      ["EMP001", "C-Section", "100000", "169836", "100000", "Settled"],
    ];

    const prepared = prepareRowsForFieldMapping(rows, MATERNITY_FIELD_DEFS);

    expect(prepared.found).toBe(true);
    expect(prepared.headerRowIndex).toBe(2);
    expect(prepared.headers).toEqual(rows[2]);
    expect(prepared.rows).toEqual(rows.slice(2));
    expect(prepared.missingRequiredFields).toEqual([]);
  });

  it("reports missing required fields when no usable header row is found", () => {
    const rows = [
      ["Room rent analysis"],
      ["Prepared by operations"],
      ["foo", "bar", "baz"],
    ];

    const prepared = prepareRowsForFieldMapping(rows, ROOM_RENT_FIELD_DEFS);

    expect(prepared.found).toBe(false);
    expect(prepared.missingRequiredFields.map((field) => field.label)).toEqual([
      "Employee Code",
      "Sum Insured",
      "Settlement Status",
    ]);
  });
});

describe("shared header mappings", () => {
  it("maps sum insured workbook headers with employee_code and summed amount labels", () => {
    const headers = [
      "employee_code",
      "Sum Insured",
      "Sum of ARG Claimed Amount",
      "Sum of ARG Incurred Amount",
    ];

    const mapping = buildDefaultMapping(headers, SUM_INSURED_FIELD_DEFS);

    expect(mapping["Employee ID"]).toBe("employee_code");
    expect(mapping["Current Sum Insured"]).toBe("Sum Insured");
    expect(mapping["Claimed Amount"]).toBe("Sum of ARG Claimed Amount");
    expect(mapping["Incurred Amount"]).toBe("Sum of ARG Incurred Amount");
    expect(mapping["Claim Status"]).toBe("");
  });

  it("maps the copay workbook headers you provided without missing required fields", () => {
    const headers = [
      "Sum Insured",
      "ARG Relation",
      "ARG Relation Group1",
      "ARG Age",
      "ARG Claimed Amount",
      "ARG Incurred Amount",
      "ARG Claim Type",
      "IPD/OPD",
      "ARG Status",
      "ARG Status1",
      "ARG ICD",
      "ARG Ailment",
      "Proc Type",
      "Proc Limit",
      "Grade",
      "policy_no",
      "mph_name",
      "risk_inc_date",
      "risk_exp_date",
      "employee_code",
      "Co-pay Existing",
      "Copay New Sugg",
      "Rel Type",
    ];

    const missingRequiredFields = getAutoMappedMissingRequiredFields(
      headers,
      COPAY_CLAIM_FIELD_DEFS,
    );

    expect(missingRequiredFields).toEqual([]);
  });

  it("maps ICD start code dimension headers after a title row", () => {
    const rows = [
      ["ICD10 Start Code Dimension List"],
      [
        "ICD Start Code",
        "ICD Start Code Classification",
        "Group Diagnosis1",
        "Group Diagnosis2",
      ],
      [
        "H25",
        "Diseases of the eye and adnexa",
        "Eye",
        "Senile cataract",
      ],
    ];

    const prepared = prepareRowsForFieldMapping(rows, ICD_FIELD_DEFS);
    const mapping = buildDefaultMapping(prepared.headers, ICD_FIELD_DEFS);

    expect(prepared.found).toBe(true);
    expect(prepared.headerRowIndex).toBe(1);
    expect(prepared.missingRequiredFields).toEqual([]);
    expect(mapping.icdPrefix).toBe("ICD Start Code");
    expect(mapping.category).toBe("ICD Start Code Classification");
    expect(mapping.ailment).toBe("Group Diagnosis1");
  });

  it("flags incomplete or unexpected rows in the editable preview", () => {
    const headers = [
      "employee_code",
      "Sum Insured",
      "Sum of ARG Claimed Amount",
      "Sum of ARG Incurred Amount",
    ];
    const mapping = buildDefaultMapping(headers, SUM_INSURED_FIELD_DEFS);

    expect(
      getRowValidationIssues(
        ["EMP001", "500000", "700000", ""],
        headers,
        SUM_INSURED_FIELD_DEFS,
        mapping,
      ),
    ).toContain("Incurred Amount is missing");

    expect(
      getRowValidationIssues(
        ["EMP001", "five lakh", "700000", "450000", "extra value"],
        headers,
        SUM_INSURED_FIELD_DEFS,
        mapping,
      ),
    ).toEqual(
      expect.arrayContaining([
        "Current Sum Insured should be numeric",
        "Unexpected extra values found in the row",
      ]),
    );
  });
});

describe("calculateSumInsured", () => {
  it("calculates expected impact for sample", () => {
    const text = `Employee ID,Claim Status,Current Sum Insured,Claimed Amount,Incurred Amount
722489,Settled,500000,771001,465732`;
    const rows = parseCSV(text);
    const headers = rows[0];
    const mapping = {
      "Employee ID": "Employee ID",
      "Claim Status": "Claim Status",
      "Current Sum Insured": "Current Sum Insured",
      "Claimed Amount": "Claimed Amount",
      "Incurred Amount": "Incurred Amount",
    };

    const { grandTotal, rows: parsed } = calculateSumInsured(
      rows,
      headers,
      mapping,
      "Settled",
      300000,
    );

    expect(parsed.length).toBe(1);
    expect(grandTotal).toBe(-165732);
  });
});

describe("DEFAULT_ICD_LOOKUP_ROWS", () => {
  it("covers representative ICD prefixes from the built-in master list", () => {
    const lookup = new Map(
      DEFAULT_ICD_LOOKUP_ROWS.map((row) => [row.icdPrefix, row]),
    );

    expect(lookup.get("A00")?.ailment).toBe("Infectious");
    expect(lookup.get("H25")?.ailment).toBe("Eye");
    expect(lookup.get("H99")?.ailment).toBe("Ear & Mastoid");
    expect(lookup.get("O82")?.ailment).toBe("Maternity");
    expect(lookup.get("S22")?.ailment).toBe("Accident / Injury");
    expect(lookup.get("U07")?.ailment).toBe("Covid-19");
    expect(lookup.get("Z99")?.ailment).toBe("Factors influencing health status");
  });
});

describe("calculateCopayWorkbook", () => {
  it("applies relationship lookup, workbook formulas, and dashboard totals", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,Grade,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
500000,Self,34,771001,465732,Cashless,IPD,Settled,Settled,H25.011,Cataract,50000,M3,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000123
500000,Mother-In-Law,62,39000,38498,Reimbursement,IPD,Settled,Settled,H25.011,Cataract,50000,M3,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000124`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group1,Beneficiary Type Group2,Beneficiary Type Group
Self,ESC,Employee,Employee
Mother-In-Law,PARENTS,Parent,Parent IL`;
    const icdText = `ICD Prefix,Category,Ailment
H25,Ophthalmology,Eye`;

    const claimRows = parseCSV(claimText);
    const beneficiaryRows = parseCSV(beneficiaryText);
    const icdRows = parseCSV(icdText);

    const mappedClaims = mapRowsToObjects(
      claimRows,
      claimRows[0],
      {
        sumInsured: "Sum Insured",
        relationship: "ARG Relation",
        age: "ARG Age",
        claimedAmount: "ARG Claimed Amount",
        incurredAmount: "ARG Incurred Amount",
        claimType: "ARG Claim Type",
        admissionType: "IPD/OPD",
        claimStatus: "ARG Status",
        settlementStatus: "ARG Status1",
        icdCode: "ARG ICD",
        procedureType: "Proc Type",
        procedureLimit: "Proc Limit",
        grade: "Grade",
        policyNumber: "policy_no",
        clientName: "mph_name",
        riskStartDate: "risk_inc_date",
        riskEndDate: "risk_exp_date",
        employeeCode: "employee_code",
      },
      [
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
        "grade",
        "policyNumber",
        "clientName",
        "riskStartDate",
        "riskEndDate",
        "employeeCode",
      ],
    );

    const mappedBeneficiaries = mapRowsToObjects(
      beneficiaryRows,
      beneficiaryRows[0],
      {
        beneficiaryType: "Beneficiary Type",
        beneficiaryTypeGroup1: "Beneficiary Type Group1",
        beneficiaryTypeGroup2: "Beneficiary Type Group2",
        beneficiaryTypeGroup: "Beneficiary Type Group",
      },
      [
        "beneficiaryType",
        "beneficiaryTypeGroup1",
        "beneficiaryTypeGroup2",
        "beneficiaryTypeGroup",
      ],
    );

    const mappedIcd = mapRowsToObjects(
      icdRows,
      icdRows[0],
      {
        icdPrefix: "ICD Prefix",
        ailment: "Ailment",
      },
      ["icdPrefix", "ailment"],
    );

    const result = calculateCopayWorkbook({
      claimRows: mappedClaims,
      beneficiaryTypeRows: mappedBeneficiaries,
      icdRows: mappedIcd,
      dashboardConfig: DEFAULT_COPAY_DASHBOARD_CONFIG,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].relationshipGroup).toBe("Employee");
    expect(result.rows[0].relationshipType).toBe("ESC");
    expect(result.rows[0].copayExisting).toBeCloseTo(51748, 6);
    expect(result.rows[0].copayNewSuggested).toBeCloseTo(46573.2, 6);

    expect(result.rows[1].relationshipGroup).toBe("Parent");
    expect(result.rows[1].relationshipType).toBe("Parent");
    expect(result.rows[1].copayExisting).toBeCloseTo(9624.5, 6);
    expect(result.rows[1].copayNewSuggested).toBeCloseTo(4619.76, 6);

    expect(result.dashboard.rows[0].relationshipType).toBe("ESC");
    expect(result.dashboard.rows[0].proposedLimitIncrease).toBe(1);
    expect(result.dashboard.rows[1].proposedLimitIncrease).toBe("-");
    expect(result.dashboard.rows[1].totalImpact).toBeCloseTo(4619.76, 6);
    expect(result.dashboard.grandTotalImpact).toBeCloseTo(51192.96, 6);
    expect(result.warnings).toHaveLength(0);
  });

  it("matches full ICD codes against exact rows and broader prefixes", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
500000,Self,34,771001,465732,Cashless,IPD,Settled,Settled,H25.011,Cataract,50000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000123
500000,Mother,62,92015,80000,Cashless,IPD,Settled,Settled,K42.9,Hernia,40000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000124
500000,Father,58,605269,300000,Reimbursement,IPD,Settled,Settled,M17.12,TKR/THR,150000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000125
500000,Spouse,30,113860,80310,Cashless,IPD,Settled,Settled,O82.0,C-Section,100000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000126`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group2
Self,Employee
Mother,Parent
Father,Parent
Spouse,Spouse`;
    const icdText = `ICD Prefix,Category,Ailment
H25.011,Ophthalmology,Eye
K42,General Surgery,Digestive
M17,Orthopedics,Musculoskeletal
O82,Obstetrics,Maternity`;

    const claimRows = parseCSV(claimText);
    const beneficiaryRows = parseCSV(beneficiaryText);
    const icdRows = parseCSV(icdText);

    const result = calculateCopayWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          sumInsured: "Sum Insured",
          relationship: "ARG Relation",
          age: "ARG Age",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          claimType: "ARG Claim Type",
          admissionType: "IPD/OPD",
          claimStatus: "ARG Status",
          settlementStatus: "ARG Status1",
          icdCode: "ARG ICD",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          policyNumber: "policy_no",
          clientName: "mph_name",
          riskStartDate: "risk_inc_date",
          riskEndDate: "risk_exp_date",
          employeeCode: "employee_code",
        },
        [
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
        ],
      ),
      beneficiaryTypeRows: mapRowsToObjects(
        beneficiaryRows,
        beneficiaryRows[0],
        {
          beneficiaryType: "Beneficiary Type",
          beneficiaryTypeGroup2: "Beneficiary Type Group2",
        },
        ["beneficiaryType", "beneficiaryTypeGroup2"],
      ),
      icdRows: mapRowsToObjects(
        icdRows,
        icdRows[0],
        {
          icdPrefix: "ICD Prefix",
          ailment: "Ailment",
        },
        ["icdPrefix", "ailment"],
      ),
    });

    expect(result.rows.map((row) => row.ailment)).toEqual([
      "Eye",
      "Digestive",
      "Musculoskeletal",
      "Maternity",
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it("covers the built-in ICD master list across chapters when no custom ICD upload is provided", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
500000,Self,34,5000,4500,Cashless,IPD,Settled,Settled,A09.0,Consultation,0,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000123
500000,Self,34,771001,465732,Cashless,IPD,Settled,Settled,H25.011,Cataract,50000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000124
500000,Father,58,605269,300000,Reimbursement,IPD,Settled,Settled,I21.9,Treatment,0,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000125
500000,Spouse,30,113860,80310,Cashless,IPD,Settled,Settled,O82.0,C-Section,100000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000126
500000,Self,34,15000,15000,Cashless,IPD,Settled,Settled,U07.1,Isolation,0,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000127`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group2
Self,Employee
Father,Parent
Spouse,Spouse`;

    const claimRows = parseCSV(claimText);
    const beneficiaryRows = parseCSV(beneficiaryText);

    const result = calculateCopayWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          sumInsured: "Sum Insured",
          relationship: "ARG Relation",
          age: "ARG Age",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          claimType: "ARG Claim Type",
          admissionType: "IPD/OPD",
          claimStatus: "ARG Status",
          settlementStatus: "ARG Status1",
          icdCode: "ARG ICD",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          policyNumber: "policy_no",
          clientName: "mph_name",
          riskStartDate: "risk_inc_date",
          riskEndDate: "risk_exp_date",
          employeeCode: "employee_code",
        },
        [
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
        ],
      ),
      beneficiaryTypeRows: mapRowsToObjects(
        beneficiaryRows,
        beneficiaryRows[0],
        {
          beneficiaryType: "Beneficiary Type",
          beneficiaryTypeGroup2: "Beneficiary Type Group2",
        },
        ["beneficiaryType", "beneficiaryTypeGroup2"],
      ),
      icdRows: [],
    });

    expect(result.rows.map((row) => row.ailment)).toEqual([
      "Infectious",
      "Eye",
      "Circulatory",
      "Maternity",
      "Covid-19",
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it("lets uploaded ICD rows override the built-in ICD master list", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
500000,Self,34,771001,465732,Cashless,IPD,Settled,Settled,H25.011,Cataract,50000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000123`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group2
Self,Employee`;
    const icdText = `ICD Prefix,Category,Ailment
H25,Custom Eye Group,Vision Override`;

    const result = calculateCopayWorkbook({
      claimRows: mapRowsToObjects(
        parseCSV(claimText),
        parseCSV(claimText)[0],
        {
          sumInsured: "Sum Insured",
          relationship: "ARG Relation",
          age: "ARG Age",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          claimType: "ARG Claim Type",
          admissionType: "IPD/OPD",
          claimStatus: "ARG Status",
          settlementStatus: "ARG Status1",
          icdCode: "ARG ICD",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          policyNumber: "policy_no",
          clientName: "mph_name",
          riskStartDate: "risk_inc_date",
          riskEndDate: "risk_exp_date",
          employeeCode: "employee_code",
        },
        [
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
        ],
      ),
      beneficiaryTypeRows: mapRowsToObjects(
        parseCSV(beneficiaryText),
        parseCSV(beneficiaryText)[0],
        {
          beneficiaryType: "Beneficiary Type",
          beneficiaryTypeGroup2: "Beneficiary Type Group2",
        },
        ["beneficiaryType", "beneficiaryTypeGroup2"],
      ),
      icdRows: mapRowsToObjects(
        parseCSV(icdText),
        parseCSV(icdText)[0],
        {
          icdPrefix: "ICD Prefix",
          category: "Category",
          ailment: "Ailment",
        },
        ["icdPrefix", "category", "ailment"],
      ),
    });

    expect(result.rows[0].ailment).toBe("Vision Override");
    expect(result.warnings).toHaveLength(0);
  });

  it("creates row-level warnings for missing lookups and invalid numerics", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
bad,Unknown,abc,,foo,Cashless,IPD,Settled,Settled,U99.999,Cataract,,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000126`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group2
Self,Employee`;
    const icdText = `ICD Prefix,Ailment
H25,Eye`;

    const claimRows = parseCSV(claimText);
    const beneficiaryRows = parseCSV(beneficiaryText);
    const icdRows = parseCSV(icdText);

    const mappedClaims = mapRowsToObjects(
      claimRows,
      claimRows[0],
      {
        sumInsured: "Sum Insured",
        relationship: "ARG Relation",
        age: "ARG Age",
        claimedAmount: "ARG Claimed Amount",
        incurredAmount: "ARG Incurred Amount",
        claimType: "ARG Claim Type",
        admissionType: "IPD/OPD",
        claimStatus: "ARG Status",
        settlementStatus: "ARG Status1",
        icdCode: "ARG ICD",
        procedureType: "Proc Type",
        procedureLimit: "Proc Limit",
        policyNumber: "policy_no",
        clientName: "mph_name",
        riskStartDate: "risk_inc_date",
        riskEndDate: "risk_exp_date",
        employeeCode: "employee_code",
      },
      [
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
      ],
    );

    const mappedBeneficiaries = mapRowsToObjects(
      beneficiaryRows,
      beneficiaryRows[0],
      {
        beneficiaryType: "Beneficiary Type",
        beneficiaryTypeGroup2: "Beneficiary Type Group2",
      },
      ["beneficiaryType", "beneficiaryTypeGroup2"],
    );

    const mappedIcd = mapRowsToObjects(
      icdRows,
      icdRows[0],
      {
        icdPrefix: "ICD Prefix",
        ailment: "Ailment",
      },
      ["icdPrefix", "ailment"],
    );

    const result = calculateCopayWorkbook({
      claimRows: mappedClaims,
      beneficiaryTypeRows: mappedBeneficiaries,
      icdRows: mappedIcd,
    });

    expect(result.rows[0].relationshipType).toBe("ESC");
    expect(result.rows[0].copayExisting).toBe(0);
    expect(result.rows[0].copayNewSuggested).toBe(0);
    expect(result.warnings.some((warning) => warning.message.includes("Relationship not found"))).toBe(true);
    expect(result.warnings.some((warning) => warning.message.includes("ICD code not found"))).toBe(true);
    expect(result.warnings.some((warning) => warning.message.includes("Used 0"))).toBe(true);
  });

  it("treats relationship group parent values case-insensitively", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
500000,Mother-In-Law,62,39000,38498,Reimbursement,IPD,Settled,Settled,H25.011,Cataract,50000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000124`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group2
Mother-In-Law,parent`;
    const icdText = `ICD Prefix,Ailment
H25,Eye`;

    const result = calculateCopayWorkbook({
      claimRows: mapRowsToObjects(
        parseCSV(claimText),
        parseCSV(claimText)[0],
        {
          sumInsured: "Sum Insured",
          relationship: "ARG Relation",
          age: "ARG Age",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          claimType: "ARG Claim Type",
          admissionType: "IPD/OPD",
          claimStatus: "ARG Status",
          settlementStatus: "ARG Status1",
          icdCode: "ARG ICD",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          policyNumber: "policy_no",
          clientName: "mph_name",
          riskStartDate: "risk_inc_date",
          riskEndDate: "risk_exp_date",
          employeeCode: "employee_code",
        },
        [
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
        ],
      ),
      beneficiaryTypeRows: mapRowsToObjects(
        parseCSV(beneficiaryText),
        parseCSV(beneficiaryText)[0],
        {
          beneficiaryType: "Beneficiary Type",
          beneficiaryTypeGroup2: "Beneficiary Type Group2",
        },
        ["beneficiaryType", "beneficiaryTypeGroup2"],
      ),
      icdRows: mapRowsToObjects(
        parseCSV(icdText),
        parseCSV(icdText)[0],
        {
          icdPrefix: "ICD Prefix",
          ailment: "Ailment",
        },
        ["icdPrefix", "ailment"],
      ),
    });

    expect(result.rows[0].relationshipType).toBe("Parent");
    expect(result.rows[0].copayExisting).toBeCloseTo(9624.5, 6);
    expect(result.rows[0].copayNewSuggested).toBeCloseTo(4619.76, 6);
  });

  it("falls back to the matching default gross-up formula for each relationship type", () => {
    const claimText = `Sum Insured,ARG Relation,ARG Age,ARG Claimed Amount,ARG Incurred Amount,ARG Claim Type,IPD/OPD,ARG Status,ARG Status1,ARG ICD,Proc Type,Proc Limit,policy_no,mph_name,risk_inc_date,risk_exp_date,employee_code
500000,Self,34,771001,465732,Cashless,IPD,Settled,Settled,H25.011,Cataract,50000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000123
500000,Mother-In-Law,62,39000,38498,Reimbursement,IPD,Settled,Settled,H25.011,Cataract,50000,POL001,Acme Ltd,24-Dec-23,23-Dec-24,000124`;
    const beneficiaryText = `Beneficiary Type,Beneficiary Type Group2
Self,Employee
Mother-In-Law,Parent`;
    const icdText = `ICD Prefix,Ailment
H25,Eye`;

    const claimRows = parseCSV(claimText);
    const beneficiaryRows = parseCSV(beneficiaryText);
    const icdRows = parseCSV(icdText);

    const result = calculateCopayWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          sumInsured: "Sum Insured",
          relationship: "ARG Relation",
          age: "ARG Age",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          claimType: "ARG Claim Type",
          admissionType: "IPD/OPD",
          claimStatus: "ARG Status",
          settlementStatus: "ARG Status1",
          icdCode: "ARG ICD",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          policyNumber: "policy_no",
          clientName: "mph_name",
          riskStartDate: "risk_inc_date",
          riskEndDate: "risk_exp_date",
          employeeCode: "employee_code",
        },
        [
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
        ],
      ),
      beneficiaryTypeRows: mapRowsToObjects(
        beneficiaryRows,
        beneficiaryRows[0],
        {
          beneficiaryType: "Beneficiary Type",
          beneficiaryTypeGroup2: "Beneficiary Type Group2",
        },
        ["beneficiaryType", "beneficiaryTypeGroup2"],
      ),
      icdRows: mapRowsToObjects(
        icdRows,
        icdRows[0],
        {
          icdPrefix: "ICD Prefix",
          ailment: "Ailment",
        },
        ["icdPrefix", "ailment"],
      ),
      existingCopayGrossUpConfig: {
        ESC: {
          basePercent: 90,
          copayPercent: 10,
        },
      },
    });

    expect(result.rows[0].relationshipType).toBe("ESC");
    expect(result.rows[0].copayExisting).toBeCloseTo(51748, 6);
    expect(result.rows[1].relationshipType).toBe("Parent");
    expect(result.rows[1].copayExisting).toBeCloseTo(9624.5, 6);
  });
});

describe("calculateMaternityWorkbook", () => {
  it("filters settled maternity claims, groups them, and applies workbook formulas", () => {
    const claimText = `employee_code,Proc Type,Proc Limit,ARG Claimed Amount,ARG Incurred Amount,ARG Status1,ARG Ailment
EMP001,C-Section,100000,169836,100000,Settled,Maternity
EMP001,C-section,100000,10000,5000,Settled,Maternity
EMP002,Normal,100000,120028,100000,Settled,Maternity
EMP003,Normal,100000,85000,80000,Settled,Maternity
EMP004,C section,100000,169836,100000,Pending,Maternity
EMP005,C-section,100000,169836,100000,Settled,Eye
EMP006,C section,100000,169836,100000,Settled,`;

    const claimRows = parseCSV(claimText);

    const result = calculateMaternityWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          employeeCode: "employee_code",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          settlementStatus: "ARG Status1",
          ailment: "ARG Ailment",
        },
        [
          "employeeCode",
          "procedureType",
          "procedureLimit",
          "claimedAmount",
          "incurredAmount",
          "settlementStatus",
          "ailment",
        ],
      ),
      dashboardConfig: DEFAULT_MATERNITY_DASHBOARD_CONFIG,
    });

    expect(result.rows).toHaveLength(4);

    expect(result.rows[0].employeeCode).toBe("EMP001");
    expect(result.rows[0].procedureType).toBe("C-section");
    expect(result.rows[0].claimedAmount).toBe(179836);
    expect(result.rows[0].incurredAmount).toBe(105000);
    expect(result.rows[0].proposedLimit).toBe(125000);
    expect(result.rows[0].difference).toBe(25000);

    expect(result.rows[1].employeeCode).toBe("EMP002");
    expect(result.rows[1].procedureType).toBe("Normal");
    expect(result.rows[1].difference).toBe(-25000);

    expect(result.rows[2].employeeCode).toBe("EMP003");
    expect(result.rows[2].procedureType).toBe("Normal");
    expect(result.rows[2].difference).toBe(-5000);

    expect(result.rows[3].employeeCode).toBe("EMP006");
    expect(result.rows[3].procedureType).toBe("C-section");
    expect(result.rows[3].difference).toBe(25000);

    expect(result.dashboard.rows[0].procedureType).toBe("Normal");
    expect(result.dashboard.rows[0].proposedLimitIncrease).toBe(-0.25);
    expect(result.dashboard.rows[0].totalImpact).toBe(-30000);

    expect(result.dashboard.rows[1].procedureType).toBe("C-section");
    expect(result.dashboard.rows[1].proposedLimitIncrease).toBe(0.25);
    expect(result.dashboard.rows[1].totalImpact).toBe(50000);

    expect(result.dashboard.grandTotalImpact).toBe(20000);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on unsupported maternity procedure types and excludes them from dashboard totals", () => {
    const claimText = `employee_code,Proc Type,Proc Limit,ARG Claimed Amount,ARG Incurred Amount,ARG Status1,ARG Ailment
EMP010,Special Delivery,100000,150000,100000,Settled,Maternity`;

    const claimRows = parseCSV(claimText);

    const result = calculateMaternityWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          employeeCode: "employee_code",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          settlementStatus: "ARG Status1",
          ailment: "ARG Ailment",
        },
        [
          "employeeCode",
          "procedureType",
          "procedureLimit",
          "claimedAmount",
          "incurredAmount",
          "settlementStatus",
          "ailment",
        ],
      ),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].procedureType).toBe("Special Delivery");
    expect(result.rows[0].proposedLimit).toBe(0);
    expect(result.rows[0].difference).toBe(-100000);
    expect(result.dashboard.grandTotalImpact).toBe(0);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("Unsupported maternity procedure type"),
      ),
    ).toBe(true);
  });
});

describe("calculateRoomRentWorkbook", () => {
  it("calculates room rent impact for total-amount and per-day inputs", () => {
    const claimText = `employee_code,Sum Insured,ARG Status1,Room Category,Room Rent Amount,Room Rent Per Day,Room Days
EMP201,500000,Settled,Normal,20000,,
EMP202,500000,Settled,ICU,,15000,2
EMP203,500000,Pending,Normal,18000,,
EMP204,500000,Settled,ICU,18000,,1`;

    const claimRows = parseCSV(claimText);

    const result = calculateRoomRentWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          employeeCode: "employee_code",
          sumInsured: "Sum Insured",
          settlementStatus: "ARG Status1",
          roomCategory: "Room Category",
          roomRentAmount: "Room Rent Amount",
          roomRentPerDay: "Room Rent Per Day",
          roomDays: "Room Days",
        },
        [
          "employeeCode",
          "sumInsured",
          "settlementStatus",
          "roomCategory",
          "roomRentAmount",
          "roomRentPerDay",
          "roomDays",
        ],
      ),
      dashboardConfig: DEFAULT_ROOM_RENT_DASHBOARD_CONFIG,
    });

    expect(result.rows).toHaveLength(3);

    expect(result.rows[0].employeeCode).toBe("EMP201");
    expect(result.rows[0].roomCategory).toBe("Normal");
    expect(result.rows[0].actualRoomRent).toBe(20000);
    expect(result.rows[0].existingLimitAmount).toBe(5000);
    expect(result.rows[0].proposedLimitAmount).toBe(10000);
    expect(result.rows[0].impact).toBe(5000);

    expect(result.rows[1].employeeCode).toBe("EMP202");
    expect(result.rows[1].roomCategory).toBe("ICU");
    expect(result.rows[1].actualRoomRent).toBe(30000);
    expect(result.rows[1].existingLimitAmount).toBe(20000);
    expect(result.rows[1].proposedLimitAmount).toBe(40000);
    expect(result.rows[1].impact).toBe(10000);

    expect(result.rows[2].employeeCode).toBe("EMP204");
    expect(result.rows[2].impact).toBe(8000);

    expect(result.dashboard.rows[0].roomCategory).toBe("Normal");
    expect(result.dashboard.rows[0].proposedLimitIncrease).toBe(1);
    expect(result.dashboard.rows[0].totalImpact).toBe(5000);

    expect(result.dashboard.rows[1].roomCategory).toBe("ICU");
    expect(result.dashboard.rows[1].proposedLimitIncrease).toBe(1);
    expect(result.dashboard.rows[1].totalImpact).toBe(18000);

    expect(result.dashboard.grandTotalImpact).toBe(23000);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on unknown room category and missing day count for per-day room rent", () => {
    const claimText = `employee_code,Sum Insured,ARG Status1,Room Category,Room Rent Per Day
EMP301,500000,Settled,Normal,7000
EMP302,500000,Settled,Ward,9000`;

    const claimRows = parseCSV(claimText);

    const result = calculateRoomRentWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          employeeCode: "employee_code",
          sumInsured: "Sum Insured",
          settlementStatus: "ARG Status1",
          roomCategory: "Room Category",
          roomRentPerDay: "Room Rent Per Day",
        },
        [
          "employeeCode",
          "sumInsured",
          "settlementStatus",
          "roomCategory",
          "roomRentPerDay",
        ],
      ),
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].impact).toBe(2000);
    expect(result.rows[1].roomCategory).toBe("Ward");
    expect(result.rows[1].impact).toBe(0);
    expect(result.dashboard.grandTotalImpact).toBe(2000);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("Assumed 1 day"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("not recognized as Normal or ICU"),
      ),
    ).toBe(true);
  });
});

describe("calculateCappedAilmentWorkbook", () => {
  it("filters settled rows, groups by employee and limit, and applies capped ailment formulas", () => {
    const claimText = `employee_code,Proc Type,Proc Limit,ARG Claimed Amount,ARG Incurred Amount,ARG Status1,ARG Ailment
EMP401,Cataract,35000,60000,35000,Settled,Eye
EMP401,Cataract,35000,10000,5000,Settled,Eye
EMP402,Hernia,40000,60000,40000,Settled,Hernia
EMP403,TKR THR,150000,260000,160000,Settled,Ortho
EMP404,Psychiatric,0,105000,91000,Settled,Psychological/Psychiatric
EMP405,CAG,50000,90000,50000,Settled,Cardiac
EMP406,Cataract,35000,60000,35000,Pending,Eye`;

    const claimRows = parseCSV(claimText);

    const result = calculateCappedAilmentWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          employeeCode: "employee_code",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          settlementStatus: "ARG Status1",
          ailment: "ARG Ailment",
        },
        [
          "employeeCode",
          "procedureType",
          "procedureLimit",
          "claimedAmount",
          "incurredAmount",
          "settlementStatus",
          "ailment",
        ],
      ),
      dashboardConfig: DEFAULT_CAPPED_AILMENT_DASHBOARD_CONFIG,
    });

    expect(result.rows).toHaveLength(5);

    expect(result.rows[0].employeeCode).toBe("EMP401");
    expect(result.rows[0].procedureType).toBe("Cataract");
    expect(result.rows[0].sumClaimedAmount).toBe(70000);
    expect(result.rows[0].sumIncurredAmount).toBe(40000);
    expect(result.rows[0].proposedLimit).toBe(50000);
    expect(result.rows[0].difference).toBe(15000);

    expect(result.rows[1].procedureType).toBe("Hernia");
    expect(result.rows[1].difference).toBe(20000);

    expect(result.rows[2].procedureType).toBe("TKR/THR");
    expect(result.rows[2].difference).toBe(50000);

    expect(result.rows[3].procedureType).toBe("Psychiatric");
    expect(result.rows[3].proposedLimit).toBe(91000);
    expect(result.rows[3].difference).toBe(91000);

    expect(result.rows[4].procedureType).toBe("CAG");
    expect(result.rows[4].proposedLimit).toBe(0);
    expect(result.rows[4].difference).toBe(0);

    expect(result.dashboard.rows[0].procedureType).toBe("Cataract");
    expect(result.dashboard.rows[0].proposedLimitIncrease).toBeCloseTo(
      50000 / 35000 - 1,
      6,
    );
    expect(result.dashboard.rows[0].totalImpact).toBe(15000);

    expect(result.dashboard.rows[1].procedureType).toBe("Hernia");
    expect(result.dashboard.rows[1].totalImpact).toBe(20000);

    expect(result.dashboard.rows[2].procedureType).toBe("TKR/THR");
    expect(result.dashboard.rows[2].totalImpact).toBe(50000);

    expect(result.dashboard.rows[3].procedureType).toBe("Psychiatric");
    expect(result.dashboard.rows[3].proposedLimitIncrease).toBe("-");
    expect(result.dashboard.rows[3].totalImpact).toBe(91000);

    expect(result.dashboard.rows[4].procedureType).toBe("CAG");
    expect(result.dashboard.rows[4].totalImpact).toBe(0);

    expect(result.dashboard.grandTotalImpact).toBe(176000);
    expect(result.warnings).toHaveLength(0);
  });

  it("maps psychiatric from ailment fallback when procedure type is not explicit", () => {
    const claimText = `employee_code,Proc Type,Proc Limit,ARG Claimed Amount,ARG Incurred Amount,ARG Status1,ARG Ailment
EMP450,Therapy Session,0,40000,31819,Settled,Psychological/Psychiatric`;

    const claimRows = parseCSV(claimText);

    const result = calculateCappedAilmentWorkbook({
      claimRows: mapRowsToObjects(
        claimRows,
        claimRows[0],
        {
          employeeCode: "employee_code",
          procedureType: "Proc Type",
          procedureLimit: "Proc Limit",
          claimedAmount: "ARG Claimed Amount",
          incurredAmount: "ARG Incurred Amount",
          settlementStatus: "ARG Status1",
          ailment: "ARG Ailment",
        },
        [
          "employeeCode",
          "procedureType",
          "procedureLimit",
          "claimedAmount",
          "incurredAmount",
          "settlementStatus",
          "ailment",
        ],
      ),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].procedureType).toBe("Psychiatric");
    expect(result.rows[0].proposedLimit).toBe(31819);
    expect(result.rows[0].difference).toBe(31819);
    expect(result.dashboard.rows[3].totalImpact).toBe(31819);
  });
});
