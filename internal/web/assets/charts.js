/* ============================================================
   box-box — D3 visualization library
   All functions: Charts.renderX(containerId, data)
   Charts re-render on ResizeObserver via stored callbacks.
   ============================================================ */

const Charts = (() => {
  // Compound → fill colour
  const COMPOUND_COLOR = {
    SOFT:         '#FF3333',
    MEDIUM:       '#FFD700',
    HARD:         '#CCCCCC',
    INTERMEDIATE: '#39B54A',
    WET:          '#0080FF',
    UNKNOWN:      '#666688',
  };

  const MARGIN = { top: 32, right: 24, bottom: 32, left: 60 };
  const LABEL_W = 48; // width reserved for driver labels

  // Tooltip element (shared)
  let tooltip = null;
  function getTooltip() {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.style.display = 'none';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }
  function showTooltip(html, e) {
    const t = getTooltip();
    t.innerHTML = html;
    t.style.display = 'block';
    t.style.left = (e.clientX + 12) + 'px';
    t.style.top  = (e.clientY - 8) + 'px';
  }
  function hideTooltip() {
    getTooltip().style.display = 'none';
  }

  // ResizeObserver registry: containerId → callback
  const observers = {};
  function observeResize(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    if (observers[id]) observers[id].disconnect();
    const obs = new ResizeObserver(() => fn());
    obs.observe(el);
    observers[id] = obs;
  }

  // ---- Strategy Gantt chart ----

  function renderStrategy(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el || !data || !data.drivers) return;
    el.innerHTML = '';

    const drivers = (data.drivers || []).filter(d => d.stints && d.stints.length > 0 || d.dns);
    if (drivers.length === 0) { el.textContent = 'No strategy data.'; return; }

    const totalLaps = data.total_laps || 60;
    const rowH    = 28;
    const padding = 4;
    const height  = MARGIN.top + drivers.length * (rowH + padding) + MARGIN.bottom;
    const width   = Math.max(el.clientWidth || 800, 500);

    const svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height);

    const xScale = d3.scaleLinear()
      .domain([1, totalLaps])
      .range([MARGIN.left + LABEL_W, width - MARGIN.right]);

    const yScale = d3.scaleBand()
      .domain(drivers.map(d => d.driver_number))
      .range([MARGIN.top, height - MARGIN.bottom])
      .padding(0.15);

    // SC/VSC zones
    (data.sc_periods || []).forEach(p => {
      svg.append('rect')
        .attr('x', xScale(p.lap_start))
        .attr('y', MARGIN.top)
        .attr('width', xScale(p.lap_end) - xScale(p.lap_start))
        .attr('height', height - MARGIN.top - MARGIN.bottom)
        .attr('fill', p.type === 'VSC' ? 'rgba(80,130,255,0.12)' : 'rgba(255,200,0,0.12)')
        .attr('pointer-events', 'none');
    });

    // Grid lines
    for (let lap = 5; lap <= totalLaps; lap += 5) {
      svg.append('line')
        .attr('x1', xScale(lap)).attr('x2', xScale(lap))
        .attr('y1', MARGIN.top).attr('y2', height - MARGIN.bottom)
        .attr('stroke', '#2D2D44').attr('stroke-width', 1);
    }

    // X-axis
    const xAxis = d3.axisBottom(xScale).ticks(Math.min(20, Math.floor(totalLaps / 5))).tickFormat(d3.format('d'));
    svg.append('g').attr('transform', `translate(0,${height - MARGIN.bottom})`).call(xAxis);

    // Driver rows
    drivers.forEach(driver => {
      const y = yScale(driver.driver_number);
      const rh = yScale.bandwidth();

      // Label
      svg.append('text')
        .attr('x', MARGIN.left + LABEL_W - 6)
        .attr('y', y + rh / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', `#${driver.team_colour || '888888'}`)
        .attr('font-size', 11)
        .attr('font-weight', '700')
        .text(driver.name_acronym || driver.driver_number);

      // DNS: single gray bar
      if (driver.dns) {
        svg.append('rect')
          .attr('x', xScale(1)).attr('y', y + 2)
          .attr('width', xScale(totalLaps) - xScale(1))
          .attr('height', rh - 4)
          .attr('fill', '#333355').attr('rx', 3);
        svg.append('text')
          .attr('x', (xScale(1) + xScale(totalLaps)) / 2).attr('y', y + rh / 2 + 4)
          .attr('text-anchor', 'middle').attr('fill', '#8888aa').attr('font-size', 10)
          .text('DNS');
        return;
      }

      // Stints
      (driver.stints || []).forEach(stint => {
        const x1 = xScale(stint.lap_start);
        const x2 = xScale(stint.lap_end);
        const color = COMPOUND_COLOR[stint.compound] || COMPOUND_COLOR.UNKNOWN;

        const bar = svg.append('rect')
          .attr('x', x1).attr('y', y + 2)
          .attr('width', Math.max(2, x2 - x1))
          .attr('height', rh - 4)
          .attr('fill', color).attr('rx', 3)
          .attr('cursor', 'pointer');

        // DNF: diagonal stripe overlay
        if (driver.dnf && stint === driver.stints[driver.stints.length - 1]) {
          bar.attr('opacity', 0.7);
          // Add simple DNF label
          svg.append('text')
            .attr('x', x2 - 14).attr('y', y + rh / 2 + 4)
            .attr('text-anchor', 'end').attr('fill', '#cc4422')
            .attr('font-size', 9).attr('font-weight', '700').text('DNF');
        }

        bar.on('mousemove', e => {
          const isNew = stint.is_new ? ' (new)' : ` (+${stint.tyre_age_at_start})`;
          showTooltip(
            `<strong>${driver.name_acronym}</strong> — Stint ${stint.stint_number}<br>` +
            `${stint.compound}${isNew}<br>` +
            `Laps ${stint.lap_start}–${stint.lap_end} (${stint.lap_count} laps)`, e
          );
        }).on('mouseleave', hideTooltip);
      });

      // Pit stops
      (driver.pit_stops || []).forEach(pit => {
        svg.append('circle')
          .attr('cx', xScale(pit.lap_number))
          .attr('cy', y + rh / 2)
          .attr('r', 4)
          .attr('fill', '#ffffff').attr('stroke', '#000').attr('stroke-width', 1)
          .attr('cursor', 'pointer')
          .on('mousemove', e => {
            showTooltip(
              `Pit lap ${pit.lap_number}<br>` +
              `Stop: ${pit.stop_duration?.toFixed(2)}s &nbsp; Lane: ${pit.lane_duration?.toFixed(2)}s`, e
            );
          })
          .on('mouseleave', hideTooltip);
      });
    });

    observeResize(containerId, () => renderStrategy(containerId, data));
  }

  // ---- Lap time progression chart ----

  function renderLapTimes(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el || !data || !data.drivers) return;
    el.innerHTML = '';

    const drivers = data.drivers || [];
    if (!drivers.length) { el.textContent = 'No lap time data.'; return; }

    const ML = MARGIN.left + 10;
    const MT = MARGIN.top;
    const MB = MARGIN.bottom + 20;
    const MR = MARGIN.right;
    const width  = Math.max(el.clientWidth || 800, 400);
    const height = 300;

    const svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height);

    // Collect all valid laps for domain calculation
    const allLaps = drivers.flatMap(d =>
      (d.laps || []).filter(l => l.lap_duration && !l.is_pit_out_lap)
        .map(l => ({ lapNum: l.lap_number, t: l.lap_duration }))
    );
    if (!allLaps.length) { el.textContent = 'No lap data.'; return; }

    const maxLap = d3.max(allLaps, l => l.lapNum) || 1;
    const yMin   = d3.min(allLaps, l => l.t);
    const yMax   = d3.max(allLaps, l => l.t);

    const xScale = d3.scaleLinear().domain([1, maxLap]).range([ML, width - MR]);
    const yScale = d3.scaleLinear()
      .domain([yMin * 0.995, yMax * 1.005])
      .range([height - MB, MT]);

    // SC zones
    (data.sc_periods || []).forEach(p => {
      svg.append('rect')
        .attr('x', xScale(p.lap_start)).attr('y', MT)
        .attr('width', xScale(p.lap_end) - xScale(p.lap_start))
        .attr('height', height - MT - MB)
        .attr('fill', 'rgba(255,200,0,0.10)').attr('pointer-events', 'none');
    });

    // Axes
    svg.append('g').attr('transform', `translate(0,${height - MB})`).call(
      d3.axisBottom(xScale).ticks(Math.min(20, maxLap)).tickFormat(d3.format('d'))
    );
    svg.append('g').attr('transform', `translate(${ML},0)`).call(
      d3.axisLeft(yScale).ticks(6).tickFormat(t => {
        const m = Math.floor(t / 60);
        const s = (t - m * 60).toFixed(1);
        return `${m}:${s.padStart(4, '0')}`;
      })
    );

    // Per-driver lines
    const driverVisible = {};
    drivers.forEach(d => { driverVisible[d.driver_number] = true; });

    const lineGen = d3.line()
      .defined(l => l.lap_duration != null && !l.is_pit_out_lap)
      .x(l => xScale(l.lap_number))
      .y(l => yScale(l.lap_duration));

    const paths = {};
    drivers.forEach(driver => {
      const color = '#' + (driver.team_colour || '888888');
      const path = svg.append('path')
        .datum(driver.laps || [])
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', lineGen);
      paths[driver.driver_number] = path;

      // Pit lap circles
      const pitNums = new Set((data.pit_laps || {})[String(driver.driver_number)] || []);
      (driver.laps || []).filter(l => pitNums.has(l.lap_number) && l.lap_duration).forEach(l => {
        svg.append('circle')
          .attr('cx', xScale(l.lap_number)).attr('cy', yScale(l.lap_duration))
          .attr('r', 4).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);
      });
    });

    // Crosshair tooltip
    const crosshair = svg.append('line')
      .attr('y1', MT).attr('y2', height - MB)
      .attr('stroke', '#8888aa').attr('stroke-width', 1).attr('display', 'none');

    svg.append('rect')
      .attr('x', ML).attr('y', MT)
      .attr('width', width - ML - MR).attr('height', height - MT - MB)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .on('mousemove', e => {
        const [mx] = d3.pointer(e);
        const lapNum = Math.round(xScale.invert(mx));
        crosshair.attr('x1', xScale(lapNum)).attr('x2', xScale(lapNum)).attr('display', null);
        const tips = drivers.map(d => {
          const lap = (d.laps || []).find(l => l.lap_number === lapNum);
          if (!lap || !lap.lap_duration) return '';
          const m = Math.floor(lap.lap_duration / 60);
          const s = (lap.lap_duration - m * 60).toFixed(3);
          return `<span style="color:#${d.team_colour||'888888'}">${d.name_acronym}</span>: ${m}:${s.padStart(6,'0')}`;
        }).filter(Boolean).join('<br>');
        if (tips) showTooltip(`<strong>Lap ${lapNum}</strong><br>${tips}`, e);
      })
      .on('mouseleave', () => { crosshair.attr('display', 'none'); hideTooltip(); });

    // Legend with toggle
    const legendG = svg.append('g').attr('transform', `translate(${ML},${MT - 20})`);
    let lx = 0;
    drivers.forEach(driver => {
      const color = '#' + (driver.team_colour || '888888');
      const g = legendG.append('g').attr('transform', `translate(${lx},0)`).attr('cursor', 'pointer');
      g.append('rect').attr('width', 12).attr('height', 12).attr('fill', color).attr('rx', 2);
      g.append('text').attr('x', 15).attr('y', 10).attr('fill', color).attr('font-size', 11)
        .text(driver.name_acronym || driver.driver_number);
      lx += 60;

      g.on('click', () => {
        const visible = !driverVisible[driver.driver_number];
        driverVisible[driver.driver_number] = visible;
        paths[driver.driver_number].attr('opacity', visible ? 1 : 0.15);
        g.attr('opacity', visible ? 1 : 0.4);
      });
    });

    observeResize(containerId, () => renderLapTimes(containerId, data));
  }

  // ---- Telemetry 4-panel chart ----

  function renderTelemetry(containerId, driversData) {
    const el = document.getElementById(containerId);
    if (!el || !driversData || !driversData.length) return;
    el.innerHTML = '';

    const panelConfigs = [
      { key: 'speed',    label: 'Speed (km/h)', height: 120, yKey: 'Speed'    },
      { key: 'throttle', label: 'Throttle (%)', height:  80, yKey: 'Throttle' },
      { key: 'brake',    label: 'Brake (%)',    height:  80, yKey: 'Brake'     },
      { key: 'gear',     label: 'Gear',         height:  60, yKey: 'NGear'     },
    ];

    const GAP = 10;
    const totalHeight = panelConfigs.reduce((s, p) => s + p.height, 0) + GAP * (panelConfigs.length - 1) + MARGIN.top + MARGIN.bottom;
    const width = Math.max(el.clientWidth || 800, 400);
    const ML = MARGIN.left + 10;
    const MR = MARGIN.right;

    const svg = d3.select(el).append('svg').attr('width', width).attr('height', totalHeight);

    // Compute distances from speed + time for all drivers, pick max dist
    const driverSeries = driversData.map(d => {
      const pts = computeDistanceSeries(d.data || []);
      return { ...d, pts };
    });
    const maxDist = d3.max(driverSeries, d => d.pts.length > 0 ? d.pts[d.pts.length - 1].dist : 0) || 1;

    const xScale = d3.scaleLinear().domain([0, maxDist]).range([ML, width - MR]);

    let yOffset = MARGIN.top;
    panelConfigs.forEach((panel, pi) => {
      const ph = panel.height;
      const g = svg.append('g').attr('transform', `translate(0,${yOffset})`);

      // Y domain
      const allVals = driverSeries.flatMap(d => d.pts.map(p => p[panel.yKey] ?? 0));
      let yMin = d3.min(allVals) ?? 0;
      let yMax = d3.max(allVals) ?? 1;
      if (panel.key === 'throttle' || panel.key === 'brake') { yMin = 0; yMax = 100; }
      if (panel.key === 'gear') { yMin = 0; yMax = 8; }
      const yScale = d3.scaleLinear().domain([yMin, yMax]).range([ph, 0]);

      // Panel background
      g.append('rect').attr('x', ML).attr('y', 0)
        .attr('width', width - ML - MR).attr('height', ph)
        .attr('fill', '#1B1B2F').attr('rx', 4);

      // Label
      g.append('text').attr('x', ML - 8).attr('y', ph / 2 + 4)
        .attr('text-anchor', 'end').attr('fill', '#8888aa').attr('font-size', 10)
        .text(panel.label);

      // Y axis (right side of first panel)
      if (pi === 0) {
        g.append('g').attr('transform', `translate(${width - MR},0)`)
          .call(d3.axisRight(yScale).ticks(4));
      }

      // Lines
      const lineGen = d3.line()
        .x(p => xScale(p.dist))
        .y(p => yScale(p[panel.yKey] ?? 0))
        .defined(p => p[panel.yKey] != null);

      driverSeries.forEach(driver => {
        if (!driver.pts.length) return;
        g.append('path')
          .datum(driver.pts)
          .attr('fill', 'none')
          .attr('stroke', '#' + (driver.teamColour || '888888'))
          .attr('stroke-width', 1.5)
          .attr('d', lineGen);
      });

      // X axis only on last panel
      if (pi === panelConfigs.length - 1) {
        g.append('g').attr('transform', `translate(0,${ph})`).call(
          d3.axisBottom(xScale).ticks(8).tickFormat(d => `${Math.round(d / 1000)}k`)
        );
      }

      yOffset += ph + GAP;
    });

    // Shared crosshair
    const crosslines = panelConfigs.map((panel, pi) => {
      const g = svg.select(`g:nth-of-type(${pi + 1})`);
      return svg.append('line')
        .attr('y1', MARGIN.top + panelConfigs.slice(0, pi).reduce((s, p) => s + p.height + GAP, 0))
        .attr('y2', MARGIN.top + panelConfigs.slice(0, pi + 1).reduce((s, p) => s + p.height + GAP, 0) - GAP)
        .attr('stroke', '#8888aa').attr('stroke-width', 1).attr('display', 'none');
    });

    svg.append('rect')
      .attr('x', ML).attr('y', MARGIN.top)
      .attr('width', width - ML - MR).attr('height', totalHeight - MARGIN.top - MARGIN.bottom)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .on('mousemove', e => {
        const [mx] = d3.pointer(e);
        crosslines.forEach(l => l.attr('x1', mx).attr('x2', mx).attr('display', null));
        const dist = xScale.invert(mx);
        const tips = driverSeries.map(d => {
          const pt = d.pts.find(p => p.dist >= dist);
          if (!pt) return '';
          return `<span style="color:#${d.teamColour||'888888'}">${d.nameAcronym}</span>: ` +
            `${pt.Speed}km/h T${pt.Throttle}% B${pt.Brake}% G${pt.NGear}`;
        }).filter(Boolean).join('<br>');
        if (tips) showTooltip(tips, e);
      })
      .on('mouseleave', () => {
        crosslines.forEach(l => l.attr('display', 'none'));
        hideTooltip();
      });

    observeResize(containerId, () => renderTelemetry(containerId, driversData));
  }

  // Compute cumulative distance from car data samples.
  function computeDistanceSeries(samples) {
    if (!samples.length) return [];
    const pts = [];
    let dist = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i > 0) {
        const prev = samples[i - 1];
        const dt = (new Date(s.date) - new Date(prev.date)) / 1000; // seconds
        if (dt > 0 && dt < 5) { // ignore large gaps
          dist += (s.speed / 3.6) * dt; // speed in km/h → m/s * dt → metres
        }
      }
      pts.push({
        dist,
        Speed:    s.speed    ?? 0,
        Throttle: s.throttle ?? 0,
        Brake:    s.brake    ?? 0,
        NGear:    s.n_gear   ?? 0,
      });
    }
    return pts;
  }

  return { renderStrategy, renderLapTimes, renderTelemetry };
})();
