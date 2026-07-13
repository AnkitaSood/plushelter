
interface CaseFile {
  species: string;
  condition: string;
  suggestedCaseName: string;
  huggabilityScore: number;
  recommendedTreatmentPlan: string[];
}

interface UploadedPhoto {
  base64: string;
  mimeType: string;
}

interface TriageErrorBody {
  error: { code: string; message: string };
}

interface GuiltAnalysis {
  guiltScore: number;
  message: string;
}

interface SurrenderRiskErrorBody {
  error: { code: string; message: string };
}

const EMPTY_CASE_FILE: CaseFile = {
  species: '',
  condition: '',
  suggestedCaseName: '',
  huggabilityScore: 0,
  recommendedTreatmentPlan: [],
};
