export type AssuranceFindingCode =
  | "UNSUPPORTED_CLAIM"
  | "AUTHORIZATION_WORDING_CHANGED"
  | "MISSING_DESTINATION"
  | "DUPLICATE_CLAIM"
  | "PROHIBITED_PROMISE";

export interface AssuranceFinding {
  code: AssuranceFindingCode;
  severity: "required" | "advisory";
  message: string;
  claimIndex?: number;
}

export interface PacketAssuranceResult {
  ruleVersion: "application_assurance_v1";
  status: "passed" | "blocked";
  findings: AssuranceFinding[];
}

const PROHIBITED_PROMISE =
  /\b(?:guaranteed? (?:ats|interview|offer|transfer)|will (?:qualify|be hired|receive)|visa transfer (?:is )?assured)\b/iu;

export function assurePacket(input: {
  authorizationWording: string;
  lockedAuthorizationWording?: string;
  claims: Array<{ text: string; evidenceIds: string[] }>;
  confirmedEvidenceIds: string[];
  destination: { company: string; role: string };
}): PacketAssuranceResult {
  const findings: AssuranceFinding[] = [];
  const confirmed = new Set(input.confirmedEvidenceIds);
  const seen = new Set<string>();

  if (input.destination.company.trim() === "" || input.destination.role.trim() === "") {
    findings.push({
      code: "MISSING_DESTINATION",
      severity: "required",
      message: "Choose the exact company and role before assurance.",
    });
  }

  if (
    input.lockedAuthorizationWording !== undefined &&
    input.authorizationWording.normalize("NFC") !==
      input.lockedAuthorizationWording.normalize("NFC")
  ) {
    findings.push({
      code: "AUTHORIZATION_WORDING_CHANGED",
      severity: "required",
      message: "Restore the candidate-approved work-authorization wording.",
    });
  }

  input.claims.forEach((claim, index) => {
    const normalized = claim.text.normalize("NFC").trim().toLocaleLowerCase("en-US");
    const unsupported =
      claim.evidenceIds.length === 0 || claim.evidenceIds.some((id) => !confirmed.has(id));
    if (unsupported) {
      findings.push({
        code: "UNSUPPORTED_CLAIM",
        severity: "required",
        message: "Link this material claim to confirmed evidence or remove it.",
        claimIndex: index,
      });
    }
    if (seen.has(normalized)) {
      findings.push({
        code: "DUPLICATE_CLAIM",
        severity: "advisory",
        message: "Remove the duplicate claim before final approval.",
        claimIndex: index,
      });
    }
    if (PROHIBITED_PROMISE.test(normalized)) {
      findings.push({
        code: "PROHIBITED_PROMISE",
        severity: "required",
        message: "Remove hiring, ATS, or immigration outcome promises.",
        claimIndex: index,
      });
    }
    seen.add(normalized);
  });

  return {
    ruleVersion: "application_assurance_v1",
    status: findings.length === 0 ? "passed" : "blocked",
    findings,
  };
}
