document.addEventListener("DOMContentLoaded", () => {
  const openButtons = document.querySelectorAll(".open-btn");
  const panel = document.getElementById("sim-panel");
  const closeBtn = document.getElementById("close-panel");
  const simTitle = document.getElementById("sim-title");
  const simBody = document.getElementById("sim-body");

  openButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      panel.classList.remove("hidden");

      if (target === "bar") {
        simTitle.textContent = "Simulador: Imán de barra";
        simBody.innerHTML = `
          <p>Este módulo mostrará el campo magnético de un imán de barra.</p>
          <p>(Próximamente animación de líneas de campo).</p>
        `;
      } else if (target === "electro") {
        simTitle.textContent = "Simulador: Electroimán";
        simBody.innerHTML = `
          <p>Este módulo mostrará el funcionamiento de un electroimán al activar o desactivar la corriente.</p>
          <p>(Próximamente controles y animación).</p>
        `;
      }
    });
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });
});
