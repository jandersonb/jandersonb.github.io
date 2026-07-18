---
layout: page
title: thesis
permalink: /thesis/
description: Thesis page and progress tracking.
nav: true
nav_order: 4
---

## Thesis word count

I have been a PhD candidate for <strong id="phdays">...</strong> days.
My target submission date is in <strong id="submitdays">...</strong> days.

This tracker updates automatically every time my thesis repo is committed.
My thesis draft currently has a word count of <strong id="wordcount">...</strong>.

<canvas id="wordcountPlot" width="600" height="400" aria-label="Word count over time"></canvas>

<p id="wordcountError" style="display: none; color: #b00020; margin-top: 1rem;"></p>

This page is inspired by <a href="https://ordinarystarman.com/PhD/">Sean Richards' PhD Thesis tracker</a>.

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
<script src="{{ '/assets/js/thesis-wordcount.js' | relative_url }}"></script>

<style>
	#wordcountPlot {
		display: block;
		width: 100%;
		height: clamp(220px, 36vw, 320px);
		max-height: 320px;
		margin-top: 1rem;
	}
</style>
