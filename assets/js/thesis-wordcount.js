(function () {
  "use strict";

  function deltaDays(fromDate, toDate) {
    const first = fromDate ? new Date(fromDate) : new Date();
    const second = toDate ? new Date(toDate) : new Date();
    return Math.floor((first.getTime() - second.getTime()) / (1000 * 3600 * 24));
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function showError(message) {
    const errorEl = document.getElementById("wordcountError");
    if (!errorEl) {
      return;
    }
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }

  function getThemeColor(name, fallback) {
    const computed = getComputedStyle(document.documentElement);
    const value = computed.getPropertyValue(name).trim();
    return value || fallback;
  }

  function colorWithAlpha(hexColor, alpha) {
    if (!/^#([A-Fa-f0-9]{6})$/.test(hexColor)) {
      return "rgba(31, 119, 180, " + alpha + ")";
    }

    const red = Number.parseInt(hexColor.slice(1, 3), 16);
    const green = Number.parseInt(hexColor.slice(3, 5), 16);
    const blue = Number.parseInt(hexColor.slice(5, 7), 16);

    return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
  }

  async function initializeThesisTracker() {
    setText("phdays", deltaDays("", "03/01/2024"));
    setText("submitdays", deltaDays("02/28/2027", ""));

    const accent = getThemeColor("--global-theme-color", "#1f77b4");
    const axis = getThemeColor("--global-text-color", "#444444");
    const grid = getThemeColor("--global-divider-color", "#dddddd");

    try {
      const response = await fetch("https://jandersonb.github.io/phd-thesis/wordcount.txt?nocache=" + Date.now());
      if (!response.ok) {
        throw new Error("Failed to fetch file: " + response.status);
      }

      const text = await response.text();
      const lines = text.trim().split("\n");
      const points = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length !== 2) {
          continue;
        }

        const date = new Date(parts[0]);
        const count = Number.parseInt(parts[1], 10);

        if (!Number.isNaN(date.getTime()) && !Number.isNaN(count)) {
          points.push({ x: date, y: count });
        }
      }

      if (points.length === 0) {
        showError("No word count data points were found in the source file.");
        return;
      }

      setText("wordcount", points[points.length - 1].y);

      const canvas = document.getElementById("wordcountPlot");
      if (!canvas) {
        showError("Chart container not found on page.");
        return;
      }

      const gradient = canvas.getContext("2d").createLinearGradient(0, 0, 0, canvas.height || 400);
      gradient.addColorStop(0, colorWithAlpha(accent, 0.25));
      gradient.addColorStop(1, colorWithAlpha(accent, 0.04));

      new Chart(canvas, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Word Count",
              data: points,
              borderColor: accent,
              backgroundColor: gradient,
              tension: 0.22,
              fill: true,
              pointRadius: 2.5,
              pointHoverRadius: 4,
              pointBackgroundColor: accent,
              pointBorderColor: accent,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: {
              type: "time",
              time: {
                unit: "day",
                tooltipFormat: "dd MMM yyyy HH:mm",
                displayFormats: { day: "dd MMM yyyy" },
              },
              title: { display: true, text: "Date", color: axis },
              ticks: { color: axis },
              grid: { color: colorWithAlpha(grid.startsWith("#") ? grid : "#dddddd", 0.35) },
            },
            y: {
              beginAtZero: false,
              title: { display: true, text: "Words", color: axis },
              ticks: { color: axis },
              grid: { color: colorWithAlpha(grid.startsWith("#") ? grid : "#dddddd", 0.35) },
            },
          },
          plugins: {
            legend: {
              display: true,
              labels: { color: axis },
            },
            tooltip: {
              mode: "index",
              intersect: false,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error fetching or plotting word count:", error);
      showError("Unable to load word count data right now. Please try again later.");
    }
  }

  document.addEventListener("DOMContentLoaded", initializeThesisTracker);
})();
