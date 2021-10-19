const minimist = require("minimist");
const jsdom = require("jsdom");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const tulind = require("tulind");
const ChartJSImage = require('chart.js-image');
const XL = require("excel4node");
const pdf = require("pdf-lib");

const URL = `https://in.investing.com`;
let rootDateFolder = '';
let wb = '';

function extractStockFinance(stockUrl, interval, rootFolder, workBook){
    const stockDetail = axios.get(stockUrl);
    stockDetail.then(function(resp){
        rootDateFolder = rootFolder;
        wb = workBook;
        extractStockData(resp.data, stockUrl, interval);
    }).catch(function(err){
        console.log(err);
    })
}

function extractStockData(html, stockUrl, interval){
    const dom = new jsdom.JSDOM(html);
    const document = dom.window.document;
    const stockName = document.querySelector("h1.main-title>span.text").textContent;
    let stockLabel = stockName.split("(")[1];
    stockLabel = stockLabel.substring(0, stockLabel.length - 1);
    getHistoricData(stockUrl, interval);
}

function getHistoricData(stockUrl, interval){
    // ?interval_sec=daily
    let historicDataUrl = stockUrl + "-historical-data";
    if(!interval){
        historicDataUrl += `?interval_sec=daily`;
    }else{
        switch(interval.toLowerCase().trim()){
            case "weekly":
                historicDataUrl += `?interval_sec=weekly`;
                break;
            case "monthly":
                historicDataUrl += `?interval_sec=monthly`;
                break;
            default:
                historicDataUrl += `?interval_sec=daily`;
        }
    }
    
    const historicData = axios.get(historicDataUrl);
    historicData.then(function(resp){
        extractStockDataTable(resp.data);
    }).catch(function(err){
        console.log(err);
    })
}

function extractStockDataTable(html){
    const dom = new jsdom.JSDOM(html);
    const document = dom.window.document;
    const stockName = document.querySelector("h1.main-title>span.text");

    //CREATE STOCK FOLDER INSIDE DATE FOLDER 
    const stockFolderPath = path.join(rootDateFolder, stockName.textContent);
    if(!fs.existsSync(stockFolderPath))
        fs.mkdirSync(stockFolderPath);
    
    //INITIALIZE EXCEL WORKSHEET
    const excelPath = path.join(stockFolderPath, stockName.textContent + ".csv");
    let wb = new XL.Workbook();
    let sheet = wb.addWorksheet(stockName.textContent);

    const tableHeads = document.querySelectorAll("section.instrument table.common-table th>div.th-wrapper>span.text");
    const tableRows = document.querySelectorAll("section.instrument table.common-table tbody tr.common-table-item");

    for(let i = 0; i < tableHeads.length; i++){
        sheet.cell(1, 1 + i).string(tableHeads[i].textContent);
    }

    let dates = [];
    let prices = [];
    let opens = [];
    let high = [];
    let low = [];
    
    for(let i = 0; i < tableRows.length; i++){
        const rowElements = tableRows[i].querySelectorAll("td>span.text");
        let rowStr = "";
        for(let j = 0; j < rowElements.length; j++){
            if(j == 0){
                dates.push(rowElements[j].textContent);
            }else if(j == 1){

                let price = rowElements[j].textContent.split(",");
                price = price[0] + price[1];
                price = parseFloat(price);
                prices.push(price);
            }else if(j == 2){
                opens.push(parseFloat(rowElements[j].textContent));
            }else if(j == 3){
                high.push(parseFloat(rowElements[j].textContent));
            }else if(j == 4){
                low.push(parseFloat(rowElements[j].textContent));
            }

            sheet.cell(2 + i, 1 + j).string(rowElements[j].textContent);
            rowStr += (rowElements[j].textContent + "\t");
        }

    }

    wb.write(excelPath);

    //SMA PDF PATH
    let smaPath = path.join(stockFolderPath, stockName.textContent + "-SMA.pdf");
    let sma = simpleMovingAverage(prices);
    plotGraph(dates, prices, sma, smaPath);


    //SMA PDF PATH
    let rsiPath = path.join(stockFolderPath, stockName.textContent + "-RSI.pdf");
    let rsi = [];
    tulind.indicators.rsi.indicator([prices], [7], function(err, resp){
        if(err)
            console.log(err);
        else{
            rsi = resp[0];
        }
    })
    plotRSIGraph(dates, rsi, rsiPath);

    
    //SMA PDF PATH
    let ohlcPath = path.join(stockFolderPath, stockName.textContent + "-OHLC-line.pdf");
    plotOhlcLineGraph(dates, opens, high, low, prices, ohlcPath);
}

