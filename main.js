const minimist = require("minimist");
const jsdom = require("jsdom");
const axios = require("axios");
const stockData = require("./stocksData");
const fs = require("fs");
const path = require("path");
const Excel = require('exceljs');

const URL = `https://in.investing.com`;
const rootFolderPath = path.join("Trending-Stocks");

const args = minimist(process.argv);

//node main.js --interval="daily"

const shares = axios.get(URL);

//extract html from axios promise
shares.then(function(response){
    extractShares(response.data);
}).catch(function(err){
    console.log(err);
});

function extractShares(sharesHtml){
    const dom = new jsdom.JSDOM(sharesHtml);
    const document = dom.window.document;

    //Container for treding stocks data
    const trendStockContainer = document.querySelector("section.common-table-comp section.common-section section.common-table-comp");
    const trendStocks = trendStockContainer.querySelectorAll("a.js-instrument-page-link");

    //heading, body of tending stocks data table
    const theads = trendStockContainer.querySelectorAll("thead span.text");
    const bodyRows = trendStockContainer.querySelectorAll("tbody>tr");
    const trendingStocksCsvPath = path.join(rootFolderPath, 'stocks.csv');

    const wb = new Excel.Workbook();
    wb.xlsx.readFile(trendingStocksCsvPath)
    .then(function() {
        let ws = wb.getWorksheet(1);
        for(let i = 0; i < bodyRows.length; i++){
            let name = bodyRows[i].querySelector("a");
            let found = false;
            ws.eachRow(function(row, rowNumber) {
                if(rowNumber > 1){
                    if(row.getCell(1).value == name.textContent){
                        let nd = bodyRows[i].querySelectorAll("span.text");
                        for(let j = 0; j < nd.length; j++){
                            row.getCell(2 + j).value = nd[j].textContent;
                        }
                        row.commit();
                        found = true;
                    }
                }
            });
            if(!found){
                let newRow = [ name.textContent ];
                let nd = bodyRows[i].querySelectorAll("span.text");
                for(let j = 0; j < nd.length; j++){
                    newRow.push(nd[j].textContent);
                }
                ws.addRow(newRow);
            }

        }
        wb.xlsx.writeFile(trendingStocksCsvPath);
    }).catch(function(){
        let ws = wb.addWorksheet("Trending Stocks");
        let headRow = [];
        for(let i = 1; i < theads.length - 1; i++){
            headRow.push(theads[i].textContent);
        }
        ws.addRow(headRow);

        for(let i = 0; i < bodyRows.length; i++){
            let name = bodyRows[i].querySelector("a");
            let nd = bodyRows[i].querySelectorAll("span.text");
            let r = ws.getRow(i + 2);
            for(let j = 1; j <= nd.length + 1; j++){
                r.getCell(j).value = (j == 1) ? name.textContent : nd[j - 2].textContent;
            }
            r.commit();
        }
        wb.xlsx.writeFile(trendingStocksCsvPath);
    })


    let stockUrl = URL + trendStocks[0].getAttribute("href");
    // stockData.extractStockFinance(stockUrl, args.interval);

    if(!fs.existsSync(rootFolderPath)){
        fs.mkdirSync(rootFolderPath);
    } 

    let today = new Date();
    let date = today.getDate();
    date = date < 0 ? '0' + date : '' + date;
    let month = String(today.getMonth() + 1);
    month = month < 0 ? '0' + month : '' + month;
    let year = today. getFullYear();
    today = date + '-' + month + '-' + year;
    today = path.join(rootFolderPath, today);

    if(!fs.existsSync(today)){
        fs.mkdirSync(today);
    }

    for(let i = 0; i < trendStocks.length; i++){
        let stockUrl = URL + trendStocks[i].getAttribute("href");
        stockData.extractStockFinance(stockUrl, args.interval, today);
    }
}




