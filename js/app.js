const MODEL_URL = "https://teachablemachine.withgoogle.com/models/id9fnVeCr/";

const DESCRIPTIONS = {
  "아랍상": "뚜렷하고 강한 이목구비가 특징입니다. 높은 콧대와 짙은 눈썹, 선명한 눈매를 가지고 있으며 이국적인 매력이 넘칩니다. 깊고 입체적인 얼굴 윤곽이 강한 인상을 줍니다.",
  "두부상": "사각형에 가까운 단단한 얼굴형이 특징입니다. 넓은 이마와 탄탄한 턱선에서 안정감과 신뢰감이 느껴집니다. 묵직하고 든든한 존재감을 가진 인상입니다.",
};

let model = null;
let uploadedImage = null;

const uploadArea   = document.getElementById("uploadArea");
const fileInput    = document.getElementById("fileInput");
const previewArea  = document.getElementById("previewArea");
const previewImg   = document.getElementById("previewImg");
const resetBtn     = document.getElementById("resetBtn");
const analyzeBtn   = document.getElementById("analyzeBtn");
const resultSection = document.getElementById("resultSection");
const loadingEl    = document.getElementById("loading");

// --- Upload interaction ---
uploadArea.addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("drag-over");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) loadImageFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) loadImageFile(file);
});

resetBtn.addEventListener("click", () => {
  uploadedImage = null;
  previewImg.src = "";
  fileInput.value = "";
  previewArea.style.display = "none";
  uploadArea.style.display = "";
  analyzeBtn.disabled = true;
  resultSection.style.display = "none";
});

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    uploadedImage = previewImg;
    uploadArea.style.display = "none";
    previewArea.style.display = "";
    analyzeBtn.disabled = false;
    resultSection.style.display = "none";
  };
  reader.readAsDataURL(file);
}

// --- Model loading ---
async function loadModel() {
  if (model) return;
  try {
    const modelURL    = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";
    model = await tmImage.load(modelURL, metadataURL);
  } catch (err) {
    console.error("모델 로드 실패:", err);
    alert("모델을 불러오는 데 실패했습니다. 인터넷 연결을 확인해주세요.");
    throw err;
  }
}

// --- Analysis ---
analyzeBtn.addEventListener("click", async () => {
  if (!uploadedImage) return;

  analyzeBtn.disabled = true;
  loadingEl.style.display = "";
  resultSection.style.display = "none";

  try {
    await loadModel();

    // Teachable Machine expects an HTMLImageElement or canvas
    const predictions = await model.predict(previewImg);

    // Sort descending by probability
    predictions.sort((a, b) => b.probability - a.probability);

    const top = predictions[0];
    const topClass = top.className;
    const topProb  = top.probability;

    showResult(topClass, topProb, predictions);
  } catch (err) {
    console.error("분석 오류:", err);
    alert("분석 중 오류가 발생했습니다.");
  } finally {
    loadingEl.style.display = "none";
    analyzeBtn.disabled = false;
  }
});

function showResult(topClass, topProb, allPredictions) {
  const isArab = topClass === "아랍상";
  const colorClass = isArab ? "arab" : "tofu";

  // Result class label
  const resultClassEl = document.getElementById("resultClass");
  resultClassEl.textContent = topClass;
  resultClassEl.className = `result-class ${colorClass}`;

  // Confidence bar
  const bar = document.getElementById("confidenceBar");
  bar.style.width = "0%";
  bar.className = `confidence-bar${isArab ? "" : " tofu-bar"}`;
  setTimeout(() => { bar.style.width = `${(topProb * 100).toFixed(1)}%`; }, 50);

  document.getElementById("confidenceText").textContent =
    `신뢰도 ${(topProb * 100).toFixed(1)}%`;

  // Description
  const descEl = document.getElementById("resultDescription");
  descEl.textContent = DESCRIPTIONS[topClass] || "";
  descEl.className = `result-description${isArab ? "" : " tofu-desc"}`;

  // All scores
  const scoresEl = document.getElementById("allScores");
  scoresEl.innerHTML = allPredictions.map((p) => {
    const isTop = p.className === topClass;
    const pct = (p.probability * 100).toFixed(1);
    return `
      <div class="score-row">
        <span class="score-name">${p.className}</span>
        <div class="score-bar-wrap">
          <div class="score-bar${isTop ? ` top${isArab ? "" : " tofu-top"}` : ""}"
               style="width:${pct}%"></div>
        </div>
        <span class="score-pct">${pct}%</span>
      </div>`;
  }).join("");

  resultSection.style.display = "";
}