function simpleMovingAverage(prices, period = 2){
    let sma = prices.map(function(val, idx, arr){
        if(idx < period){
            val = null;
        }else{
            val = arr.slice(period, idx);
            val = average(val);
        }
        return val;
    })
    return sma;
}    

function average(prices){
    let sum = prices.reduce(function(accumulator, val){
        return accumulator + parseFloat(val);
    }, 0);
    return sum / prices.length;
}

function plotGraph(dates, prices, indicator, smaPath){
    const line_chart = ChartJSImage().chart({
        type: "line",
        data: {
            labels: dates,
            datasets: [
            {
                label: "Close",
                borderColor: "rgb(255,+99,+132)",
                backgroundColor: "rgba(255,+99,+132,+.5)",
                data: prices
            },
            {
                label: "Moving Average",
                borderColor: "rgb(54,+162,+235)",
                backgroundColor: "rgba(54,+162,+235,+.5)",
                data: indicator
            }
            ]
        },
        options: {
            title: {
            display: true,
            text: "MOVING AVERAGE PLOT"
            },
            scales: {
            xAxes: [
                {
                    scaleLabel: {
                        display: true,
                        labelString: "Dates"
                    }
                }
            ],
            yAxes: [
                {
                    scaleLabel: {
                        display: true,
                        labelString: "Prices"
                    }
                }
            ]
            },
            timeout: 5000
        }
    }) // Line chart
    .backgroundColor('white')
    .width(500) // 500px
    .height(300);
    let imagePath = smaPath.split('.')[0] + ".png";
    line_chart.toFile(imagePath).then(function(){
        let imgBuffer = fs.readFileSync(imagePath);   
        pdf.PDFDocument.create().then(function(pdfDoc){
            const page = pdfDoc.addPage();
            pdfDoc.embedPng(imgBuffer).then(function(pdfImage){
                const pngDims = pdfImage.scale(0.50);
                page.drawImage(pdfImage, {
                    x: 40,
                    y: 510,
                    width: pngDims.width,
                    height: pngDims.height
                })
                let saveDoc = pdfDoc.save();
                saveDoc.then(function(newBytes){
                    fs.writeFileSync(smaPath, newBytes);
                    fs.unlinkSync(imagePath);
                }).catch(function(err){
                    console.log(err);
                })
            }).catch(function(err){
                console.log(err);
            })
        })
            
            
    }).catch(function(){
    })
    
}

