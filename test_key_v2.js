// KEY PROVIDED BY USER
const API_KEY = 'API';
const MODEL_NAME = 'gemini-3-pro-image-preview';

async function testGeneration() {
    console.log(`Testing API Key: ${API_KEY.substring(0, 10)}...`);
    console.log(`Model: ${MODEL_NAME}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

    // Simple text prompt
    const payload = {
        contents: [{
            parts: [{ text: "A futuristic nano-banana made of crystal" }]
        }],
        generationConfig: {
            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status} ${response.statusText}`);

        const data = await response.json();

        if (response.status !== 200) {
            console.error("Error Response:", JSON.stringify(data, null, 2));
        } else {
            console.log("Success! Response structure:");
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                const imgPart = data.candidates[0].content.parts.find(p => p.inlineData);
                if (imgPart) {
                    console.log("✅ Image Data Received (Base64)");
                    console.log("MimeType:", imgPart.inlineData.mimeType);
                } else {
                    console.log("⚠️ No inlineData found in parts.");
                    console.log(JSON.stringify(data.candidates[0].content.parts, null, 2));
                }
            } else {
                console.log("⚠️ Unexpected structure:", JSON.stringify(data, null, 2));
            }
        }

    } catch (error) {
        console.error("Network/Script Error:", error);
    }
}

testGeneration();

