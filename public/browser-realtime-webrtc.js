(async () => {
  async function startRealtimeSession({
    model,
    prompt,
    chatHistory,
    thinkingHeader,
    getFormattedChatHistory,
    getFormattedOutput,
    updateRealtimeRootInnerHtml
  }) {
    let userVoiceTranscript = prompt;
    let formattedChatHistory = getFormattedChatHistory();
    let formattedUserRequest = getFormattedOutput(prompt, false);
    const rawOutput = [];
    updateRealtimeRootInnerHtml(formattedChatHistory, formattedUserRequest, [thinkingHeader]);

    const isGAModel = /^(gpt-realtime|gpt-5-)/i.test(model); // Newer GA models use different URLs and start parameters
    const tokenResponse = await fetch(`/api/openai/session?model=${model}`);
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create a peer connection
    let peerConnection = new RTCPeerConnection();

    // Set up to play remote audio from the model
    const audio = document.createElement("audio");
    audio.autoplay = true;
    peerConnection.ontrack = (e) => (audio.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      text: true,
    });
    peerConnection.addTrack(mediaStream.getTracks()[0]);

    // Set up data channel for sending and receiving events
    let dataChannel = peerConnection.createDataChannel("openai-realtime-events");
    const userVoiceInput = [];
    dataChannel.addEventListener("message", (e) => {
      const realtimeEvent = JSON.parse(e.data);
      //console.log(realtimeEvent)
      switch(realtimeEvent.type) {
        case "conversation.item.created": {
          // Older event, which was used by gpt-4o-realtime-preview.
          // no break here to falldown to the next newer event.
        }
        case "conversation.item.done": {  // New event for gpt-preview
          console.log(`${realtimeEvent.item.role}`);
          if(realtimeEvent.item.role === "user") {
            rawOutput.length = 0;
            userVoiceInput.length = 0;
          }
          break;
        }
        case "conversation.item.input_audio_transcription.delta": {
          //console.log(`${realtimeEvent.delta}`);
          const userVoiceDelta = realtimeEvent.delta.trim();
          if(userVoiceInput.length || userVoiceDelta) {
            userVoiceInput.push(userVoiceDelta);
            formattedUserRequest = getFormattedOutput(userVoiceInput.join(""), false);
          }
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          //console.log(`${realtimeEvent.transcript}`);
          userVoiceTranscript = realtimeEvent.transcript.trim();
          break;
        }
        case "response.audio_transcript.delta": {
          //console.log(`${realtimeEvent.delta}`);
          if(realtimeEvent.delta) {
            rawOutput.push(realtimeEvent.delta);
            updateRealtimeRootInnerHtml(formattedChatHistory, formattedUserRequest, rawOutput);
          }
          break;
        }
        case "response.output_audio_transcript.delta": {
          //console.log(`${realtimeEvent.delta}`);
          if(realtimeEvent.delta) {
            rawOutput.push(realtimeEvent.delta);
            updateRealtimeRootInnerHtml(formattedChatHistory, formattedUserRequest, rawOutput);
          }
          break;
        }
        case "response.content_part.done": {
          //console.log("response.content_part.done", userVoiceTranscript)
          if(realtimeEvent.part.transcript) console.log(`${realtimeEvent.part.transcript}`);
          chatHistory.push({ role: "user", content: userVoiceTranscript });
          chatHistory.push({ role: "assistant", content: rawOutput.join("") });
          //console.log(chatHistory);
          formattedChatHistory = getFormattedChatHistory();
          break;          
        }
        default: {
          //console.log(realtimeEvent);
        }
      }
    });

    // Start the session using the Session Description Protocol (SDP)
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    let baseUrl = "https://api.openai.com/v1/realtime";
    if (isGAModel) baseUrl += "/calls";   
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await peerConnection.setRemoteDescription(answer);

    const startConversationFromThePrompt = () => {
      const responseCreate = {
        type: "response.create",
        response: {
          modalities: ["text","audio"],
          instructions: prompt
        }
      };
      if (isGAModel) {
        delete responseCreate.response.modalities; // New GA models must not have this parameter specified
      }
      dataChannel.send(JSON.stringify(responseCreate));
      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      };
      dataChannel.send(JSON.stringify(event));
    };

    const updateSession = () => {
      const audio_input_noise_reduction = { type: "far_field" };
      const audio_input_transcription = { 
        model: "whisper-1",  // or gpt-4o-transcribe if enabled on your account
        // language: "en",      // optional
        // prompt: "domain terms, names, etc." // optional biasing prompt
      };
      const turn_detection = {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      };
      const eventEnableUserTranscript = {
        type: "session.update",
        session: { model }
      };
      if (isGAModel) {
        eventEnableUserTranscript.session = {
          type: "realtime",
          ...eventEnableUserTranscript.session,
          audio: {
            input: {
              noise_reduction: audio_input_noise_reduction,
              transcription: audio_input_transcription,
              turn_detection
            }
          },
        }
      } else {
        // The older syntax, which was used for gpt-4o-realtime-preview
        // This is already set on the server side. Duplicated here just as an example.
        eventEnableUserTranscript.session = {
          ...eventEnableUserTranscript.session,
          input_audio_noise_reduction: audio_input_noise_reduction,
          input_audio_transcription: audio_input_transcription,
          turn_detection
        }
      }
      dataChannel.send(JSON.stringify(eventEnableUserTranscript));
    };
    dataChannel.addEventListener("open", () => {
      updateSession();
      startConversationFromThePrompt();
    });
    window.stopRealtimeSession = function() {
      if (dataChannel) dataChannel.close();
      if (peerConnection) peerConnection.close();
      dataChannel = null;
      peerConnection = null;
    };
  }
  window.startRealtimeSession = startRealtimeSession;
})();
