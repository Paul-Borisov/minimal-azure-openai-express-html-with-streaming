export async function getEphemeralKey({model, apiKey}) {
  let ephemeralKey;
  if (/^(gpt-realtime|gpt-5-)/i.test(model)) {
    const sessionConfig = JSON.stringify({
      session: {
        type: "realtime",
        model: "gpt-realtime",
        audio: {
          output: { voice: "verse" }
        },
      }
    });

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: sessionConfig
      }
    );

    const data = await response.json();
    ephemeralKey = data.value;
  } else {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        modalities: ["audio", "text"],
        voice: "verse",
        input_audio_transcription: {
          model: "whisper-1",
        },
        // input_audio_noise_reduction: null // default, noise reduction disabled; this mode is the most sensitive to any sound input
        input_audio_noise_reduction: {
          //type: "near_field" // near_field is for close-talking microphones such as headphones
          type: "far_field"    // far_field is for far-field microphones such as laptop or conference room microphones
        }  
      }),
    });
    const data = await r.json();
    ephemeralKey = data.client_secret.value;
  }
  
  return ephemeralKey;
}
