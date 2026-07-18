(function () {
  "use strict";

  let thesisChart = null;

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

  function toRgba(color, alpha) {
    if (!color) {
      return "rgba(31, 119, 180, " + alpha + ")";
    }

    const normalized = color.trim();

    if (/^#([A-Fa-f0-9]{6})$/.test(normalized)) {
      const red = Number.parseInt(normalized.slice(1, 3), 16);
      const green = Number.parseInt(normalized.slice(3, 5), 16);
      const blue = Number.parseInt(normalized.slice(5, 7), 16);
      return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
    }

    if (/^#([A-Fa-f0-9]{3})$/.test(normalized)) {
      const red = Number.parseInt(normalized[1] + normalized[1], 16);
      const green = Number.parseInt(normalized[2] + normalized[2], 16);
      const blue = Number.parseInt(normalized[3] + normalized[3], 16);
      return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
    }

    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(",").map(function (part) {
        return part.trim();
      });
      if (parts.length >= 3) {
        return "rgba(" + parts[0] + ", " + parts[1] + ", " + parts[2] + ", " + alpha + ")";
      }
    }

    return "rgba(31, 119, 180, " + alpha + ")";
  }

  function colorWithAlpha(hexColor, alpha) {
    return toRgba(hexColor, alpha);
  }

  function getAccentColor() {
    const varAccent = getThemeColor("--global-theme-color", "");
    if (varAccent) {
      return varAccent;
    }

    const firstLink = document.querySelector("a");
    if (firstLink) {
      return getComputedStyle(firstLink).color;
    }

    return "#1f77b4";
  }

  function getTextColor() {
    const bodyStyle = getComputedStyle(document.body);
    return bodyStyle.color || "#444444";
  }

  function applyChartTheme(chart, canvas) {
    if (!chart || !canvas) {
      return;
    }

    const accent = getAccentColor();
    const axis = getTextColor();
    const gridBase = getThemeColor("--global-divider-color", axis);

    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, canvas.clientHeight || canvas.height || 320);
    gradient.addColorStop(0, colorWithAlpha(accent, 0.25));
    gradient.addColorStop(1, colorWithAlpha(accent, 0.04));

    const dataset = chart.data.datasets[0];
    dataset.borderColor = accent;
    dataset.backgroundColor = gradient;
    dataset.pointBackgroundColor = accent;
    dataset.pointBorderColor = accent;

    chart.options.scales.x.title.color = axis;
    chart.options.scales.x.ticks.color = axis;
    chart.options.scales.x.grid.color = colorWithAlpha(gridBase, 0.35);
    chart.options.scales.y.title.color = axis;
    chart.options.scales.y.ticks.color = axis;
    chart.options.scales.y.grid.color = colorWithAlpha(gridBase, 0.35);
    chart.options.plugins.legend.labels.color = axis;

    chart.update("none");
  }

  function registerThemeListeners(chart, canvas) {
    const refresh = function () {
      applyChartTheme(chart, canvas);
    };

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme"] });
    }

    const themeToggle = document.getElementById("light-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", function () {
        window.setTimeout(refresh, 0);
        window.setTimeout(refresh, 120);
      });
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", refresh);
    }

    window.addEventListener("resize", function () {
      if (thesisChart) {
        applyChartTheme(thesisChart, canvas);
      }
    });
  }

  async function initializeThesisTracker() {
    setText("phdays", deltaDays("", "03/01/2024"));
    setText("submitdays", deltaDays("02/28/2027", ""));

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

      thesisChart = new Chart(canvas, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Word Count",
              data: points,
              borderColor: "#1f77b4",
              backgroundColor: "rgba(31, 119, 180, 0.12)",
              tension: 0.22,
              fill: true,
              pointRadius: 2.5,
              pointHoverRadius: 4,
              pointBackgroundColor: "#1f77b4",
              pointBorderColor: "#1f77b4",
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
              title: { display: true, text: "Date" },
            },
            y: {
              beginAtZero: false,
              title: { display: true, text: "Words" },
            },
          },
          plugins: {
            legend: {
              display: true,
            },
            tooltip: {
              mode: "index",
              intersect: false,
            },
          },
        },
      });

      applyChartTheme(thesisChart, canvas);
      registerThemeListeners(thesisChart, canvas);
    } catch (error) {
      console.error("Error fetching or plotting word count:", error);
      showError("Unable to load word count data right now. Please try again later.");
    }
  }

  document.addEventListener("DOMContentLoaded", initializeThesisTracker);
})();
