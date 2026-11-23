/* =========================================================
   Dumbbell plot (Highcharts) – reads data.csv
   ========================================================= */

// ---------- EASY-TO-EDIT SETTINGS ----------
const CONFIG = {
  csvFile:     'data.csv',     // path to the CSV (relative to index.html)
  color2022:   '#1F77B4',      // dots for 2022 (blue)
  color2024:   '#FF7F0E',      // dots for 2024 (orange)
  lineColor:   '#B0B0B0',      // connecting line
  lineWidth:   3,
  dotRadius:   6,
  stripeColor: '',             // shading on every other row; '' for none (was '#F4F6F8')
  plotBgColor: '#F2F2F2',      // background of the plot panel only (light grey)
  title:       'Test Plot: Percent Values for 2022 and 2024, Citywide and by Race/Ethnicity',   // chart title (leave '' for none)
  textColor:   '#000000',      // color of all chart text (title, axis labels, legend)
  titleFontSize:     '22px',   // chart title (was 18px)
  legendFontSize:    '15px',   // legend items (was 12px, the Highcharts default)
  axisLabelFontSize: '15px',   // tick labels on both axes (were 13px / 11px)
  axisTitleFontSize: '16px',   // axis title, e.g. "Percent" (was 12px, the default)
  xAxisTitle:  'Percent',      // title for the value axis
  valueSuffix: '%',            // added after values in tooltips/labels
  markSignificant: true,
  downloadName: 'data.csv',    // file name used when the CSV is downloaded from the chart menu       // add the Significance value to category labels

  // Line types for the connecting lines, one per distinct "Demographic" value.
  // Values get styles in the order they first appear in the CSV; if there are
  // more Demographic values than styles, the list starts over.
  // Valid Highcharts styles: 'Solid', 'ShortDash', 'ShortDot', 'ShortDashDot',
  // 'ShortDashDotDot', 'Dot', 'Dash', 'LongDash', 'DashDot', 'LongDashDot', 'LongDashDotDot'
  dashStyles: ['Solid', 'ShortDash', 'Dot', 'DashDot', 'LongDash', 'ShortDot', 'LongDashDot'],
  // Optional: pin a style to a specific Demographic value (overrides the list above),
  // e.g. { 'Citywide': 'Solid', 'Race/Ethnicity': 'Dash' }
  dashStyleOverrides: {},
  showLineTypeLegend: true,    // add a legend entry for each line type

  // Significance marker (e.g. "*") drawn above the middle of each connecting line
  showSignificanceOnChart: true,
  sigFontSize:  '18px',        // size of the marker
  sigOffset:    6              // pixels up (negative) or down (positive) from the line
};
// -------------------------------------------

/* ---------------------------------------------------------
   STEP 1: PARSE THE CSV TEXT
   Turns the raw text of the CSV file into a list of rows.
   Each row becomes an object whose keys are the column names, e.g.
     { Demographic: 'Citywide', Category: 'Citywide', '2022': '10.1',
       '2024': '12', Percentage_Point_Change: '1.9', Significance: '*' }
   Commas inside a cell are supported when the cell is wrapped in
   double quotes, which is how Excel and most tools save such cells:
     Race/Ethnicity,"Hispanic, Any Race",12.7,15,2.3,*
   A double quote inside a quoted cell is written as two quotes ("").
   --------------------------------------------------------- */

/* Splits the whole CSV text into a list of lines, each a list of cells.
   Reads one character at a time and keeps track of whether it is inside
   a quoted cell, so commas and line breaks inside quotes are kept as text. */
function splitCSV(text) {
  const lines = [];
  let cells = [];        // cells of the line being read
  let cell = '';         // text of the cell being read
  let inQuotes = false;  // true while inside a "quoted" cell

  // Remove an invisible byte-order mark that Excel sometimes adds at the start
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }  // "" -> one quote
        else inQuotes = false;                         // closing quote
      } else {
        cell += ch;                                    // any other character, commas included
      }
    } else if (ch === '"') {
      inQuotes = true;                                 // opening quote
    } else if (ch === ',') {
      cells.push(cell); cell = '';                     // end of a cell
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;    // treat "\r\n" as one line break
      cells.push(cell); cell = '';                     // end of a line
      lines.push(cells); cells = [];
    } else {
      cell += ch;
    }
  }
  // The last line may not end with a line break
  if (cell !== '' || cells.length) { cells.push(cell); lines.push(cells); }

  // Drop blank lines (e.g. empty lines at the end of the file)
  return lines.filter(c => !(c.length === 1 && c[0].trim() === ''));
}

