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

// Main Generation Function
async function generate(mode) {
    const resultPreview = document.getElementById('result-preview');
    const spinner = document.getElementById('loading-spinner');

    // Get Data from all possible tabs
    let prompt = '';
    const activeTab = document.querySelector('.nav-tab.active').getAttribute('data-tab');

    // Get parameters
    const modelEl = document.getElementById('tti-model');
    const aspectEl = document.getElementById('tti-aspect');
    const resEl = document.getElementById('tti-res');

    const model = modelEl ? modelEl.value : 'imagen-3.0';
    const aspect = aspectEl ? aspectEl.value : '1:1';
    const res = resEl ? resEl.value : 'hd';

    if (activeTab === 'text-to-image') {
        prompt = document.getElementById('tti-prompt').value;
    } else if (activeTab === 'image-editing') {
        prompt = document.getElementById('edit-prompt').value;
    } else if (activeTab === 'multi-turn') {
        prompt = document.getElementById('chat-msg').value;
    } else if (activeTab === 'reference') {
        prompt = document.getElementById('ref-prompt').value;
    } else if (activeTab === 'grounding') {
        prompt = document.getElementById('ground-prompt').value;
    }

    // UI Feedback
    spinner.style.display = 'block';
    resultPreview.innerHTML = `
        <div style="width: 100%; padding: 2rem; text-align: center;">
            <div class="skeleton" style="width: 90%;"></div>
            <div class="skeleton" style="width: 70%;"></div>
            <div class="skeleton" style="width: 80%;"></div>
            <p style="margin-top: 20px; color: var(--text-muted); font-size: 0.9rem;">Запрос отправляется в Gemini API...</p>
        </div>
    `;
    resultPreview.style.opacity = '0.7';

    // Determine dimensions based on aspect ratio
    let width = 800;
    let height = 450;

    if (aspect === '1:1') { width = 512; height = 512; }
    else if (aspect === '9:16') { width = 450; height = 800; }
    else if (aspect === '4:3') { width = 800; height = 600; }
    else if (aspect === '3:2') { width = 900; height = 600; }

    // Multiplier for resolution
    let multiplier = 1;
    if (res === 'fhd') multiplier = 1.5;
    else if (res === '2k') multiplier = 2;
    else if (res === '4k') multiplier = 3;

    const finalWidth = Math.round(width * multiplier);
    const finalHeight = Math.round(height * multiplier);

    // Simulate delay
    const delay = 1500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Success Mock using Pollinations.ai
    spinner.style.display = 'none';
    resultPreview.style.opacity = '1';

    const randomSeed = Math.floor(Math.random() * 10000);
    const encodedPrompt = encodeURIComponent(prompt || "abstract artificial intelligence artwork");

    let enhancedPrompt = encodedPrompt;
    if (activeTab === 'image-editing') enhancedPrompt += encodeURIComponent(", high resolution, modified");
    if (activeTab === 'reference') enhancedPrompt += encodeURIComponent(", high quality stylisation");
    if (model.includes('3.0')) enhancedPrompt += encodeURIComponent(", highly detailed masterpiece");

    const imageUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?seed=${randomSeed}&width=${finalWidth}&height=${finalHeight}&nologo=true`;
    lastGeneratedUrl = imageUrl;

    resultPreview.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <img id="final-image" src="${imageUrl}" alt="Result" style="border-radius: 12px; max-width: 100%; max-height: 70vh; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: block; margin: 0 auto;">
            
            <div style="margin-top: 20px; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <div style="padding: 15px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid var(--glass-border); text-align: left; flex: 1; min-width: 300px;">
                    <p style="font-size: 0.95rem; color: var(--text-main); font-weight: 600;">
                        ✅ Готово: ${activeTab}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">
                        <strong>Размер:</strong> ${finalWidth}x${finalHeight} | <strong>Промпт:</strong> ${prompt || 'по умолчанию'}
                    </p>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn" style="background: var(--success); margin: 0;" onclick="saveImage()">
                        💾 Сохранить
                    </button>
                    <button class="btn" style="background: var(--accent); margin: 0;" onclick="useFor('image-editing')">
                        ✨ Редактировать
                    </button>
                    <button class="btn" style="background: var(--primary); margin: 0;" onclick="useFor('reference')">
                        🖼️ Как образец
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

// File Preview handling
function setupFilePreview(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const preview = document.getElementById('result-preview');
                preview.innerHTML = `
                    <div style="text-align: center;">
                        <p style="margin-bottom: 10px; color: var(--primary);">📷 Файл выбран: ${e.target.files[0].name}</p>
                        <img src="${event.target.result}" style="max-height: 200px; border-radius: 8px; border: 1px solid var(--glass-border);">
                    </div>
                `;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
}

setupFilePreview('edit-image-file');
setupFilePreview('ref-files');
