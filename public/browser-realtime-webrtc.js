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
      switch(realtimeEvent.type) {
        case "conversation.item.created": {
          //console.log(`${realtimeEvent.item.role}`);
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
        case "response.content_part.done": {
          //console.log("response.content_part.done", userVoiceTranscript)
          if(realtimeEvent.part.transcript) console.log(`${realtimeEvent.part.transcript}`);
          chatHistory.push({ role: "user", content: userVoiceTranscript });
          chatHistory.push({ role: "assistant", content: rawOutput.join("") });
          //console.log(chatHistory)
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

    const baseUrl = "https://api.openai.com/v1/realtime";
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
    // const updateSession = () => {
    //   const event = {
    //     type: "session.update",
    //     session: {
    //       "instructions": "Start with responding to the prompt",
    //     }
    //   }
    //   dataChannel.send(JSON.stringify(event));
    // };    
    dataChannel.addEventListener('open', () => {
      //updateSession();
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