function parseCSV(text) {
  // Split the text into lines and cells (handles quoted commas)
  const lines = splitCSV(text);

  // The first line holds the column names; trim stray spaces from each name
  const headers = lines[0].map(h => h.trim());

  // Every line after the first is a data row
  const dataLines = lines.slice(1);

  // Convert each data line into an object
  const rows = dataLines.map(cells => {
    const row = {};                    // empty object to fill in
    headers.forEach((header, i) => {
      // Match each cell to its column name. If a cell is missing
      // (e.g. an empty Significance at the end of a line), use ''
      row[header] = (cells[i] || '').trim();
    });
    return row;
  });

  return rows;
}

/* ---------------------------------------------------------
   STEP 2: PREPARE THE CHART DATA AND DRAW THE CHART
   --------------------------------------------------------- */
function buildChart(rows) {
  const n = rows.length;

  // Category labels for the vertical axis (from the "Category" column).
  // If markSignificant is on, add the Significance value (e.g. "*")
  // to the end of the label when that cell isn't empty
  const categories = rows.map(r =>
    //CONFIG.markSignificant && r.Significance ? r.Category + r.Significance : r.Category
    CONFIG.markSignificant && r.Significance ? r.Category : r.Category
  );

  // Line type for each distinct "Demographic" value, e.g.
  //   { 'Citywide': 'Solid', 'Race/Ethnicity': 'ShortDash' }
  // Works for any number of Demographic values (styles repeat if needed)
  const demographics = [...new Set(rows.map(r => r.Demographic))];
  const dashByDemographic = {};
  demographics.forEach((d, i) => {
    dashByDemographic[d] = CONFIG.dashStyleOverrides[d] ||
      CONFIG.dashStyles[i % CONFIG.dashStyles.length];
  });

  // Connector lines: one per category, from the 2022 value to the 2024 value,
  // drawn in the line type of that row's Demographic
  const connectors = rows.map(r => ({
    low:  parseFloat(r['2022']),
    high: parseFloat(r['2024']),
    dashStyle: dashByDemographic[r.Demographic]
  }));

  // Significance markers: an invisible point halfway between the two dots,
  // labeled with the "Significance" value. Rows with an empty Significance are skipped.
  const sigPoints = rows
    .map((r, i) => ({
      x: i,
      y: (parseFloat(r['2022']) + parseFloat(r['2024'])) / 2,   // midpoint of the line
      sig: r.Significance
    }))
    .filter(p => CONFIG.showSignificanceOnChart && p.sig !== '');

  // Legend-only entries (no data) that show which line type is which Demographic
  const lineTypeLegend = CONFIG.showLineTypeLegend ? demographics.map(d => ({
    type: 'line',
    name: d,
    data: [],
    color: CONFIG.lineColor,
    lineWidth: CONFIG.lineWidth,
    dashStyle: dashByDemographic[d],
    marker: { enabled: false },
    enableMouseTracking: false,
    events: { legendItemClick: function () { return false; } }   // not clickable
  })) : [];

  // Dots for each year. Each dot stores:
  //   x            -> which category (row number) it belongs to
  //   y            -> its value from the "2022" or "2024" column
  //   change       -> the "Percentage_Point_Change" column (for hover text)
  //   significance -> the "Significance" column, whatever it contains (for hover text)
  const dots2022 = rows.map((r, i) => ({
    x: i,
    y: parseFloat(r['2022']),
    change: r.Percentage_Point_Change,
    significance: r.Significance
  }));
  const dots2024 = rows.map((r, i) => ({
    x: i,
    y: parseFloat(r['2024']),
    change: r.Percentage_Point_Change,
    significance: r.Significance
  }));

  // Shading on every other category
  const stripes = [];
  if (CONFIG.stripeColor) {
    for (let i = 1; i < n; i += 2) {
      stripes.push({ from: i - 0.5, to: i + 0.5, color: CONFIG.stripeColor });
    }
  }

  Highcharts.chart('container', {
    chart: {
      inverted: true,            // categories on the vertical axis
      backgroundColor: 'transparent',
      plotBackgroundColor: CONFIG.plotBgColor,   // plot panel background
      style: { fontFamily: 'Arial, Helvetica, sans-serif' }
    },
    title: {
      text: CONFIG.title || null,
      style: { color: CONFIG.textColor, fontSize: CONFIG.titleFontSize, fontWeight: 'bold' }
    },
    credits: { enabled: false },

    // Chart menu (top right): the standard items plus a "Download data (CSV)" item
    // that downloads the original CSV file
    exporting: {
      menuItemDefinitions: {
        downloadSourceCSV: {
          text: 'Download data (CSV)',
          onclick: function () {
            const link = document.createElement('a');
            link.href = CONFIG.csvFile;
            link.download = CONFIG.downloadName;
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
        }
      },
      buttons: {
        contextButton: {
          menuItems: Highcharts.getOptions().exporting.buttons.contextButton.menuItems
            .concat(['separator', 'downloadSourceCSV'])
        }
      }
    },
    legend: {
      enabled: true, align: 'center', verticalAlign: 'top',
      itemStyle: { color: CONFIG.textColor, fontSize: CONFIG.legendFontSize }
    },

    // In an inverted chart, xAxis is the vertical (category) axis
    xAxis: {
      categories: categories,
      tickPositions: rows.map((r, i) => i),   // one label per category, no extras
      lineWidth: 0,
      tickLength: 0,
      plotBands: stripes,
      labels: { style: { fontSize: CONFIG.axisLabelFontSize, color: CONFIG.textColor, fontWeight: 'bold' } }
    },
    // ...and yAxis is the horizontal (value) axis
    yAxis: {
      title: { text: CONFIG.xAxisTitle, style: { color: CONFIG.textColor, fontSize: CONFIG.axisTitleFontSize } },
      labels: { format: '{value}' + CONFIG.valueSuffix, style: { color: CONFIG.textColor, fontSize: CONFIG.axisLabelFontSize } },
      gridLineWidth: 0,
      gridLineDashStyle: 'Dot'
    },

    tooltip: {
      shared: false,
      formatter: function () {
        return '<b>' + this.point.category + '</b><br/>' +
          '<span style="color:' + this.series.color + '">●</span> ' +
          this.series.name + ': <b>' + this.y + CONFIG.valueSuffix + '</b><br/>' +
          'Change 2022→2024: ' + this.point.change + ' pts ' +
          this.point.significance;   // Significance column, shown as-is
      }
    },

    plotOptions: {
      series: { animation: { duration: 600 } },
      scatter: {
        marker: { symbol: 'circle', radius: CONFIG.dotRadius },
        states: { hover: { halo: { size: 4 } } }
      }
    },

    series: [
      {
        type: 'dumbbell',
        name: 'Change',
        data: connectors,
        connectorWidth: CONFIG.lineWidth,
        connectorColor: CONFIG.lineColor,
        marker: { enabled: false },
        lowMarker: { enabled: false },
        showInLegend: false,
        enableMouseTracking: false
      },
      { type: 'scatter', name: '2022', color: CONFIG.color2022, data: dots2022 },
      { type: 'scatter', name: '2024', color: CONFIG.color2024, data: dots2024 },
      {
        type: 'scatter',
        name: 'Significance',
        data: sigPoints,
        marker: { enabled: false },          // no dot, just the label
        showInLegend: false,
        enableMouseTracking: false,
        dataLabels: {
          enabled: true,
          format: '{point.sig}',             // the Significance value, shown as-is
          verticalAlign: 'bottom',           // label sits on top of the line
          y: CONFIG.sigOffset,
          crop: false,
          overflow: 'allow',
          style: {
            color: CONFIG.textColor,
            fontSize: CONFIG.sigFontSize,
            fontWeight: 'bold',
            textOutline: 'none'
          }
        }
      },
      ...lineTypeLegend                        // one legend entry per Demographic
    ]
  });
}

/* ---------------------------------------------------------
   STEP 0: LOAD THE CSV FILE (runs first)
   Downloads the CSV, parses it (Step 1), then draws the chart (Step 2).
   --------------------------------------------------------- */
fetch(CONFIG.csvFile)                                  // request the CSV file
  .then(res => {                                       // check it loaded OK
    if (!res.ok) throw new Error('Could not load ' + CONFIG.csvFile);
    return res.text();                                 // read it as plain text
  })
  .then(text => {
    const rows = parseCSV(text);                       // Step 1
    buildChart(rows);                                  // Step 2
  })
  .catch(err => {                                      // show any error on the page
    document.getElementById('container').innerHTML =
      '<p style="color:#c00">Error: ' + err.message + '</p>';
    console.error(err);
  });