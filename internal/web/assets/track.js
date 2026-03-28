/* ============================================================
   box-box — SVG track map renderer
   Track.render(containerId, outlinePoints, carPositions, driverInfo)
   Track.updatePositions(containerId, carPositions)
   ============================================================ */

const Track = (() => {
  // Store rendered state per container
  const state = {};

  function render(containerId, outlinePoints, carPositions, driverInfo) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';

    if (!outlinePoints || outlinePoints.length < 3) {
      el.innerHTML = '<div style="color:#8888aa;text-align:center;padding:2rem;">Track outline not available.</div>';
      return;
    }

    const width  = el.clientWidth  || 500;
    const height = el.clientHeight || 340;
    const PAD    = 32;

    const xScale = d3.scaleLinear().domain([0, 1]).range([PAD, width - PAD]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([PAD, height - PAD]);

    const svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height);

    // Track outline path
    const lineGen = d3.line()
      .x(p => xScale(p.x))
      .y(p => yScale(p.y))
      .curve(d3.curveCatmullRomClosed);

    svg.append('path')
      .datum(outlinePoints)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', '#444466')
      .attr('stroke-width', 8)
      .attr('stroke-linecap', 'round');

    svg.append('path')
      .datum(outlinePoints)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', '#2D2D44')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    // Car group (updated separately)
    svg.append('g').attr('id', `${containerId}-cars`);

    state[containerId] = { svg, xScale, yScale, driverInfo: driverInfo || {} };

    // Initial positions
    if (carPositions && Object.keys(carPositions).length) {
      updatePositions(containerId, carPositions);
    }
  }

  function updatePositions(containerId, carPositions) {
    const s = state[containerId];
    if (!s) return;

    const { svg, xScale, yScale, driverInfo } = s;
    const carsG = svg.select(`#${containerId}-cars`);

    const cars = Object.entries(carPositions || {}).map(([num, pos]) => ({
      num,
      x: pos.x,
      y: pos.y,
      info: driverInfo[num] || {},
    }));

    // Bind data
    const sel = carsG.selectAll('.car-marker').data(cars, d => d.num);

    // Enter
    const enter = sel.enter().append('g').attr('class', 'car-marker');
    enter.append('circle').attr('r', 7);
    enter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 7)
      .attr('font-weight', '700')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none');

    // Update (enter + update)
    const merged = enter.merge(sel);
    merged.transition().duration(500).ease(d3.easeLinear)
      .attr('transform', d => `translate(${xScale(d.x)},${yScale(d.y)})`);

    merged.select('circle')
      .attr('fill', d => '#' + (d.info.TeamColour || '666666'))
      .attr('stroke', '#111')
      .attr('stroke-width', 1);

    merged.select('text')
      .text(d => d.info.Tla || d.num.slice(0, 3));

    // Exit
    sel.exit().remove();
  }

  return { render, updatePositions };
})();
