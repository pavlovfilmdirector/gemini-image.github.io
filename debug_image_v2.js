
const apiKey = 'AIzaSyAyP49VacmWYDRuLa32_xbhQdzTHs_8e4E';
const modelId = 'gemini-3-pro-image-preview';

async function testImageGen() {
    console.log(`Testing model: ${modelId} without mimeType config`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "A cute robot cat" }] }]
            })
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Raw Body:", text);

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testImageGen();
