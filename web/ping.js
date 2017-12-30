
google.charts.load('current', {packages: ['corechart', 'line']})
google.charts.setOnLoadCallback(function () {
  // make sure we don't kick anything off until the charts are available
  document.getElementById('startBtn').removeAttribute('disabled')
})

// some configuration
const pingconfig = {
  pingURL: new URL('/ping', window.location.href),
  contentURL: 'https://cdn.spacetelescope.org/archives/images/large/heic0611b.jpg'
}

// utility function to sleep a bit
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function renderPingSeries (pingJson) {
  // dump ping results into a data table
  const chartData = new google.visualization.DataTable()
  chartData.addColumn('number', 'seq')
  chartData.addColumn('number', 'RTT')

  console.log(pingJson)

  for (const {seq, rtt} of pingJson.results) {
    chartData.addRow([seq, rtt])
  }

  // label the axes
  const chartOptions = {
    hAxis: {
      title: 'ICMP sequence (500ms intervals)'
    },
    vAxis: {
      title: 'RTT (ms)'
    }
  }

  // plot in the result div
  const chart = new google.visualization.LineChart(document.getElementById('result'))
  chart.draw(chartData, chartOptions)
}

async function pingMe() {
  const statusElement = document.getElementById('status')
  const downloadStart = new Date()
  let phase = ''

  // load content URL
  pingconfig.contentURL = document.getElementById('content-url').value

  // intial download
  statusElement.textContent = 'step 1: downloading content to determine ping duration'

  try {
    phase = 'initial content'
    let response = await fetch(pingconfig.contentURL, {cache: 'no-store'})
    await response.blob()
    const pingDuration = 10 + Math.floor((new Date() - downloadStart) / 1000)

    // request ping
    statusElement.textContent = 'step 2: starting ping for ' + pingDuration + ' seconds'

    const pingResponse = await fetch(pingconfig.pingURL + '?period=0.5&duration=' + pingDuration)

    if (pingResponse.status > 299) {
      throw new Error('' + pingResponse.status + ': ' + await pingResponse.blob())
    }

    const pingResponseJson = await pingResponse.json()

    const pingStart = new Date()
    const pingResultLink = new URL(pingResponseJson.link, pingconfig.pingURL)

    // wait four seconds to get baseline ping data, then start the download
    await sleep(4000)

    statusElement.textContent = 'step 3: downloading content to load link'
    phase = 'primary content'

    response = await fetch(pingconfig.contentURL, {cache: 'no-store'})
    await response.blob

    // we know how long we asked to be pinged. we know how long the download took.
    // now wait the rest of the time...
    const waitDuration = (pingDuration + 3) * 1000 - (new Date() - pingStart)
    if (waitDuration > 0) {
      statusElement.textContent = 'step 4: waiting ' + Math.round(waitDuration / 1000) + 's for ping to complete'
      await sleep(waitDuration)
    }

    // get results and render them
    phase = 'ping result'
    response = await fetch(pingResultLink)
    const json = response.json()
    if (json.error) {
      document.getElementById('result').textContent('No RTT data available. Your ISP probably blocks ICMP.')
      return
    }
    renderPingSeries(json)
    statusElement.textContent = 'measurement complete: results from ' + pingResultLink
  } catch (error) {
    statusElement.textContent = phase + ' download failed; see console'
    console.log(error)
  }
}
