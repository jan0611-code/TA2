const input = document.getElementById("imageInput");
    const preview = document.getElementById("preview");

    input.addEventListener("change", () => {
      preview.innerHTML = ""; // Clear previous images
      Array.from(input.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
          const imgBox = document.createElement("div");
          imgBox.classList.add("img-box");
          const img = document.createElement("img");
          img.src = e.target.result;
          imgBox.appendChild(img);
          preview.appendChild(imgBox);
        };
        reader.readAsDataURL(file);
      });
    });