function plotRSIGraph(dates, rsi, rsiPath){
    const line_chart = ChartJSImage().chart({
        type: "line",
        data: {
            labels: dates,
            datasets: [
                {
                    label: "RSI",
                    borderColor: "rgb(255,+99,+132)",
                    backgroundColor: "rgba(255,+99,+132,+.5)",
                    data: rsi,
                    borderWidth: 1
                }
            ]
        },
        options: {
            title: {
            display: true,
            text: "RSI PLOT"
            },
            scales: {
            xAxes: [
                {
                    scaleLabel: {
                        display: true,
                        labelString: "Dates"
                    }
                }
            ],
            yAxes: [
                {
                    scaleLabel: {
                        display: true,
                        labelString: "Prices"
                    },
                    ticks: {
                        min: 0,
                        max: 100,
                        stepSize: 5,
                    },
                }
            ]
            },
            timeout: 5000
        }
    }) // Line chart
    .backgroundColor('white')
    .width(700) // 500px
    .height(500);
     
    let imagePath = rsiPath.split('.')[0] + ".png";
    line_chart.toFile(imagePath).then(function(){
        let imgBuffer = fs.readFileSync(imagePath);
        pdf.PDFDocument.create().then(function(pdfDoc){
            const page = pdfDoc.addPage();
            pdfDoc.embedPng(imgBuffer).then(function(pdfImage){
                const pngDims = pdfImage.scale(0.35);
                page.drawImage(pdfImage, {
                    x: 40,
                    y: 470,
                    width: pngDims.width,
                    height: pngDims.height
                })
                let saveDoc = pdfDoc.save();
                saveDoc.then(function(newBytes){
                    fs.writeFileSync(rsiPath, newBytes);
                    fs.unlinkSync(imagePath);
                }).catch(function(err){
                    console.log(err);
                })
            }).catch(function(err){
                console.log(err);
            })
            
        }).catch(function(err){
            console.log(err);
        })
    }).catch(function(){
    })
}

function plotOhlcLineGraph(dates, open, high, low, close, ohlcPath){
    const line_chart = ChartJSImage().chart({
        type: "line",
        data: {
            labels: dates,
            datasets: [
                {
                    label: "Open",
                    borderColor: "rgb(255,+99,+132)",
                    backgroundColor: "rgba(255,+99,+132,+.5)",
                    data: open,
                    borderWidth: 1
                },
                {
                    label: "High",
                    borderColor: "rgb(54,+162,+235)",
                    backgroundColor: "rgba(54,+162,+235,+.5)",
                    data: high,
                    borderWidth: 1
                },
                {
                    label: "Low",
                    borderColor: "rgb(155,+33,+112)",
                    backgroundColor: "rgba(255,+99,+132,+.5)",
                    data: low,
                    borderWidth: 1
                },
                {
                    label: "Close",
                    borderColor: "rgb(9,+16,+35)",
                    backgroundColor: "rgba(9,+16,+35,+.5)",
                    data: close,
                    borderWidth: 1
                }
            ]
        },
        options: {
            title: {
            display: true,
            text: "OHLC LINE PLOT"
            },
            scales: {
            xAxes: [
                {
                    scaleLabel: {
                        display: true,
                        labelString: "Dates"
                    }
                }
            ],
            yAxes: [
                {
                    scaleLabel: {
                        display: true,
                        labelString: "Prices"
                    },
                    ticks: {
                        stepSize: 5,
                    },
                }
            ]
            },
            timeout: 5000
        }
    }) // Line chart
    .backgroundColor('white')
    .width(700) // 500px
    .height(500);
    let imagePath = ohlcPath.split('.')[0] + ".jpeg";
    line_chart.toFile(imagePath).then(function(){
        let imgBuffer = fs.readFileSync(imagePath);
        pdf.PDFDocument.create().then(function(pdfDoc){
            const page = pdfDoc.addPage();
            pdfDoc.embedPng(imgBuffer).then(function(pdfImage){
                const pngDims = pdfImage.scale(0.35);
                page.drawImage(pdfImage, {
                    x: 40,
                    y: 470,
                    width: pngDims.width,
                    height: pngDims.height
                })
                let saveDoc = pdfDoc.save();
                saveDoc.then(function(newBytes){
                    fs.writeFileSync(ohlcPath, newBytes);
                    fs.unlinkSync(imagePath);
                }).catch(function(err){
                    console.log(err);
                })
            }).catch(function(err){
                console.log(err);
            })
        }).catch(function(err){
            console.log(err);
        })
    }).catch(function(){
    })
}

module.exports = {
    extractStockFinance
}