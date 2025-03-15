// File: data/testData.js

const common = {
  // Login page elements
  usernameInput: '#username',
  passwordInput: '#password',
  loginButton: 'button[type="submit"]',
  profileHeader: '.profile-header',
  
  // Scribe page elements
  existingPatientDropdown: '.patient-dropdown',
  patientDropdownResults: '.patient-option',
  startRecordingButton: 'button.start-recording',
  stopRecordingButton: 'button.stop-recording',
  finishVisitButton: 'button.finish-visit',
  transcriptContent: '.transcript-content'
};

const testData = {
    validLogin: {
      username: 'nathancha33@gmail.com', 
      password: 'Testing1234',         
    },
    
    invalidLogin: {
      username: 'wrong-email@example.com',
      password: 'wrongPassword',
    },

    providerAddress: {
      email: 'testing1234@gmail.com'
    }

  };
  
  export { common, testData };
  