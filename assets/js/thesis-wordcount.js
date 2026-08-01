(function () {
  "use strict";

  let thesisChart = null;
  let palettePoller = null;

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
    // Prefer variables defined on the root element, but also check body
    // because some themes toggle colors by adding classes to the body.
    let computed = getComputedStyle(document.documentElement);
    let value = (computed && computed.getPropertyValue) ? computed.getPropertyValue(name).trim() : "";
    if (value) {
      return value;
    }

    if (document.body) {
      computed = getComputedStyle(document.body);
      value = (computed && computed.getPropertyValue) ? computed.getPropertyValue(name).trim() : "";
      if (value) {
        return value;
      }
    }

    return fallback;
  }

  function normalizeColor(color, fallback) {
    if (!color) {
      return fallback;
    }

    const probe = document.createElement("span");
    probe.style.color = color;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const normalized = getComputedStyle(probe).color;
    probe.remove();

    return normalized || fallback;
  }

  function toRgba(color, alpha) {
    const normalized = normalizeColor(color, "rgb(31, 119, 180)");
    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch) {
      return "rgba(31, 119, 180, " + alpha + ")";
    }

    const parts = rgbMatch[1].split(",").map(function (part) {
      return part.trim();
    });

    if (parts.length < 3) {
      return "rgba(31, 119, 180, " + alpha + ")";
    }

    return "rgba(" + parts[0] + ", " + parts[1] + ", " + parts[2] + ", " + alpha + ")";
  }

  function colorWithAlpha(hexColor, alpha) {
    return toRgba(hexColor, alpha);
  }

  function getAccentColor() {
    // const varAccent = getThemeColor("--global-theme-color", "");
    // if (varAccent) {
    //   return normalizeColor(varAccent, "rgb(31, 119, 180)");
    // }
    // Return medium grey that is visible on light and dark themes
    return "rgb(124, 118, 128)";

    const firstLink = document.querySelector("a");
    if (firstLink) {
      return normalizeColor(getComputedStyle(firstLink).color, "rgb(31, 119, 180)");
    }

    return "rgb(31, 119, 180)";
  }

  function getTextColor() {
    const bodyStyle = getComputedStyle(document.body);
    return normalizeColor(bodyStyle.color, "rgb(68, 68, 68)");
  }

  function getPaletteSignature() {
    return [
      getAccentColor(),
      getTextColor(),
      normalizeColor(getThemeColor("--global-divider-color", ""), "rgb(221, 221, 221)"),
      normalizeColor(getComputedStyle(document.body).backgroundColor, "rgb(255, 255, 255)"),
    ].join("|");
  }

  function applyChartTheme(chart, canvas) {
    if (!chart || !canvas) {
      return;
    }

    const accent = getAccentColor();
    const axis = getTextColor();
    const gridBase = normalizeColor(getThemeColor("--global-divider-color", ""), axis);

    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, canvas.clientHeight || canvas.height || 320);
    gradient.addColorStop(0, colorWithAlpha(accent, 0.25));
    gradient.addColorStop(1, colorWithAlpha(accent, 0.04));

    const dataset = chart.data.datasets[0];
    dataset.borderColor = accent;
    dataset.backgroundColor = gradient;
    dataset.pointBackgroundColor = accent;
    dataset.pointBorderColor = accent;
    dataset.pointHoverBackgroundColor = accent;
    dataset.pointHoverBorderColor = accent;

    chart.options.elements = chart.options.elements || {};
    chart.options.elements.point = chart.options.elements.point || {};
    chart.options.elements.point.backgroundColor = accent;
    chart.options.elements.point.borderColor = accent;
    chart.options.elements.point.hoverBackgroundColor = accent;
    chart.options.elements.point.hoverBorderColor = accent;

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
    let previousSignature = getPaletteSignature();

    const refresh = function () {
      applyChartTheme(chart, canvas);
      previousSignature = getPaletteSignature();
    };

    const refreshIfPaletteChanged = function () {
      const nextSignature = getPaletteSignature();
      if (nextSignature !== previousSignature) {
        refresh();
      }
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

    if (palettePoller) {
      window.clearInterval(palettePoller);
    }
    palettePoller = window.setInterval(refreshIfPaletteChanged, 400);
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
      showError(error.stack || error.message || String(error));
    }
  }

  document.addEventListener("DOMContentLoaded", initializeThesisTracker);
})();
