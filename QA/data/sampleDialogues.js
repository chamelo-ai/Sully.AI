/**
 * Sample dialogues for various medical scenarios
 * Used as fallback when OpenAI dialogue generation is unavailable
 */

const sampleDialogues = {
  'cough': [
    { speaker: 'Clinician', text: 'Hello, what brings you in today?' },
    { speaker: 'Patient', text: 'I have had a persistent cough for the past two weeks.' },
    { speaker: 'Clinician', text: 'I see. Is it worse at any particular time of day?' },
    { speaker: 'Patient', text: 'It seems worse at night and early morning.' },
    { speaker: 'Clinician', text: 'Any fever, chills, or shortness of breath?' },
    { speaker: 'Patient', text: 'No fever or chills, but I do feel short of breath sometimes after coughing a lot.' }
  ],
  'headache': [
    { speaker: 'Clinician', text: 'What seems to be the problem today?' },
    { speaker: 'Patient', text: 'I have been having severe headaches for the past week.' },
    { speaker: 'Clinician', text: 'Can you describe the pain? Is it constant or intermittent?' },
    { speaker: 'Patient', text: 'It comes and goes, but when it hits, it feels like pounding on the right side.' },
    { speaker: 'Clinician', text: 'Any sensitivity to light or sound during these headaches?' },
    { speaker: 'Patient', text: 'Yes, light makes it much worse, and I need to lie down in a dark room.' }
  ],
  'diabetes': [
    { speaker: 'Clinician', text: 'What brought you in for your visit today?' },
    { speaker: 'Patient', text: 'I\'ve been feeling very thirsty and tired lately, and I\'m urinating frequently.' },
    { speaker: 'Clinician', text: 'How long have you been experiencing these symptoms?' },
    { speaker: 'Patient', text: 'For about three weeks now. I\'ve also lost some weight without trying.' },
    { speaker: 'Clinician', text: 'Have you noticed any blurry vision or slow-healing cuts?' },
    { speaker: 'Patient', text: 'Yes, my vision gets blurry sometimes, and I have a cut on my foot that isn\'t healing well.' }
  ],
  'hypertension': [
    { speaker: 'Clinician', text: 'What brings you to the clinic today?' },
    { speaker: 'Patient', text: 'My home blood pressure readings have been quite high lately.' },
    { speaker: 'Clinician', text: 'What kind of numbers are you seeing at home?' },
    { speaker: 'Patient', text: 'Usually around 150 over 95, sometimes higher in the evenings.' },
    { speaker: 'Clinician', text: 'Are you experiencing any headaches, dizziness, or vision changes?' },
    { speaker: 'Patient', text: 'I do get headaches occasionally, especially when the pressure is high.' }
  ],
  'backpain': [
    { speaker: 'Clinician', text: 'What brings you in today?' },
    { speaker: 'Patient', text: 'I\'ve been having severe lower back pain for about three weeks now.' },
    { speaker: 'Clinician', text: 'Can you describe the pain and where exactly it\'s located?' },
    { speaker: 'Patient', text: 'It\'s a sharp pain across my lower back, worse on the right side. Sometimes it radiates down my leg.' },
    { speaker: 'Clinician', text: 'What makes it better or worse?' },
    { speaker: 'Patient', text: 'Sitting for long periods makes it worse. Walking helps a little bit, and lying down with a pillow under my knees helps the most.' }
  ],
  'anxiety': [
    { speaker: 'Clinician', text: 'What concerns brought you in today?' },
    { speaker: 'Patient', text: 'I\'ve been feeling extremely anxious lately, almost constantly worried about everything.' },
    { speaker: 'Clinician', text: 'How long have you been experiencing these feelings?' },
    { speaker: 'Patient', text: 'It\'s been getting worse over the past few months, but especially bad in the last two weeks.' },
    { speaker: 'Clinician', text: 'Are you having any physical symptoms along with the anxiety?' },
    { speaker: 'Patient', text: 'Yes, my heart races sometimes, I have trouble sleeping, and occasionally I feel like I can\'t catch my breath.' }
  ],
  'covid': [
    { speaker: 'Clinician', text: 'What symptoms are you experiencing today?' },
    { speaker: 'Patient', text: 'I\'ve had a fever, cough, and I can\'t smell or taste anything for the past three days.' },
    { speaker: 'Clinician', text: 'Have you been exposed to anyone with confirmed COVID-19?' },
    { speaker: 'Patient', text: 'Yes, my roommate tested positive last week.' },
    { speaker: 'Clinician', text: 'How high has your fever been, and have you had any difficulty breathing?' },
    { speaker: 'Patient', text: 'My temperature has been around 101°F. I feel a bit short of breath when walking up stairs, but it\'s not severe.' }
  ],
  'asthma': [
    { speaker: 'Clinician', text: 'What seems to be bothering you today?' },
    { speaker: 'Patient', text: 'I\'ve been having more asthma attacks than usual, using my rescue inhaler almost daily.' },
    { speaker: 'Clinician', text: 'When did you notice this increase in symptoms?' },
    { speaker: 'Patient', text: 'It started about two weeks ago when the weather changed and pollen counts went up.' },
    { speaker: 'Clinician', text: 'How would you describe your breathing between attacks?' },
    { speaker: 'Patient', text: 'I feel like I can\'t get a full breath, and there\'s a constant wheezing, especially in the morning.' }
  ],
  'rash': [
    { speaker: 'Clinician', text: 'What can I help you with today?' },
    { speaker: 'Patient', text: 'I\'ve developed this itchy red rash on my arms and chest over the past few days.' },
    { speaker: 'Clinician', text: 'Have you started any new medications or used any new products recently?' },
    { speaker: 'Patient', text: 'I did switch to a new laundry detergent last week, now that you mention it.' },
    { speaker: 'Clinician', text: 'Is the rash painful or just itchy? Any other symptoms like fever?' },
    { speaker: 'Patient', text: 'Mainly itchy, especially at night. No fever or other symptoms besides the irritation.' }
  ],
  'depression': [
    { speaker: 'Clinician', text: 'How have you been feeling lately?' },
    { speaker: 'Patient', text: 'I\'ve been feeling really down for months now, having trouble getting out of bed most days.' },
    { speaker: 'Clinician', text: 'Have you noticed changes in your sleep or appetite?' },
    { speaker: 'Patient', text: 'I sleep too much, sometimes 12 hours, but still feel tired. And I\'ve lost interest in eating - nothing tastes good anymore.' },
    { speaker: 'Clinician', text: 'What about your interest in activities you used to enjoy?' },
    { speaker: 'Patient', text: 'I don\'t really enjoy anything anymore. Even things I used to love feel like a chore now.' }
  ]
};

export default sampleDialogues;