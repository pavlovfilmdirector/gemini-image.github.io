
const apiKey = 'AIzaSyAyP49VacmWYDRuLa32_xbhQdzTHs_8e4E';

async function testKey() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello, answer with 'OK' if you see this." }]
                }]
            })
        });
        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testKey();
