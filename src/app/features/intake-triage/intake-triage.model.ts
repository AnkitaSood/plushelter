
export interface CaseFile {
  species: string;
  condition: string;
  suggestedCaseName: string;
  huggabilityScore: number;
  recommendedTreatmentPlan: string[];
}

export interface UploadedPhoto {
  base64: string;
  mimeType: string;
}

export interface TriageErrorBody {
  error: { code: string; message: string };
}

export interface GuiltAnalysis {
  guiltScore: number;
  message: string;
}

export interface SurrenderRiskErrorBody {
  error: { code: string; message: string };
}

export const EMPTY_CASE_FILE: CaseFile = {
  species: '',
  condition: '',
  suggestedCaseName: '',
  huggabilityScore: 0,
  recommendedTreatmentPlan: [],
};
