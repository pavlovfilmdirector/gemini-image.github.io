
const apiKey = 'AIzaSyAyP49VacmWYDRuLa32_xbhQdzTHs_8e4E';
const modelId = 'gemini-3-pro-image-preview'; // or 'imagen-3.0-generate-002' if available? List said gemini-3-pro-image-preview exists.

async function testImageGen() {
    console.log(`Testing model: ${modelId}`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "A cute robot cat" }] }],
                generationConfig: {
                    responseMimeType: "image/png"
                }
            })
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Raw Body:", text);

        try {
            const data = JSON.parse(text);
            if (data.error) {
                console.error("API returned error:", data.error);
            }
        } catch (e) {
            console.error("Failed to parse JSON", e);
        }

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testImageGen();
