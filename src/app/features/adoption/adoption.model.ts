export interface AdoptionApplication {
  adopterName: string;
  householdNote: string;
}

export const EMPTY_APPLICATION: AdoptionApplication = {
  adopterName: '',
  householdNote: '',
};

export interface AdoptionCertificate {
  certificateText: string;
}

export interface AdoptionCertificateErrorBody {
  error: { code: string; message: string };
}
