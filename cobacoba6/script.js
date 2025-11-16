// ------------------ GLOBALS ------------------
const input = document.getElementById("imageInput");
const container = document.getElementById("container");

const sigmaColorSlider = document.getElementById("sigmaColor");
const sigmaSpaceSlider = document.getElementById("sigmaSpace");
const sigmaColorValue = document.getElementById("sigmaColorValue");
const sigmaSpaceValue = document.getElementById("sigmaSpaceValue");

// Update UI text when sliders move
sigmaColorSlider.oninput = () => sigmaColorValue.textContent = sigmaColorSlider.value;
sigmaSpaceSlider.oninput = () => sigmaSpaceValue.textContent = sigmaSpaceSlider.value;

// ------------------ LOAD VGG16 MODEL ------------------
let vggModel;

async function loadModel() {
  console.log("Loading VGG16 model...");
  vggModel = await vgg16.load();
  console.log("VGG16 loaded.");
}
loadModel();


// ------------------ BILATERAL FILTER FUNCTION ------------------
function applyBilateral(canvas, sigmaColor, sigmaSpace) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  const diameter = 7;
  const radius = Math.floor(diameter / 2);

  function gaussian(x, sigma) {
    return Math.exp(-(x * x) / (2 * sigma * sigma));
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      const r0 = copy[idx];
      const g0 = copy[idx+1];
      const b0 = copy[idx+2];

      let sumR = 0, sumG = 0, sumB = 0, wsum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy, nx = x + dx;

          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const nIdx = (ny * size + nx) * 4;

            const r = copy[nIdx], g = copy[nIdx+1], b = copy[nIdx+2];

            const wSpace = gaussian(Math.sqrt(dx*dx + dy*dy), sigmaSpace);
            const gray0 = (r0 + g0 + b0) / 3;
            const grayN = (r + g + b) / 3;
            const wColor = gaussian(gray0 - grayN, sigmaColor);

            const w = wSpace * wColor;

            sumR += r * w;
            sumG += g * w;
            sumB += b * w;
            wsum += w;
          }
        }
      }

      data[idx] = sumR / wsum;
      data[idx+1] = sumG / wsum;
      data[idx+2] = sumB / wsum;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}


// ------------------ IMAGE UPLOAD HANDLER ------------------
input.addEventListener("change", () => {
  container.innerHTML = "";

  Array.from(input.files).forEach(file => {
    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;

      img.onload = async () => {
        const size = 128;

        // ---- RESIZE CANVAS ----
        const resizeCanvas = document.createElement("canvas");
        resizeCanvas.width = size;
        resizeCanvas.height = size;
        const resizeCtx = resizeCanvas.getContext("2d");
        resizeCtx.drawImage(img, 0, 0, size, size);

        // ---- COPY FOR BILATERAL ----
        const filteredCanvas = document.createElement("canvas");
        filteredCanvas.width = size;
        filteredCanvas.height = size;
        const fctx = filteredCanvas.getContext("2d");
        fctx.drawImage(resizeCanvas, 0, 0);

        // Apply filter
        applyBilateral(filteredCanvas, parseInt(sigmaColorSlider.value), parseInt(sigmaSpaceSlider.value));

        // Re-run filter on slider change
        sigmaColorSlider.oninput = () =>
          applyBilateral(filteredCanvas, parseInt(sigmaColorSlider.value), parseInt(sigmaSpaceSlider.value));

        sigmaSpaceSlider.oninput = () =>
          applyBilateral(filteredCanvas, parseInt(sigmaSpaceSlider.value), parseInt(sigmaColorSlider.value));

        // ---- RUN VGG16 CLASSIFICATION ----
        const tensorImg = tf.browser.fromPixels(resizeCanvas)
          .resizeNearestNeighbor([224, 224])
          .toFloat()
          .expandDims();

        const prediction = vggModel.predict(tensorImg);
        const probs = prediction.dataSync();
        const top = probs.indexOf(Math.max(...probs));

        // ---- DISPLAY CARD ----
        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
          <h3>Original</h3>
          <img src="${img.src}">
          <h3>Bilateral Filtered</h3>
        `;
        card.appendChild(filteredCanvas);

        card.innerHTML += `
          <h3>VGG16 Prediction</h3>
          <p><b>Predicted Class Index:</b> ${top}</p>
        `;

        container.appendChild(card);
      };
    };

    reader.readAsDataURL(file);
  });
});
