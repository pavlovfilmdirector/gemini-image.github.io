// Tab Switching Logic
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Update tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update sections
        const target = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-panel').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(target).classList.add('active');
    });
});

// API Key status watcher
const apiKeyInput = document.getElementById('api-key');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

if (apiKeyInput) {
    apiKeyInput.addEventListener('input', (e) => {
        if (e.target.value.length > 5) {
            statusDot.classList.add('active');
            statusText.innerText = 'API Ключ установлен';
        } else {
            statusDot.classList.remove('active');
            statusText.innerText = 'Симуляция активна';
        }
    });
}

// Global state
let lastGeneratedUrl = '';
let lastPrompt = '';
let lastSeed = null;

// Helper: Call Gemini 3 Flash for Text (Translation & Merging)
async function callGeminiText(prompt, apiKey) {
    if (!apiKey) return null;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
    } catch (e) {
        console.error("Gemini Text API Error:", e);
    }
    return null;
}

// Helper: Call Gemini 3 Pro Image for Generation
// Helper: Call Gemini Image (Pro or Flash) with Native Support
async function callGeminiImage(prompt, modelId, apiKey, files = [], config = {}) {
    if (!apiKey) return null;

    try {
        // 1. Prepare Content Parts (Text + Images)
        const parts = [{ text: prompt }];

        if (files && files.length > 0) {
            for (const file of files) {
                const base64 = await fileToBase64(file);
                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64.split(',')[1]
                    }
                });
            }
        }

        // Handle Mask for Editing
        if (config.isEditing && config.maskData) {
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: config.maskData
                }
            });
        }

        // 2. Prepare Request Body
        const requestBody = {
            contents: [{ parts: parts }]
        };

        // 3. Add Generation Config
        if (config && (config.aspectRatio || config.resolution)) {
            requestBody.generationConfig = { imageConfig: {} };
            if (config.aspectRatio) requestBody.generationConfig.imageConfig.aspectRatio = config.aspectRatio;
            if (config.resolution && modelId.includes('pro')) {
                requestBody.generationConfig.imageConfig.imageSize = config.resolution;
            }
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // Handle Image Response
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            // Check for image part
            const imgPart = data.candidates[0].content.parts.find(p => p.inlineData);
            if (imgPart && imgPart.inlineData) {
                return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
            }
            // Check for text part (if error or refusal)
            const textPart = data.candidates[0].content.parts.find(p => p.text);
            if (textPart) {
                console.warn("Model returned text instead of image:", textPart.text);
            }
        }
    } catch (e) {
        console.error("Gemini Image API Error:", e);
    }
    return null;
}

// Helper: Call Gemini Vision for Reference Analysis
async function callGeminiVision(prompt, files, apiKey) {
    if (!apiKey) return null;
    const model = 'gemini-1.5-flash'; // Good for vision

    try {
        // Prepare parts: files first, then text
        const parts = [];
        for (const file of files) {
            const base64 = await fileToBase64(file);
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64.split(',')[1] // remove prefix
                }
            });
        }

        parts.push({
            text: `
You are an expert image prompt engineer.
Analyze these images and the user's request: "${prompt}".
Identify the key elements, style, composition, and subjects in the reference images.
Write a single, highly detailed image generation prompt that combines the style/content of the images with the user's instruction.
Return ONLY the prompt string.
            `
        });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: parts }] })
        });

        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
    } catch (e) {
        console.error("Gemini Vision API Error:", e);
    }
    return null;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// 1. Translation
async function translateText(text, apiKey) {
    if (!apiKey) return text;
    // Simple cache or check if already English (latin chars) could be here, but using API is safer for mixed
    const res = await callGeminiText(`Translate the following user prompt to English. Return ONLY the translation, nothing else. Text: "${text}"`, apiKey);
    return res || text;
}

// 2. Smart Prompt Merging (Context)
async function mergePrompts(oldPrompt, newModifier, apiKey) {
    if (!apiKey || !oldPrompt) return `${oldPrompt}, ${newModifier}`; // Fallback

    const instruction = `
You are an expert image prompt engineer.
I have an image generated with the prompt: "${oldPrompt}".
The user wants to modify it with: "${newModifier}".
Please write a single, detailed, high-quality prompt that describes the new image, combining the original context with the new modification logically.
Do not simply append. Rewrite the scene description.
Return ONLY the new prompt string.
    `;

    const res = await callGeminiText(instruction, apiKey);
    return res || `${oldPrompt}, ${newModifier}`;
}

