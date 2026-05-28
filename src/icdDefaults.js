const ICD_MASTER_RANGES = [
  {
    start: "A00",
    end: "B99",
    category: "Certain infectious and parasitic diseases",
    ailment: "Infectious",
  },
  {
    start: "C00",
    end: "D49",
    category: "Neoplasms",
    ailment: "Neoplasm",
  },
  {
    start: "D50",
    end: "D89",
    category:
      "Diseases of the blood and blood-forming organs and certain disorders involving the immune mechanism",
    ailment: "Blood/Immune",
  },
  {
    start: "E00",
    end: "E99",
    category: "Endocrine, nutritional and metabolic diseases",
    ailment: "Endocrine",
  },
  {
    start: "F00",
    end: "F99",
    category: "Mental, Behavioral and Neurodevelopmental disorders",
    ailment: "Psychological",
  },
  {
    start: "G00",
    end: "G99",
    category: "Diseases of the nervous system",
    ailment: "Nervous",
  },
  {
    start: "H00",
    end: "H59",
    category: "Diseases of the eye and adnexa",
    ailment: "Eye",
  },
  {
    start: "H60",
    end: "H99",
    category: "Diseases of the ear and mastoid process",
    ailment: "Ear & Mastoid",
  },
  {
    start: "I00",
    end: "I99",
    category: "Diseases of the circulatory system",
    ailment: "Circulatory",
  },
  {
    start: "J00",
    end: "J99",
    category: "Diseases of the respiratory system",
    ailment: "Respiratory",
  },
  {
    start: "K00",
    end: "K95",
    category: "Diseases of the digestive system",
    ailment: "Digestive",
  },
  {
    start: "L00",
    end: "L99",
    category: "Diseases of the skin and subcutaneous tissue",
    ailment: "Skin",
  },
  {
    start: "M00",
    end: "M99",
    category: "Diseases of the musculoskeletal system and connective tissue",
    ailment: "Musculoskeletal",
  },
  {
    start: "N00",
    end: "N99",
    category: "Diseases of the genitourinary system",
    ailment: "Genitourinary",
  },
  {
    start: "O00",
    end: "O99",
    category: "Pregnancy, childbirth and the puerperium",
    ailment: "Maternity",
  },
  {
    start: "P00",
    end: "P96",
    category: "Certain conditions originating in the perinatal period",
    ailment: "Perinatal",
  },
  {
    start: "Q00",
    end: "Q99",
    category: "Congenital malformations, deformations and chromosomal abnormalities",
    ailment: "Congenital",
  },
  {
    start: "R00",
    end: "R99",
    category:
      "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified",
    ailment: "Clinical and laboratory findings",
  },
  {
    start: "S00",
    end: "T98",
    category: "Injury, poisoning and certain other consequences of external causes",
    ailment: "Accident / Injury",
  },
  {
    start: "U07",
    end: "U07",
    category: "Covid-19",
    ailment: "Covid-19",
  },
  {
    start: "V00",
    end: "Y99",
    category: "External causes of morbidity",
    ailment: "External causes of morbidity",
  },
  {
    start: "Z00",
    end: "Z99",
    category: "Factors influencing health status and contact with health services",
    ailment: "Factors influencing health status",
  },
];

function encodeIcdPrefix(prefix) {
  const normalizedPrefix = String(prefix || "").trim().toUpperCase();
  if (!/^[A-Z]\d{2}$/.test(normalizedPrefix)) {
    throw new Error(`Invalid ICD prefix: ${prefix}`);
  }

  return (
    (normalizedPrefix.charCodeAt(0) - 65) * 100 + Number(normalizedPrefix.slice(1))
  );
}

function decodeIcdPrefix(value) {
  const letterCode = Math.floor(value / 100);
  const numericCode = value % 100;

  return `${String.fromCharCode(65 + letterCode)}${String(numericCode).padStart(2, "0")}`;
}

function expandIcdRange({ start, end, category, ailment }) {
  const prefixes = [];

  for (
    let current = encodeIcdPrefix(start);
    current <= encodeIcdPrefix(end);
    current += 1
  ) {
    prefixes.push({
      icdPrefix: decodeIcdPrefix(current),
      category,
      ailment,
    });
  }

  return prefixes;
}

export const DEFAULT_ICD_LOOKUP_ROWS = ICD_MASTER_RANGES.flatMap(expandIcdRange);
