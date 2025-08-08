export const samples = [
  { code: "Generate javascript regex to replace empty values with '-' in the 3rd field of comma separated rows" },
  { code: "Add handling of tab-separators to the code" },
  { code: "Generate bash script to reset user password in Azure using az cli" },
  { code: "Generate PowerShell script to connect to MongoDB" },
  { text: "Generate text of 5000 characters on the ancient Rome history" },
  { text: "Generate text of 500 characters on your choice" },
  { text: "Alice has 3 sisters and 5 brothers. How many sisters and brothers Alice's brother has?" },
  { text: "There are 3 killers in a room. A regular person enters the room and kills one of the killers. How many killers are in the room?" },
  { text: "Generate CSV-table for all weeks of 2025. Columns: WeekNumber, StartDate;, EndDate. Use semicolon as column delimiter and ISO-date format. Start day is Monday. End day is Friday. Wrap into ```" },
  { image: "Elon Mask in the clothing of Finnish flag colors in the role of a textcrunch service salesman"},
  { image_dalle_2: "Natural landscape with mountains and ocean"},
  { video: "A quick brown bear is climbing Mount Teide on Tenerife" },
  { video_with_sound: "American man is talking about classic sports cars" },
  { default: "Generate test response of 100 characters" }
];

export function setInitialText(txtPrompt) {
  const sampleText = samples.find(s => !!s.text)?.text;
  if (sampleText) txtPrompt.value = sampleText;
}

export function setDefaultContent(txtPrompt) {
  const defaultSample = samples.find(s => !!s.default)?.default;
  txtPrompt.value = defaultSample || "";
  return txtPrompt.value;
}

export function handleNextPrompt(type, txtPrompt) {
  const currentValue = txtPrompt.value;
  const index = samples.findIndex(s => s[type] === currentValue);
  let nextPrompt;
  if (index === -1) {
    nextPrompt = samples.find(s => !!s[type])?.[type] || "";
  } else {
    nextPrompt = samples.slice(index + 1).find(s => !!s[type])?.[type] ||
                 samples.find(s => !!s[type])?.[type] || "";
  }
  txtPrompt.value = nextPrompt;
}