// Main Generation Function
async function generate(mode) {
    const resultPreview = document.getElementById('result-preview');
    const spinner = document.getElementById('loading-spinner');

    // API Key
    const apiKey = document.getElementById('api-key').value;

    // Get Data from all possible tabs
    let rawPrompt = '';
    const activeTab = document.querySelector('.nav-tab.active').getAttribute('data-tab');

    // Get parameters
    const modelEl = document.getElementById('tti-model');
    const aspectEl = document.getElementById('tti-aspect'); // Now in sidebar
    const resEl = document.getElementById('tti-res'); // Now in sidebar

    const model = modelEl ? modelEl.value : 'imagen-3.0';
    const aspect = aspectEl ? aspectEl.value : '1:1';

    if (activeTab === 'text-to-image') {
        rawPrompt = document.getElementById('tti-prompt').value;
    } else if (activeTab === 'image-editing') {
        rawPrompt = document.getElementById('edit-prompt').value;
    } else if (activeTab === 'multi-turn') {
        rawPrompt = document.getElementById('chat-msg').value;
    } else if (activeTab === 'reference') {
        rawPrompt = document.getElementById('ref-prompt').value;
    } else if (activeTab === 'grounding') {
        rawPrompt = document.getElementById('ground-prompt').value;
    }

    if (!rawPrompt.trim() && !lastPrompt && activeTab !== 'reference') {
        alert("Введите описание!");
        return;
    }

    // For reference tab, we might have images but empty prompt, which is valid for "describe this" or "use style"
    if (activeTab === 'reference') {
        if ((!allReferenceFiles || allReferenceFiles.length === 0) && !rawPrompt.trim()) {
            alert("Выберите файлы или введите описание!");
            return;
        }
    }

    // UI Feedback
    spinner.style.display = 'block';
    resultPreview.innerHTML = `
        <div style="width: 100%; padding: 2rem; text-align: center;">
            <div class="skeleton" style="width: 90%;"></div>
            <div class="skeleton" style="width: 70%;"></div>
            <div class="skeleton" style="width: 80%;"></div>
            <p style="margin-top: 20px; color: var(--text-muted); font-size: 0.9rem;">
                ${apiKey ? 'Gemini 3 Pro generating...' : 'Pollinations AI generating...'}
            </p>
        </div>
    `;
    resultPreview.style.opacity = '0.7';

    // A. Context Logic

    let finalPrompt = rawPrompt;
    let filesToGenerage = [];

    // Map Resolution to API format (1K, 2K, 4K)
    let apiResolution = '1K'; // Default
    if (resEl) {
        const val = resEl.value;
        if (val === 'fhd') apiResolution = '1K'; // Approx
        if (val === '2k') apiResolution = '2K';
        if (val === '4k') apiResolution = '4K';
    }

    // Prepare Config
    const genConfig = {
        aspectRatio: aspect,
        resolution: apiResolution
    };

    if (activeTab === 'reference') {
        if (allReferenceFiles && allReferenceFiles.length > 0) {
            filesToGenerage = allReferenceFiles;

            // Native Reference Mode:
            // 1. Translate user prompt (fix for "prompt not translating")
            finalPrompt = await translateText(rawPrompt, apiKey);

            // Update UI
            resultPreview.querySelector('p').innerText = "Gemini 3 Pro generating (Native Mode)...";
        }
    } else if (activeTab === 'image-editing' && lastPrompt) {
        let translatedModifier = await translateText(rawPrompt, apiKey);
        const merged = await mergePrompts(lastPrompt, translatedModifier, apiKey);
        finalPrompt = merged;
    } else {
        // Standard Text-to-Image / Multi-turn
        if (activeTab !== 'reference' && activeTab !== 'image-editing') {
            finalPrompt = await translateText(rawPrompt, apiKey);
        }
    }

    // Capture dimensions
    let width = 1024;
    let height = 1024;
    // Map aspect ratios roughly (for fallback)
    if (aspect === '16:9') { width = 1280; height = 720; }
    else if (aspect === '9:16') { width = 720; height = 1280; }

    // Start Generation
    let imageUrl = null;

    // 1. Try Gemini (Native)
    if (apiKey) {
        // Pass model from UI (gemini-3-pro or gemini-2.5-flash) and files/config
        const geminiImage = await callGeminiImage(finalPrompt, model, apiKey, filesToGenerage, genConfig);
        if (geminiImage) {
            imageUrl = geminiImage;
        }
    }

    // 2. Fallback to Pollinations
    if (!imageUrl) {
        console.log("Falling back to Pollinations...");
        const encoded = encodeURIComponent(finalPrompt);
        const seed = Math.floor(Math.random() * 99999);
        imageUrl = `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=${width}&height=${height}&nologo=true&model=${model}`;

        // Simulate delay for fallback
        await new Promise(r => setTimeout(r, 1000));
    }

    // Success Handling
    spinner.style.display = 'none';
    resultPreview.style.opacity = '1';

    // Update State
    lastPrompt = finalPrompt;
    lastGeneratedUrl = imageUrl;

    resultPreview.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <img id="final-image" src="${imageUrl}" alt="Result" style="border-radius: 8px; max-width: 100%; max-height: 70vh; box-shadow: var(--shadow-premium); display: block; margin: 0 auto;">
            
            <div style="margin-top: 20px; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <div style="padding: 15px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--glass-border); text-align: left; flex: 1; min-width: 300px;">
                    <p style="font-size: 0.95rem; color: var(--text-main); font-weight: 600;">
                        ✅ Готово: ${activeTab}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">
                        <strong>Engine:</strong> ${imageUrl.startsWith('data:') ? 'Gemini 3 Pro' : 'Pollinations (Fallback)'}
                    </p>
                    <p style="font-size: 0.8rem; color: var(--text-inactive); margin-top: 4px; line-height: 1.4;">
                        <strong>Prompt (EN):</strong> ${finalPrompt}
                    </p>
                </div>
                
                <div class="action-buttons-container">
                    <button class="action-btn" style="background: var(--success);" onclick="saveImage()">
                        💾 Сохранить
                    </button>
                    <button class="action-btn" style="background: var(--accent);" onclick="useFor('image-editing')">
                        ✨ Редактировать
                    </button>
                    <button class="action-btn" style="background: var(--primary);" onclick="useFor('reference')">
                        🖼️ Образец
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Function to use the current image in another tab
function useFor(targetMode) {
    const img = document.getElementById('final-image');
    if (!img) return;

    // 1. Switch Tab
    const tabToClick = document.querySelector(`.nav-tab[data-tab="${targetMode}"]`);
    if (tabToClick) tabToClick.click();

    // 2. Prepare Preview in Target Tab
    const resultPreview = document.getElementById('result-preview');
    resultPreview.innerHTML = `
        <div style="text-align: center;">
            <p style="margin-bottom: 15px; color: var(--success); font-weight: 600;">✅ Изображение передано в режим: ${targetMode}</p>
            <img src="${img.src}" style="max-height: 300px; border-radius: 12px; border: 2px solid var(--primary);">
            <p style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">Используется как исходник для новой задачи</p>
            <button class="btn" style="margin-top: 20px;" onclick="window.scrollTo(0, 0)">К настройкам выше ↑</button>
        </div>
    `;

    // 3. Focus prompt
    const targetInputId = targetMode === 'image-editing' ? 'edit-prompt' : 'ref-prompt';
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.focus();
}

