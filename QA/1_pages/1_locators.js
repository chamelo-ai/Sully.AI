// 1_pages/1_locators.js

export const LoginLocators = {
  emailField:     'input[name="email"]',
  passwordField:  'input[name="password"]',
  continueButton: 'button:has-text("Continue")',
  submitButton:   'button[type="submit"]',
};

export const HeaderLocators = {
  profileHeader: '#twid_nav_header',
};

export const common = {
  patientNotes:             'div.tiptap.ProseMirror',
  existingPatientDropdown:  '[data-testid="home-screen__welcome-view--v2__existing-patient-card__patient-search-combobox__input--search"]',
  patientDropdownResults:   'ul#patient-search-dropdown li',
  startRecordingButton:     '//*[@id="twid_recording_controls"]/div/button',
  stopRecordingButton:      'button:has-text("Finish Visit")',
  shortRecordingErrorModal: 'div.popup-body.modal-body',
  transcriptBox:            '#speech-transcript',
};
