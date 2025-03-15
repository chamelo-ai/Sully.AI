// 1_pages/locators.js
export const LoginLocators = {
    emailField: 'input[name="email"]',
    passwordField: 'input[name="password"]',
    loginButton: 'button:has-text("Login")',
  };
  
  export const HeaderLocators = {
    profileHeader: '#twid_nav_header',
  };
  
  export const sideNavBar = {
    homeTab: 'button[data-tooltip-id="menu-item-home-tooltip"]',
    searchTab:'button[data-tooltip-id="menu-item-search-tooltip"]',
    visitsTab:'button[data-tooltip-id="menu-item-scribe-tooltip"]',
    patientsTab:'button[data-tooltip-id="menu-item-recordings-tooltip"]',
    scribeTab:'button[data-tooltip-id="menu-item-scribe_agent-tooltip"]'
  };

  // 1_pages/locators.js
export const common = {
  closeButton: 'button[aria-label="Close"]',
  patientSearchBox: 'input#twid_search_patient',
  patientResult: 'p#note-item-head-title:has-text("Patient")',
  sendButton: 'button:has-text("Send")',
  providerAddressInput: 'input#email',
  sendReportButton: 'button[type="submit"][form="sendReportForm"]',
  okButton: 'button:has-text("OK")',
  patientNotes: 'div.tiptap.ProseMirror',
  existingPatientDropdown: 'input[role="combobox"][placeholder="Search or create patient..."]',
  patientDropdownResults: 'ul#patient-search-dropdown li',
  startRecordingButton: 'button:has-text("Start Recording")',
  stopRecordingButton: 'button:has-text("Finish Visit")',
  micDeniedMessage: '#twid_mic_denied_message',
  shortRecordingErrorModal: 'div.popup-body.modal-body',
  viewNoteButton: 'button:has-text("View Note")',
  transcriptBox: '#speech-transcript'

  

};