// Function to download the generated image
async function saveImage() {
    const img = document.getElementById('final-image');
    if (!img) return;

    try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `gemini-studio-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert('Не удалось скачать напрямую. Используйте: Правая кнопка -> Сохранить как...');
    }
}

// ... existing saveImage ... 

// --- Canvas Masking Logic ---
let isDrawing = false;
let canvas, ctx;

function setupCanvasLogic() {
    const fileInput = document.getElementById('edit-image-file');
    const container = document.getElementById('canvas-container');
    const imgEl = document.getElementById('edit-source-img');
    canvas = document.getElementById('mask-canvas');
    ctx = canvas.getContext('2d');

    // 1. Load Image onto Canvas Area
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                imgEl.src = evt.target.result;
                container.style.display = 'block';

                // Wait for img load to resize canvas
                imgEl.onload = () => {
                    canvas.width = imgEl.clientWidth;
                    canvas.height = imgEl.clientHeight;
                    // Reset drawing
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'rgba(0,0,0,0.5)'; // Transparent black default? No, usually mask is white on black.
                    // Let's use: User sees semi-transparent white brush. We export binary mask manually if needed.
                    // Or simpler: Draw white strokes. Export canvas as is. 
                    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                };
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // 2. Drawing Events
    const startDraw = (e) => {
        isDrawing = true;
        ctx.beginPath();
        const { x, y } = getPos(e);
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getPos(e);
        const size = document.getElementById('brush-size').value;
        ctx.lineWidth = size;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = () => {
        isDrawing = false;
        ctx.closePath();
    };

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        // Handle touch vs mouse
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    // Mouse
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw);

    // Touch
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stopDraw);
}

function clearMask() {
    if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Convert canvas drawing to Base64 Mask
function getCanvasMask() {
    if (!canvas) return null;
    // We need a black background with white strokes? Or transparent?
    // Gemini Inpainting usually expects: 
    // "mask": { "mimeType": "image/png", "data": ... }
    // Ideally user provided drawing is white, background transparent. 
    return canvas.toDataURL('image/png');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', setupCanvasLogic);

// ... existing file preview ...
// Custom state for Reference files to allow cumulative add
let allReferenceFiles = [];

function setupFilePreview(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {

            // For Reference mode, append files. For others (edit), replace.
            const isRefMode = inputId === 'ref-files';

            if (isRefMode) {
                // Add new files to array
                Array.from(e.target.files).forEach(f => allReferenceFiles.push(f));
            } else {
                // Not ref mode, standard behavior (replace) - though we don't store it in global arr
                // We'll just rely on the standard input.files 
            }

            // Determine which files to show/use
            // Note: For Edit mode, we still rely on input.files. For Ref, we use allReferenceFiles.

            updatePreview(inputId === 'ref-files' ? allReferenceFiles : Array.from(e.target.files));
        }

        // Reset input value so same file can be selected again if needed (or to allow "change" event next time)
        if (inputId === 'ref-files') input.value = '';
    });
}

function updatePreview(files) {
    const preview = document.getElementById('result-preview');

    // Clear previous preview if it was a placeholder or result
    // Or just find existing grid? If we are appending, we might want to just render all from scratch to be safe/easy

    // Simpler to just re-render the whole grid from the source array
    if (!preview.querySelector('.preview-grid')) {
        preview.innerHTML = '';
    }

    let grid = preview.querySelector('.preview-grid');
    if (!grid) {
        grid = document.createElement('div');
        grid.className = 'preview-grid';
        grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; width: 100%; padding: 10px;';
        preview.appendChild(grid);
    } else {
        grid.innerHTML = ''; // Clear and re-fill
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'position: relative; width: 100px; height: 100px; border-radius: 8px; overflow: hidden; border: 1px solid var(--glass-border);';

            imgContainer.innerHTML = `
                <img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 9px; padding: 2px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${file.name}
                </div>
            `;
            grid.appendChild(imgContainer);
        };
        reader.readAsDataURL(file);
    });

    const summary = document.createElement('p');
    summary.style.cssText = 'width: 100%; text-align: center; margin-top: 10px; color: var(--text-muted); font-size: 0.8rem;';
    summary.innerText = `📷 Всего файлов: ${files.length}`;
    grid.appendChild(summary);
}

setupFilePreview('edit-image-file');
setupFilePreview('ref-files');

// Clear button logic
const clearBtn = document.getElementById('clear-ref-btn');
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        const input = document.getElementById('ref-files');
        const preview = document.getElementById('result-preview');

        if (input) input.value = ''; // Reset file input
        allReferenceFiles = []; // Reset custom array

        // Clear preview grid specifically
        const grid = preview.querySelector('.preview-grid');
        if (grid) grid.remove();
    });
}
