const ChartJSImage = require('chart.js-image');

const close = [
  "122.45",
  "455.23",
  "543.56",
  "765.67"
]

const open = [
  "221.45",
  "565.23",
  "983.56",
  "565.67"
]

const high = [
  "111.45",
  "876.23",
  "383.56",
  "335.67"
]

const low = [
  "651.45",
  "346.23",
  "653.56",
  "665.67"
]

const cc = ChartJSImage().chart({
  type: "line",
  data: {
        labels:[
          "label 1",
          "label 2",
          "label 3",
          "label 4",
          "label 1",
          "label 2",
          "label 3",
          "label 4",
          "label 1",
          "label 2",
          "label 3",
          "label 4"
    
        ],
        datasets: [
        {
            label: "Open",
            borderColor: "rgb(255,+99,+132)",
            backgroundColor: "rgba(255,+99,+132,+.5)",
            data: open
        },
        {
            label: "High",
            borderColor: "rgb(54,+162,+235)",
            backgroundColor: "rgba(54,+162,+235,+.5)",
            data: high
        },
        {
            label: "Low",
            borderColor: "rgb(155,+33,+112)",
            backgroundColor: "rgba(255,+99,+132,+.5)",
            data: low
        },
        {
            label: "Close",
            borderColor: "rgb(94,+162,+235)",
            backgroundColor: "rgba(54,+162,+235,+.5)",
            data: close
        }
        ]
      }
})
.backgroundColor('white')
.width(500) // 500px
.height(300);

// const uuu = cc.toURL(); 
cc.toFile('./yo-cc.png');