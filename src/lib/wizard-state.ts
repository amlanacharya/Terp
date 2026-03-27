// Wizard state management for first-run setup

export interface WizardState {
  currentStep: number;
  companyInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    gstin?: string;
  };
  licenseKey: string;
  adminUser: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword?: string;
  };
}

export const initialWizardState: WizardState = {
  currentStep: 0,
  companyInfo: {
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: ''
  },
  licenseKey: '',
  adminUser: {
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  }
};

export interface WizardValidationErrors {
  [key: string]: string;
}
